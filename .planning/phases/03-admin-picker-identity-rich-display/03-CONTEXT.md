# Phase 3: Admin Picker & Identity-Rich Display - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace email-textarea inputs with a searchable Prime user picker on three admin surfaces — **Dashboard Admins**, **Group member editor**, and **New Group form** — and render Prime name + division across **picker results**, **group/admin lists**, and **the audit log**. Email-keyed storage (`groups[].members: email[]`, `admins: email[]`) is unchanged; the `VisibilityConfig` blob schema is unchanged.

In-scope requirements: **ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, DISPLAY-01, DISPLAY-02, DISPLAY-03**.

Carried-forward foundation:
- Phase 1 `getAllPrimeUsers()` / `resolveByEmail()` are the read APIs — no new server-side resolution code.
- Phase 2 `AuthContext.primeUser` is already wired client-side; Phase 2 D-10 fallback cascade `primeUser?.fullName?.trim() || email` is the canonical render pattern.
- `PrimeUser` shape is locked. Probe-confirmed in this tenant: `division` and `region` are always `null`; `roleOrTrade` is populated from `roles[0]`; `fullName`, `email`, `status` are populated.

Out of scope, deferred:
- Server-side enforcement of page visibility (ENFORCE-01..03 — v2 milestone).
- Audit trail for admin config changes (ADMIN-AUDIT-01..03 — v2 milestone).
- Removing hardcoded `chris.freeman@techgurus.com.au` admin fallback (BOOTSTRAP-01 — v2).
- `ALL_PAGES` vs Sidebar nav drift cleanup (NAV-DRIFT — v2).

</domain>

<decisions>
## Implementation Decisions

### Picker surface & component shape

- **D-01: Inline combobox surface.** All three picker instances use the same in-place pattern: search input where the textarea is today, floating filter results below the input on focus/typing, click-to-add chip preview directly below. No modal, no popover. Matches the existing inline-everything admin UI; no new component class introduced.
- **D-02: Single shared `<PrimeUserPicker>` component** in `components/ui/PrimeUserPicker.tsx`. Props (proposed; planner finalizes): `selectedEmails: string[]`, `onChange(emails: string[])`, `multi: boolean` (default `true`), `availableUsers: PrimeUser[]`, `placeholder?: string`. Three call sites (Dashboard Admins, group editor, new-group form) all set `multi: true` (per D-04). Naming follows convention (`components/ui/` PascalCase).
- **D-03: Filter scope = name + email + division** (per ADMIN-04). Filters case-insensitively across `fullName`, `email`, and `division`. Non-null fields only; null fields contribute nothing to the match. Future-proof when Prime tenant ever populates `division`.
- **D-04: Multi-select on every surface.** Dashboard Admins picker behaves identically to group-member pickers — admins can add several entries before saving. Single shared component, single mental model.
- **D-05: Existing "Save Changes" persistence stays.** Picker mutates local state; the visibility tab's Save button POSTs the whole `VisibilityConfig` to `/api/admin/page-visibility` exactly as today. No auto-save, no endpoint contract change.

### Row rendering (DISPLAY-01, DISPLAY-02)

- **D-06: Two-line row pattern** for picker results AND for group/admin lists.
  - Line 1 (primary): `fullName` when present and non-blank, else `email`.
  - Line 2 (secondary): `email` always; append `· {division}` only when `division` is non-null.
  - Single layout used by `<PrimeUserPicker>` result rows, group member rows in `GroupCard`, Dashboard Admins rows, and (per D-15) audit log actor cells. Visual peer with TopBar (`text-sm`, `text-gray-300` primary, `text-gray-500` secondary — planner / UI-SPEC sets exact tokens).
- **D-07: Group/admin lists mirror picker rows.** Same two-line render. `GroupCard` (currently a textarea, `app/admin/page.tsx:457`) becomes a chip-row of two-line entries plus an inline picker for adding. Dashboard Admins (currently `app/admin/page.tsx:285`) gets the same treatment.
- **D-08: Unresolved-email fallback = email-only, neutral styling.** When `resolveByEmail()` returns null for a stored email, the row renders just the email at the same primary token (`text-gray-300`) — no name line, no badge, no dim. The absent name line IS the cue. Matches Phase 2 D-10 cascade philosophy (one canonical fallback ladder).

### Stale-entry treatment (ADMIN-05)

- **D-09: Hover tooltip "No Prime record found"** on every email-only row. Provides plain-language explanation without adding chrome. Implementation: `title` attribute on the row container.
- **D-10: No bulk cleanup UI in v1.** Per-row remove (existing `[×]` action) is sufficient for ADMIN-05. No "stale entries panel," no per-group "X not in Prime" counter, no top-of-tab summary. Scope creep deferred to v2 if admins request it.

### Source endpoint (admin-only client fetch)

- **D-11: New `GET /api/admin/prime-users`** route handler, admin session-gated using the same two-gate pattern as `app/api/admin/prime-users/refresh/route.ts` (Phase 1). Returns `PrimeUser[]` from `getAllPrimeUsers()`. Response shape: `{ users: PrimeUser[], lastSuccessAt: string | null, lastError: string | null }` (mirrors the metadata Phase 1 D-19 already persists on the blob, so the picker can render `Last refreshed: 5 days ago`). Cache: `no-store` (the blob does its own caching one layer down).
- **D-12: Picker-failure manual-email fallback.** When `/api/admin/prime-users` errors or returns empty: picker shows error copy ("Prime directory unavailable — try refresh") + reveals a single email-input field that adds whatever the admin types as a raw email entry. Preserves the ability to administer access during a Prime outage; aligns with Phase 1 D-16 graceful-degradation.
- **D-13: Refresh button at top of Visibility tab,** beside Save Changes. Wires to the existing `POST /api/admin/prime-users/refresh` (Phase 1, DIR-03). Displays metadata from the response (`userCount`, `cachedAt`, `durationMs`) — e.g. "Refreshed 28 users · 1.2s · 3:45pm". On 502 with `lastSuccessAt`, shows "Prime unreachable — using cache from {N} {unit} ago".

### Audit log identity (DISPLAY-03)

- **D-14: Client-side resolution.** Audit tab fetches `/api/admin/prime-users` (the same endpoint the picker uses) on mount and reuses the loaded list to map `entry.email → fullName` at render time. Zero new endpoints, zero new server coupling, no per-row latency. Survives Prime outage by falling back through the cascade in D-15.
- **D-15: Three-step actor cascade.** Each audit row's actor renders as: live Prime name (from the loaded user list) → `entry.name` (cookie-snapshotted at login, already in the audit blob) → bare email. One layer deeper than Phase 2 D-10 because audit rows can be from users who left the company (no Prime record AND no recent login).
- **D-16: `prime_user_miss` rows reuse the existing badge.** Actor cell uses the D-15 cascade (typically resolves to bare email — by definition the user wasn't in Prime). The existing amber `Miss` badge (`app/admin/page.tsx:512` `ActionBadge`) stays. The audit `detail` field (`"cache_hit: no match"` vs `"cache_empty"` from Phase 2 D-06) is rendered as a hover tooltip on the row.
- **D-17: CSV export gets a "Display Name" column** populated from the same cascade. Existing column order: Timestamp (AEDT), Email, Name, Action → updated to Timestamp (AEDT), Email, Display Name, Action (rename `Name` → `Display Name` to reflect resolved value). Same row count, same blob, no API changes.

### Test strategy

- **D-18: Continue Vitest from Phase 1 + 2.** Co-located `*.test.ts`. Coverage targets:
  - **`<PrimeUserPicker>` filter logic** (pure function): name + email + division match, case-insensitive, null-safe, multi-token search if implemented.
  - **Email → row cascade utility** (the D-15 logic, factored out so both picker rows AND audit rows use it). Tests: live-name hit, fallback to entry.name, fallback to email, blank/whitespace handling.
  - **`/api/admin/prime-users` route handler**: unauthenticated → 401, authenticated non-admin → 403, admin → 200 with users + metadata. Mirrors Phase 1's refresh-route test pattern.
- **D-19: No browser/RSC tests in this phase.** Picker mount/keyboard interactions covered by manual UAT (consistent with Phase 1 D-21 / Phase 2 D-15). Component logic stays pure-function for testability.

### File organization (CONCERNS.md mitigation)

- **D-20: Split `app/admin/page.tsx` (793 lines).** Extract `VisibilityTab` and its helpers (`GroupCard`, member-row component) into `app/admin/visibility-tab.tsx`. Extract `AuditTab` (and `ActionBadge`, `formatAEDT`, `exportCSV`) into `app/admin/audit-tab.tsx`. Leaves `page.tsx` as the tab router only. Addresses CONCERNS.md "793 lines" flag head-on; new picker code lands in the smaller, dedicated file. **Picker component itself lives in `components/ui/PrimeUserPicker.tsx`** (shared `ui/` dir, not the admin route).

### Scope guardrails

- **D-21: No changes to `VisibilityConfig` blob schema.** `groups[].members: email[]`, `admins: email[]`, `pages[]` — all unchanged. The `/api/admin/page-visibility` endpoint contract is untouched.
- **D-22: No changes to Phase 1 / Phase 2 modules.** `lib/prime-users.ts`, `lib/audit.ts`, `lib/auth-context.tsx`, `app/api/auth/login/route.ts`, `app/api/auth/session/route.ts` are read-only references for Phase 3 — Phase 3 only consumes their exports and contracts.

### Claude's Discretion

- Exact CSS/Tailwind tokens for picker chrome (border, focus ring, dropdown shadow). UI-SPEC step (recommended next) or planner picks per existing admin UI conventions.
- Exact keyboard interaction model (↑/↓ to navigate, Enter to add, Esc to close, Backspace on empty input to remove last chip). Planner picks; researcher should verify any chosen lib approach (e.g. Headless UI / Radix Combobox) is already a dep or stays plain-React.
- Exact debounce / search algorithm shape (substring vs token-AND vs fuzzy). Default to case-insensitive substring against name/email/division joined as one searchable string.
- Whether the picker pre-fetches on tab mount or on first focus. Default: tab mount (the `/api/admin/prime-users` payload is small, ~30 records).
- Exact tooltip mechanism (native `title` vs an actual tooltip component). Default: native `title` to avoid pulling a tooltip lib for one use site.
- Exact wire format of the inactive-user (`status !== 'active'`) handling — visual grey-out in picker results vs filtering them out entirely. Default: include in results, tag visually (planner / UI-SPEC decides).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone requirements & roadmap
- `.planning/REQUIREMENTS.md` §"Admin UI — User Picker (ADMIN)" — ADMIN-01..05 acceptance.
- `.planning/REQUIREMENTS.md` §"UI Display (DISPLAY)" — DISPLAY-01..03 acceptance (DISPLAY-04 was Phase 2).
- `.planning/ROADMAP.md` §"Phase 3: Admin Picker & Identity-Rich Display" — Goal, Depends-on, five Success Criteria.
- `.planning/PROJECT.md` §"Constraints" + §"Key Decisions" — VisibilityConfig blob schema lock, picker-first UX decision rationale.
- `.planning/STATE.md` — current-position pointer.

### Prior phase context (D-01..D-22 above build directly on these)
- `.planning/phases/01-prime-user-directory/01-CONTEXT.md` — `PrimeUser` shape (D-08 there), `getAllPrimeUsers()` / `resolveByEmail()` API (D-07 there), refresh-endpoint contract + response shape (D-13 there) reused by Phase 3 D-13.
- `.planning/phases/02-session-auth-context/02-CONTEXT.md` — `AuthContext.primeUser` plumbing (D-08 there), display-name fallback cascade (D-10 there) reused/extended by Phase 3 D-15, `PRIME_USER_MISS` audit event + `detail` field semantics (D-06 there) consumed by Phase 3 D-16.
- `.planning/phases/02-session-auth-context/02-UI-SPEC.md` §Color (`text-gray-300` primary identity token), §Typography (`text-sm` body) — reused by Phase 3 row rendering.

### Codebase maps (generated by `/gsd-map-codebase`)
- `.planning/codebase/CONVENTIONS.md` — PascalCase components in `components/ui/`, kebab-case lib utilities, named exports, `@/` path alias.
- `.planning/codebase/STRUCTURE.md` — `app/admin/page.tsx`, `components/ui/`, `lib/` layout.
- `.planning/codebase/CONCERNS.md` §"`app/admin/page.tsx` (793 lines)" — D-20 directly mitigates this concern.
- `.planning/codebase/STACK.md` — Next.js 14 App Router, Tailwind 3, no test harness baseline (Vitest added in Phase 1).

### Existing code (primary reference implementations)
- `lib/prime-users.ts` — `getAllPrimeUsers()`, `resolveByEmail()`, `PrimeUser` type, `PrimeUserDirectoryBlob` (with `lastSuccessAt`, `lastError` metadata Phase 3 D-11 surfaces).
- `lib/page-visibility.ts` — `VisibilityConfig`, `VisibilityGroup`, `isAdminEmail()` (D-11 reuses this for the new `GET /api/admin/prime-users` admin gate). Schema is unchanged per D-21.
- `lib/audit.ts` — `AuditEntry` shape: `{ id, email, name?, action: 'login'|'logout'|'prime_user_miss', timestamp, detail? }`. D-15 cascade uses `entry.name` as the middle layer; D-16 renders `detail` as tooltip. **Read-only — no schema changes in Phase 3.**
- `lib/auth-context.tsx` — `AuthContext` already exposes `primeUser` (Phase 2). Phase 3 components consume via `useAuth()`.
- `app/api/admin/prime-users/refresh/route.ts` — Reference implementation for the admin-gated route pattern (`getSession()` → `getVisibilityConfig()` → `isAdminEmail()`); D-11 mirrors this for the new `GET /api/admin/prime-users` route.
- `app/admin/page.tsx` — Existing 793-line admin page. Lines 285-307 (Dashboard Admins textarea, target of ADMIN-01), 309-364 (Groups + New Group, target of ADMIN-02/03), 457-490 (`GroupCard`, target of DISPLAY-01), 533-642 (`AuditTab` + `ActionBadge`, target of DISPLAY-03). D-20 splits this file.
- `components/ui/TopBar.tsx` — Phase 2 D-10 fallback cascade reference: `primeUser?.fullName?.trim() || userEmail`. D-15 extends to a 3-layer cascade for audit rows.

### No external specs / ADRs
The project has no ADR directory or formal spec folder. All requirements are captured in the `.planning/` milestone docs above. If any external docs emerge during research, the planner should add them here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **`getAllPrimeUsers()`, `resolveByEmail()`, `PrimeUser` type** — full read API for the directory; no server work needed beyond exposing them via the new admin-only GET endpoint.
- **`isAdminEmail(email, config)`** — admin-gate function (D-11 reuses for new GET endpoint).
- **`getSession()`** — session read for endpoint auth (`lib/session.ts`).
- **`useAuth()` / `AuthContext.primeUser`** — already wired in Phase 2; client components import directly.
- **`ActionBadge` component** (`app/admin/page.tsx:508-516`) — existing `Login` / `Logout` / `Miss` badges. Reused unchanged by D-16.
- **`exportCSV()`** (`app/admin/page.tsx:518`) — extended in D-17 to include resolved Display Name column.
- **`VisibilityConfig`, `VisibilityGroup`** types and `/api/admin/page-visibility` POST endpoint — consumed unchanged by the picker (D-05, D-21).

### Established patterns
- **Inline-everything admin UI** — no modals, no popovers anywhere in `app/admin/page.tsx`. D-01 keeps this consistent.
- **Two-gate auth** in admin routes: `getSession()` → `getVisibilityConfig()` → `isAdminEmail()`. D-11 follows.
- **`text-gray-300` primary identity / `text-gray-500` secondary meta** — Phase 2 UI-SPEC tokens. D-06 reuses.
- **Email normalization** = `.trim().toLowerCase()` on store and compare (Phase 1 D-09). Picker submission will normalize before persisting.
- **`[namespace]` log prefixes** — D-11 endpoint will use `[admin-prime-users]` for any server-side errors.
- **Co-located Vitest tests** (Phase 1 D-22). D-18 follows.

### Integration points (NEW)
- `app/api/admin/prime-users/route.ts` (GET) — net-new endpoint per D-11. Admin-gated. Returns `{ users, lastSuccessAt, lastError }`.
- `components/ui/PrimeUserPicker.tsx` — net-new shared component per D-02. Imported by 3 call sites in the visibility tab.
- `app/admin/visibility-tab.tsx` — net-new file per D-20, extracted from `app/admin/page.tsx`. Hosts `VisibilityTab`, `GroupCard`, picker call sites, refresh button.
- `app/admin/audit-tab.tsx` — net-new file per D-20, extracted from `app/admin/page.tsx`. Hosts `AuditTab`, `ActionBadge`, `formatAEDT`, `exportCSV`. Updated by D-14, D-15, D-16, D-17.
- A small shared utility for the D-15 cascade (e.g. `lib/identity-display.ts` or co-located helper) — used by picker rows, group/admin rows, and audit rows. Planner decides exact location.

### Explicitly NOT touched in this phase
- `lib/prime-users.ts`, `lib/audit.ts`, `lib/auth-context.tsx` (per D-22).
- `app/api/auth/login/route.ts`, `app/api/auth/session/route.ts` (Phase 2 territory).
- `/api/admin/page-visibility` endpoint contract (per D-05, D-21).
- `/api/admin/prime-users/refresh` (Phase 1 — reused, not modified).
- `lib/page-visibility.ts:126` hardcoded admin fallback (BOOTSTRAP-01, deferred).
- `ALL_PAGES` ↔ Sidebar nav reconciliation (NAV-DRIFT, deferred).
- Server-side enforcement of page visibility (ENFORCE, deferred).

</code_context>

<specifics>
## Specific Ideas

- **Picker keyboard parity with native form fields.** ↑/↓ to navigate filtered results, Enter to add highlighted result, Esc to close, Backspace on empty input to remove last chip. Standard combobox behavior — a11y win without a heavy lib.
- **Picker shows last-refresh metadata inline.** Below the chip row: subtle `text-xs text-gray-600 — Refreshed 5 days ago — [Refresh]` line. Same data the top-of-tab refresh button uses (D-13); helpful in-context cue when the picker has stale data.
- **Audit table tooltip for `prime_user_miss` rows.** Hover the row → tooltip shows `entry.detail` ("Cache hit: no match" or "Cache empty") in plain language. Matches Phase 2 D-06 intent — let admins distinguish a real miss from a Prime outage.
- **Manual-add fallback (D-12) preserves admin agency.** Even if Prime is unreachable, the admin can still type an email and save it; the row renders email-only with the standard tooltip until the next refresh resolves it.

</specifics>

<deferred>
## Deferred Ideas

- **Bulk cleanup UI for stale entries** (count per group, top-of-tab "Clean up" panel). Deferred per D-10. Reopen if admins flag missing-cleanup as a real pain.
- **Visual badge / amber styling for "Not in Prime" entries.** Deferred in favor of D-09 tooltip-only treatment. Reopen if usability testing shows admins miss stale entries.
- **Per-instance picker refresh button.** Top-of-tab button (D-13) is the single trigger; per-picker is redundant. Defer.
- **Server-side audit join.** Client-side join (D-14) is simpler. Reopen only if audit performance regresses with large lists.
- **Dedicated Admin → Directory subtab** for managing Prime user freshness, viewing last-error history, etc. v2 candidate.
- **`ALL_PAGES` ↔ Sidebar nav drift cleanup** — independent concern; tracked as v2 NAV-DRIFT requirement.
- **Removing hardcoded admin email fallback** (`lib/page-visibility.ts:126`) — v2 BOOTSTRAP-01.
- **Server-side enforcement of page visibility** (ENFORCE-01..03) — v2 milestone.
- **Audit trail for admin config changes** (ADMIN-AUDIT-01..03) — v2 milestone.
- **Rule-based groups** ("auto-include Estimators division") — explicitly rejected at milestone level.
- **Migrating group membership storage from email-keyed to Prime-id-keyed** — explicitly out-of-scope (zero-migration goal); D-21 locks the schema.

</deferred>

---

*Phase: 03-admin-picker-identity-rich-display*
*Context gathered: 2026-04-25*
