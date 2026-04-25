# Phase 3: Admin Picker & Identity-Rich Display - Research

**Researched:** 2026-04-25
**Domain:** Searchable user picker UI + identity rendering across admin surfaces (Next.js 14 App Router client component, no new deps)
**Confidence:** HIGH

## Summary

Phase 3 is a brownfield UI refactor inside `app/admin/page.tsx`. Phases 1 + 2 already shipped the server-side directory (`getAllPrimeUsers()`, `resolveByEmail()`), the live `AuthContext.primeUser`, and the `prime_user_miss` audit event. Phase 3 is **pure consumption**: it adds one new admin-only GET endpoint, one shared `<PrimeUserPicker>` component, one cascade-utility, splits the 793-line admin page into three files, and extends one CSV exporter — all on the existing Tailwind/Vitest baseline.

The two highest-leverage research findings are:

1. **No combobox library is available or warranted.** `package.json` carries zero combobox/headless-UI/Radix deps (verified). The existing search page (`app/search/page.tsx:91`) already uses the case-insensitive `String.toLowerCase().includes()` pattern that D-03 specifies. Plain React + refs + keyboard handlers is correct.
2. **The cut line for the `app/admin/page.tsx` split is clean.** Three top-level functions (`VisibilityTab`, `AuditTab`, `ChangelogTab`) plus their helpers are already self-contained — they share only top-level constants (`TABS`, `slugify`, `pageGroups`, `EMPTY_CONFIG`, `Tab` type) and module-level imports. No state crosses between tabs. Extraction is mechanical.

**Primary recommendation:** Build a plain-React combobox in `components/ui/PrimeUserPicker.tsx` (input + filtered list + chip row + keyboard handlers), expose `PrimeUser[]` via a new `GET /api/admin/prime-users` route that copy-pastes the two-gate auth pattern from `refresh/route.ts`, factor the three-step actor cascade into `lib/identity-display.ts`, and split the admin page into `app/admin/page.tsx` (router) + `app/admin/visibility-tab.tsx` + `app/admin/audit-tab.tsx` (Changelog stays where it is — it's not in Phase 3 scope and moving it expands the diff for no benefit).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Picker surface & component shape**

- **D-01: Inline combobox surface.** All three picker instances use the same in-place pattern: search input where the textarea is today, floating filter results below the input on focus/typing, click-to-add chip preview directly below. No modal, no popover. Matches the existing inline-everything admin UI; no new component class introduced.
- **D-02: Single shared `<PrimeUserPicker>` component** in `components/ui/PrimeUserPicker.tsx`. Props (proposed; planner finalizes): `selectedEmails: string[]`, `onChange(emails: string[])`, `multi: boolean` (default `true`), `availableUsers: PrimeUser[]`, `placeholder?: string`. Three call sites (Dashboard Admins, group editor, new-group form) all set `multi: true` (per D-04). Naming follows convention (`components/ui/` PascalCase).
- **D-03: Filter scope = name + email + division** (per ADMIN-04). Filters case-insensitively across `fullName`, `email`, and `division`. Non-null fields only; null fields contribute nothing to the match. Future-proof when Prime tenant ever populates `division`.
- **D-04: Multi-select on every surface.** Dashboard Admins picker behaves identically to group-member pickers — admins can add several entries before saving. Single shared component, single mental model.
- **D-05: Existing "Save Changes" persistence stays.** Picker mutates local state; the visibility tab's Save button POSTs the whole `VisibilityConfig` to `/api/admin/page-visibility` exactly as today. No auto-save, no endpoint contract change.

**Row rendering (DISPLAY-01, DISPLAY-02)**

- **D-06: Two-line row pattern** for picker results AND for group/admin lists. Line 1 (primary): `fullName` when present and non-blank, else `email`. Line 2 (secondary): `email` always; append `· {division}` only when `division` is non-null. Single layout used by `<PrimeUserPicker>` result rows, group member rows in `GroupCard`, Dashboard Admins rows, and (per D-15) audit log actor cells. Visual peer with TopBar (`text-sm`, `text-gray-300` primary, `text-gray-500` secondary — planner / UI-SPEC sets exact tokens).
- **D-07: Group/admin lists mirror picker rows.** Same two-line render. `GroupCard` (currently a textarea, `app/admin/page.tsx:457`) becomes a chip-row of two-line entries plus an inline picker for adding. Dashboard Admins (currently `app/admin/page.tsx:285`) gets the same treatment.
- **D-08: Unresolved-email fallback = email-only, neutral styling.** When `resolveByEmail()` returns null for a stored email, the row renders just the email at the same primary token (`text-gray-300`) — no name line, no badge, no dim. The absent name line IS the cue. Matches Phase 2 D-10 cascade philosophy (one canonical fallback ladder).

**Stale-entry treatment (ADMIN-05)**

- **D-09: Hover tooltip "No Prime record found"** on every email-only row. Provides plain-language explanation without adding chrome. Implementation: `title` attribute on the row container.
- **D-10: No bulk cleanup UI in v1.** Per-row remove (existing `[×]` action) is sufficient for ADMIN-05. No "stale entries panel," no per-group "X not in Prime" counter, no top-of-tab summary. Scope creep deferred to v2 if admins request it.

**Source endpoint (admin-only client fetch)**

- **D-11: New `GET /api/admin/prime-users`** route handler, admin session-gated using the same two-gate pattern as `app/api/admin/prime-users/refresh/route.ts` (Phase 1). Returns `PrimeUser[]` from `getAllPrimeUsers()`. Response shape: `{ users: PrimeUser[], lastSuccessAt: string | null, lastError: string | null }` (mirrors the metadata Phase 1 D-19 already persists on the blob, so the picker can render `Last refreshed: 5 days ago`). Cache: `no-store` (the blob does its own caching one layer down).
- **D-12: Picker-failure manual-email fallback.** When `/api/admin/prime-users` errors or returns empty: picker shows error copy ("Prime directory unavailable — try refresh") + reveals a single email-input field that adds whatever the admin types as a raw email entry. Preserves the ability to administer access during a Prime outage; aligns with Phase 1 D-16 graceful-degradation.
- **D-13: Refresh button at top of Visibility tab,** beside Save Changes. Wires to the existing `POST /api/admin/prime-users/refresh` (Phase 1, DIR-03). Displays metadata from the response (`userCount`, `cachedAt`, `durationMs`) — e.g. "Refreshed 28 users · 1.2s · 3:45pm". On 502 with `lastSuccessAt`, shows "Prime unreachable — using cache from {N} {unit} ago".

**Audit log identity (DISPLAY-03)**

- **D-14: Client-side resolution.** Audit tab fetches `/api/admin/prime-users` (the same endpoint the picker uses) on mount and reuses the loaded list to map `entry.email → fullName` at render time. Zero new endpoints, zero new server coupling, no per-row latency. Survives Prime outage by falling back through the cascade in D-15.
- **D-15: Three-step actor cascade.** Each audit row's actor renders as: live Prime name (from the loaded user list) → `entry.name` (cookie-snapshotted at login, already in the audit blob) → bare email. One layer deeper than Phase 2 D-10 because audit rows can be from users who left the company (no Prime record AND no recent login).
- **D-16: `prime_user_miss` rows reuse the existing badge.** Actor cell uses the D-15 cascade (typically resolves to bare email — by definition the user wasn't in Prime). The existing amber `Miss` badge (`app/admin/page.tsx:512` `ActionBadge`) stays. The audit `detail` field (`"cache_hit: no match"` vs `"cache_empty"` from Phase 2 D-06) is rendered as a hover tooltip on the row.
- **D-17: CSV export gets a "Display Name" column** populated from the same cascade. Existing column order: Timestamp (AEDT), Email, Name, Action → updated to Timestamp (AEDT), Email, Display Name, Action (rename `Name` → `Display Name` to reflect resolved value). Same row count, same blob, no API changes.

**Test strategy**

- **D-18: Continue Vitest from Phase 1 + 2.** Co-located `*.test.ts`. Coverage targets:
  - **`<PrimeUserPicker>` filter logic** (pure function): name + email + division match, case-insensitive, null-safe, multi-token search if implemented.
  - **Email → row cascade utility** (the D-15 logic, factored out so both picker rows AND audit rows use it). Tests: live-name hit, fallback to entry.name, fallback to email, blank/whitespace handling.
  - **`/api/admin/prime-users` route handler**: unauthenticated → 401, authenticated non-admin → 403, admin → 200 with users + metadata. Mirrors Phase 1's refresh-route test pattern.
- **D-19: No browser/RSC tests in this phase.** Picker mount/keyboard interactions covered by manual UAT (consistent with Phase 1 D-21 / Phase 2 D-15). Component logic stays pure-function for testability.

**File organization (CONCERNS.md mitigation)**

- **D-20: Split `app/admin/page.tsx` (793 lines).** Extract `VisibilityTab` and its helpers (`GroupCard`, member-row component) into `app/admin/visibility-tab.tsx`. Extract `AuditTab` (and `ActionBadge`, `formatAEDT`, `exportCSV`) into `app/admin/audit-tab.tsx`. Leaves `page.tsx` as the tab router only. Addresses CONCERNS.md "793 lines" flag head-on; new picker code lands in the smaller, dedicated file. **Picker component itself lives in `components/ui/PrimeUserPicker.tsx`** (shared `ui/` dir, not the admin route).

**Scope guardrails**

- **D-21: No changes to `VisibilityConfig` blob schema.** `groups[].members: email[]`, `admins: email[]`, `pages[]` — all unchanged. The `/api/admin/page-visibility` endpoint contract is untouched.
- **D-22: No changes to Phase 1 / Phase 2 modules.** `lib/prime-users.ts`, `lib/audit.ts`, `lib/auth-context.tsx`, `app/api/auth/login/route.ts`, `app/api/auth/session/route.ts` are read-only references for Phase 3 — Phase 3 only consumes their exports and contracts.

### Claude's Discretion

- Exact CSS/Tailwind tokens for picker chrome (border, focus ring, dropdown shadow). UI-SPEC step (recommended next) or planner picks per existing admin UI conventions.
- Exact keyboard interaction model (↑/↓ to navigate, Enter to add, Esc to close, Backspace on empty input to remove last chip). Planner picks; researcher should verify any chosen lib approach (e.g. Headless UI / Radix Combobox) is already a dep or stays plain-React.
- Exact debounce / search algorithm shape (substring vs token-AND vs fuzzy). Default to case-insensitive substring against name/email/division joined as one searchable string.
- Whether the picker pre-fetches on tab mount or on first focus. Default: tab mount (the `/api/admin/prime-users` payload is small, ~30 records).
- Exact tooltip mechanism (native `title` vs an actual tooltip component). Default: native `title` to avoid pulling a tooltip lib for one use site.
- Exact wire format of the inactive-user (`status !== 'active'`) handling — visual grey-out in picker results vs filtering them out entirely. Default: include in results, tag visually (planner / UI-SPEC decides).

### Deferred Ideas (OUT OF SCOPE)

- Bulk cleanup UI for stale entries (count per group, top-of-tab "Clean up" panel)
- Visual badge / amber styling for "Not in Prime" entries
- Per-instance picker refresh button
- Server-side audit join
- Dedicated Admin → Directory subtab
- `ALL_PAGES` ↔ Sidebar nav drift cleanup (v2 NAV-DRIFT)
- Removing hardcoded admin email fallback (v2 BOOTSTRAP-01)
- Server-side enforcement of page visibility (v2 ENFORCE)
- Audit trail for admin config changes (v2 ADMIN-AUDIT)
- Rule-based groups
- Migrating group membership storage from email-keyed to Prime-id-keyed
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **ADMIN-01** | Replace "Dashboard Admins" textarea with searchable Prime user picker | D-02 picker contract; existing target at `app/admin/page.tsx:285-307`; admin emails currently a `<textarea>` with line/comma split; replaced by `<PrimeUserPicker>` driving the same `adminEmailsRaw → admins` flow. |
| **ADMIN-02** | Replace existing group member editing UI with multi-select Prime user picker | D-02/D-04 contract; existing target at `app/admin/page.tsx:457-490` (`GroupCard` textarea); replaced by chip-row + inline picker; D-07 styling. |
| **ADMIN-03** | New Group creation form uses the same multi-select picker for initial members | Existing target at `app/admin/page.tsx:329-362` (form with `newGroupEmails` textarea); same `<PrimeUserPicker>` instance. |
| **ADMIN-04** | Picker rows display name + email + division; typeahead filters all three fields | D-03 filter scope; D-06 two-line row pattern; existing `app/search/page.tsx:91-95` is the prior-art for `.toLowerCase().includes()` filter. |
| **ADMIN-05** | Preserve and allow removal of group/admin entries for emails no longer in Prime directory | D-08 email-only fallback; D-09 tooltip; D-10 per-row `[×]` remains the only mechanism. |
| **DISPLAY-01** | Group member lists render name + division (email secondary); fallback to email | D-06 two-line pattern; D-15 cascade utility (`lib/identity-display.ts` proposed) supplies the resolved row. |
| **DISPLAY-02** | Dashboard Admins list renders the same way | D-07 mirrors group rows; identical cascade utility. |
| **DISPLAY-03** | Audit log entries show Prime display name (fallback to email) | D-14 client-side join; D-15 three-step cascade; D-17 CSV export gets `Display Name` column; existing render target at `app/admin/page.tsx:626-635`. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These constraints carry the same authority as locked CONTEXT.md decisions. Plans MUST honor them.

| Constraint | Source | Phase 3 Implication |
|------------|--------|---------------------|
| Brownfield-aware — prefer editing existing files & patterns | CLAUDE.md "Ways of Working" | Picker should reuse existing Tailwind tokens, `useAuth()`, `lib/page-visibility.ts` types — no parallel structures. |
| `VisibilityConfig` blob schema is load-bearing | CLAUDE.md + D-21 | NO changes to `admins: string[]` or `groups[].members: string[]`. |
| Cron jobs are live (vercel.json) | CLAUDE.md | Phase 3 adds NO cron entries. The picker is admin-on-demand. |
| Cache before you call Prime — 5,000/day shared budget | CLAUDE.md | Picker MUST read from cached blob via `getAllPrimeUsers()`; never call `primeGet('/users')` directly. |
| Pages are client components fetching `/api/prime/*` | CLAUDE.md | Picker is client component; its data endpoint is `/api/admin/prime-users`. |
| New pages must register in `lib/page-visibility.ts ALL_PAGES` AND Sidebar nav | CLAUDE.md | Phase 3 adds **no new pages** — only refactors `/admin`. NAV-DRIFT cleanup is explicitly deferred. |
| Component naming: PascalCase in `components/ui/` | CLAUDE.md | `PrimeUserPicker.tsx` (PascalCase) — confirmed by D-02. |
| Utility files: kebab-case in `lib/` | CLAUDE.md | Cascade utility = `lib/identity-display.ts` (kebab-case). |
| Error handling: log internally with full detail, return generic user-facing messages | CLAUDE.md | New `/api/admin/prime-users` route logs `[admin-prime-users]` server-side, returns 401/403 generic messages. |
| `[namespace]` log prefix | CONVENTIONS.md | New endpoint uses `[admin-prime-users]` (matches `[prime-users]`, `[session]`, `[audit]`). |
| Named exports preferred (default only for Next.js page files) | CONVENTIONS.md | `<PrimeUserPicker>` is a named export. `app/admin/visibility-tab.tsx` and `audit-tab.tsx` exports are named (these are not page files — `app/admin/page.tsx` keeps the default export). |
| Strict mode TypeScript, ESLint enforced in builds | CONVENTIONS.md | All new code must compile under strict mode and pass `next lint`. |
| Email normalization: `.trim().toLowerCase()` on store and compare | Phase 1 D-09 + login route convention | Picker writes lowercased emails into `VisibilityConfig`; manual-email fallback (D-12) MUST normalize before persisting. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read Prime users for picker | API / Backend (`/api/admin/prime-users`) | Browser (component fetches) | Auth gate is server-only; cache (`getAllPrimeUsers()`) is server-only. Browser cannot reach Prime directly. |
| Filter Prime users by query | Browser (component) | — | List is small (~30); filter on every keystroke is cheap; round-tripping kills typeahead UX. |
| Render two-line user row | Browser (component) | — | Pure JSX — no server work. |
| Resolve email → display name (cascade) | Browser (`lib/identity-display.ts` callable from client) | — | Audit tab and picker rows both consume the same cached `PrimeUser[]`; cascade is pure-function and works in both contexts. |
| Persist VisibilityConfig changes | API / Backend (`/api/admin/page-visibility` POST — UNCHANGED) | — | Existing endpoint; D-05 locks the contract. |
| Refresh Prime cache | API / Backend (`/api/admin/prime-users/refresh` — UNCHANGED) | Browser (button click) | Phase 1 endpoint; Phase 3 only consumes it. |
| Read audit log | API / Backend (`/api/audit/entries` — UNCHANGED) | Browser | Existing endpoint already admin-gated and email-filterable. |

**Tier sanity check:** No Phase 3 capability is misassigned. The picker filter is browser-tier (correct — typeahead requires zero-latency on every keystroke); the auth gate is API-tier (correct — admin check must not be client-spoofable); the cascade utility is browser-tier (correct — both consumers are client components reading the same fetched list).

## Standard Stack

This phase introduces ZERO new dependencies. All work uses libraries already in `package.json` (verified 2026-04-25 via `Read` of package.json).

### Core (already installed — verified)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^18 | Component logic, hooks, refs | Existing project core [VERIFIED: package.json:26] |
| next | 14.2.35 | App Router, route handlers, client/server boundary | Existing project core [VERIFIED: package.json:22] |
| typescript | ^5 | Strict-mode types | Existing project core [VERIFIED: package.json:38] |
| tailwindcss | ^3.4.1 | Styling — utility classes | Existing project core [VERIFIED: package.json:37] |
| lucide-react | ^0.577.0 | Icons (existing usage: `RefreshCw`, `Plus`, `Trash2`, `Search`, etc.) | Existing project core [VERIFIED: package.json:21] |
| iron-session | ^8.0.4 | Session reading via `getSession()` for new endpoint auth | Existing project core [VERIFIED: package.json:19] |
| @vercel/blob | ^2.3.1 | (Indirect — via `lib/blob-cache.ts` already used by `getAllPrimeUsers()`) | Existing project core [VERIFIED: package.json:16] |
| vitest | ^4.1.5 | Test runner (Phase 1 + 2 baseline) | Test harness, already wired [VERIFIED: package.json:39] |
| vite-tsconfig-paths | ^6.1.1 | `@/` alias in vitest | Existing test config [VERIFIED: package.json:40, vitest.config.ts:2] |

### Alternatives Considered (and rejected)

| Instead of | Could Use | Tradeoff | Why rejected |
|------------|-----------|----------|--------------|
| Plain React combobox | `@headlessui/react` Combobox | Built-in a11y, ARIA roles, keyboard handling | Not in `package.json` [VERIFIED]. D-02 says "no new lib unless already a dep". List is ~30 rows; ARIA combobox roles are 4 attributes we can add manually. |
| Plain React combobox | `cmdk` (Vercel command palette) | Modern primitive, used by shadcn | Not in deps [VERIFIED]. Modal/popover-shaped — fights D-01 inline-everything decision. |
| Plain React combobox | `react-select` | Mature, multi-select built-in | Not in deps [VERIFIED]. Heavy (~25KB gzipped); D-02 prohibits new deps; styling needs heavy Tailwind override. |
| Native `title` tooltip | `@radix-ui/react-tooltip` | Better positioning, ARIA | Not in deps [VERIFIED]. CONTEXT.md "Claude's Discretion" defaults to native `title`. |
| `lib/identity-display.ts` cascade | Inline ternaries everywhere | Avoid one new file | Three call sites + tests need the same logic. Single utility = single test file. Convention requires kebab-case `.ts` in `lib/`. |
| `app/admin/visibility-tab.tsx` extraction | Keep all 793 lines in `page.tsx` | Smaller diff | CONCERNS.md flags 793-line file as tech debt; D-20 mandates split; new picker code lands in the smaller dedicated file. |

**Installation:** No `npm install` required. Phase 3 ships zero new package.json changes.

**Version verification (2026-04-25):**
```bash
# These commands were not run in research because no version is being added.
# package.json declares the versions consumed; vitest run already passes against them.
```

## Architecture Patterns

### System Architecture Diagram

```
                     ┌──────────────────────────────────────────┐
                     │  Admin (admin user logged in)            │
                     └────────────────┬─────────────────────────┘
                                      │  (browser)
                ┌─────────────────────┼─────────────────────────────┐
                │                     │                             │
                ▼                     ▼                             ▼
   ┌─────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐
   │  page.tsx       │  │  visibility-tab.tsx      │  │  audit-tab.tsx           │
   │  (tab router)   │  │  - admin emails picker   │  │  - audit table           │
   │                 │  │  - groups + GroupCards   │  │  - cascade-resolved rows │
   │  uses useAuth() │  │  - new group form        │  │  - CSV export (D-17)     │
   └─────────────────┘  │  - refresh button (D-13) │  │                          │
                        │  - save button (D-05)    │  │  fetches BOTH:           │
                        │                          │  │   /api/admin/prime-users │
                        │  fetches:                │  │   /api/audit/entries     │
                        │   /api/admin/prime-users │  │                          │
                        └────────┬─────────────────┘  └────────────┬─────────────┘
                                 │                                 │
                                 ▼  consumes                       ▼  consumes
                  ┌────────────────────────────┐    ┌──────────────────────────┐
                  │ <PrimeUserPicker>          │    │ resolveDisplayName(email,│
                  │ (components/ui/...)        │    │   primeUsers, fallback)  │
                  │                            │    │ (lib/identity-display.ts)│
                  │ - input + filter list      │    │                          │
                  │ - chip row                 │    │ Cascade (D-15):          │
                  │ - keyboard handlers        │    │  1. live primeUser.full  │
                  │ - manual-email fallback    │    │  2. entry.name (audit)   │
                  │   (D-12)                   │    │  3. raw email            │
                  └─────────┬──────────────────┘    └──────────────────────────┘
                            │  also uses cascade for two-line rows
                            ▼
                  ┌────────────────────────────────┐
                  │ filterPrimeUsers(query, users) │
                  │ (pure function inside picker)  │
                  │  case-insensitive substring on │
                  │  fullName + email + division   │
                  └────────────────────────────────┘

   ┌──────────────────────────────────────── server boundary ────────────────────────────────┐

   ┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────────┐
   │ GET /api/admin/          │  │ POST /api/admin/         │  │ GET /api/audit/entries       │
   │   prime-users            │  │   prime-users/refresh    │  │ (UNCHANGED - existing)       │
   │ (NEW — D-11)             │  │ (Phase 1 — UNCHANGED)    │  │                              │
   │                          │  │                          │  │ - admin gate                 │
   │ Two-gate auth:           │  │ Two-gate auth (mirror)   │  │ - reads audit blob           │
   │  1. session.userEmail    │  │                          │  │ - filter by action/range     │
   │  2. isAdminEmail()       │  │ Calls refreshPrimeUsers  │  │                              │
   │                          │  │ (admin reason)           │  └──────────────────────────────┘
   │ Calls getAllPrimeUsers() │  │                          │
   │ + reads blob metadata    │  │ Returns userCount,       │
   │ for lastSuccessAt/Error  │  │ durationMs, cachedAt     │
   └────────────┬─────────────┘  └────────────┬─────────────┘
                │                             │
                ▼                             ▼
        ┌────────────────────────────────────────────────┐
        │ lib/prime-users.ts (Phase 1 — UNCHANGED)       │
        │  - getAllPrimeUsers(): PrimeUser[]             │
        │  - PrimeUserDirectoryBlob (lastSuccessAt etc.) │
        └─────────────────┬──────────────────────────────┘
                          │
                          ▼
                ┌──────────────────────┐
                │ Vercel Blob:         │
                │ shbr-admin/          │
                │   prime-users.json   │
                └──────────────────────┘
```

**Reading the diagram:** Data flows top-to-bottom. The browser owns filter+render+cascade (cheap, list ≤ ~30); the API owns auth and cache reads. The new GET endpoint and the cascade utility are the only net-new server/lib code; everything else is component refactor inside `app/admin/`.

### Component Responsibilities

| Component | File | Status | Responsibility |
|-----------|------|--------|----------------|
| `AdminPage` | `app/admin/page.tsx` | **Modified** (shrunk to ~125 lines) | Tab router only. Imports `VisibilityTab`, `AuditTab`, `ChangelogTab`. |
| `VisibilityTab` | `app/admin/visibility-tab.tsx` | **NEW** (extracted) | Hosts `GroupCard`, picker call sites, refresh button, save button. |
| `AuditTab` | `app/admin/audit-tab.tsx` | **NEW** (extracted) | Hosts `ActionBadge`, `formatAEDT`, `exportCSV`, fetches `/api/admin/prime-users` for cascade. |
| `ChangelogTab` | `app/admin/page.tsx` (stays) | **Unchanged** | Out-of-scope for D-20. Moving it is gratuitous diff (planner decision per "should we extract Changelog too?" — researcher recommends NO, see Pitfall #3). |
| `<PrimeUserPicker>` | `components/ui/PrimeUserPicker.tsx` | **NEW** | Shared picker for all 3 surfaces. Owns input, filter, list, chip row, keyboard handlers, manual-email fallback. |
| `GroupCard` | `app/admin/visibility-tab.tsx` | **Modified** (was textarea, becomes chip-row + picker) | Renders one group's chip row + inline picker. |
| `<RefreshButton>` | inline in `visibility-tab.tsx` (D-13) | **NEW (small)** | Calls `POST /api/admin/prime-users/refresh`, displays metadata. Could be its own file but discretion: inline first, extract if reused. |
| `resolveDisplayName(...)` | `lib/identity-display.ts` | **NEW** (~30 lines) | Pure function: 3-step cascade utility (D-15), consumed by picker rows + audit rows. |
| `filterPrimeUsers(query, users)` | `components/ui/PrimeUserPicker.tsx` (exported for tests) | **NEW** | Pure function: case-insensitive substring match across `fullName + email + division`. |
| `GET /api/admin/prime-users` | `app/api/admin/prime-users/route.ts` | **NEW** | Two-gate auth, returns `{ users, lastSuccessAt, lastError }`. |

### Recommended Project Structure

```
app/
├── admin/
│   ├── page.tsx              # Modified: tab router only (was 793 lines, now ~125)
│   ├── visibility-tab.tsx    # NEW: VisibilityTab + GroupCard + helpers
│   └── audit-tab.tsx         # NEW: AuditTab + ActionBadge + exportCSV + formatAEDT
├── api/
│   └── admin/
│       └── prime-users/
│           ├── route.ts      # NEW: GET handler (D-11)
│           └── refresh/
│               └── route.ts  # UNCHANGED (Phase 1)
components/
└── ui/
    └── PrimeUserPicker.tsx   # NEW: shared picker, exports PrimeUserPicker + filterPrimeUsers
lib/
└── identity-display.ts       # NEW: resolveDisplayName cascade utility
```

### Pattern 1: Plain-React Combobox (no library)

**What:** A controlled input + filtered list + keyboard navigation, owned by the component.

**When to use:** Lists ≤ ~100 rows, single use site (or wrapped as a shared component). Avoids dependency cost.

**Why this works for Phase 3:** ~30 Prime users; substring filter on every keystroke is sub-millisecond; no virtualization needed (see Performance below). Keyboard model is 4 keys (↑/↓/Enter/Esc) plus Backspace-on-empty for chip removal.

**Source:** [VERIFIED: existing pattern in `app/search/page.tsx:91-95`] — case-insensitive `.toLowerCase().includes()` filter is already the codebase idiom.

**Skeleton (illustrative, planner finalizes):**
```tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import type { PrimeUser } from '@/lib/prime-users';

export interface PrimeUserPickerProps {
  selectedEmails: string[];
  availableUsers: PrimeUser[];
  onChange: (emails: string[]) => void;
  multi?: boolean;
  placeholder?: string;
}

// Pure function — exported for vitest co-located coverage (D-18).
export function filterPrimeUsers(query: string, users: PrimeUser[]): PrimeUser[] {
  const q = query.trim().toLowerCase();
  if (!q) return users;
  return users.filter(u =>
    u.fullName.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.division ?? '').toLowerCase().includes(q)
  );
}

export function PrimeUserPicker({
  selectedEmails, availableUsers, onChange, multi = true, placeholder
}: PrimeUserPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = filterPrimeUsers(query, availableUsers)
    .filter(u => !selectedEmails.includes(u.email));

  // Clamp activeIndex when filter shrinks
  useEffect(() => { setActiveIndex(0); }, [query]);

  function add(email: string) {
    onChange(multi ? [...selectedEmails, email] : [email]);
    setQuery('');
    setActiveIndex(0);
  }

  function remove(email: string) {
    onChange(selectedEmails.filter(e => e !== email));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter')     { e.preventDefault(); if (filtered[activeIndex]) add(filtered[activeIndex].email); }
    else if (e.key === 'Escape')    { setOpen(false); }
    else if (e.key === 'Backspace' && query === '' && selectedEmails.length > 0) {
      remove(selectedEmails[selectedEmails.length - 1]);
    }
  }

  // Render: chip row → input → filtered list (when open && filtered.length>0)
  // Each row uses two-line (D-06) — see resolveDisplayName usage below.
}
```

**Accessibility (a11y):** Add ARIA roles even without a library. Recommended pattern from MDN/W3C ARIA Authoring Practices Guide [CITED: w3.org/WAI/ARIA/apg/patterns/combobox/]:
- Input: `role="combobox" aria-expanded={open} aria-controls={listId} aria-activedescendant={activeRowId}`
- List: `role="listbox" id={listId}`
- Each row: `role="option" id={...} aria-selected={i===activeIndex}`

This is 4 attributes — not worth a library, but worth doing right.

### Pattern 2: Two-Line Row Render (DISPLAY-01, DISPLAY-02)

**What:** A row component that renders Line 1 (primary) and Line 2 (secondary) per D-06.

**Source for tokens:** [VERIFIED: Phase 2 02-UI-SPEC.md] — `text-sm` size, `text-gray-300` primary, `text-gray-500` secondary.

**Verified against current `app/admin/page.tsx`:** The audit table at line 626-635 ALREADY uses this pattern: `text-gray-300` for primary, `text-gray-600` for secondary email. Phase 3 standardizes to `text-gray-500` (matching Phase 2 UI-SPEC) — minor visual change.

```tsx
// Skeleton — Tailwind tokens locked by Phase 2 UI-SPEC, lifted here verbatim
<div className="text-sm">
  <div className="text-gray-300">{primary}</div>      {/* fullName || email */}
  <div className="text-gray-500 text-xs">             {/* always present */}
    {email}
    {division && <span className="text-gray-600"> · {division}</span>}
  </div>
</div>
```

For unresolved emails (D-08), render only line 1 with `email` and `title="No Prime record found"` on the wrapper.

### Pattern 3: Three-Step Cascade Utility (D-15)

**What:** Pure function resolving an email to a display name via three fallback layers.

**File:** `lib/identity-display.ts` (new, kebab-case per CONVENTIONS.md).

```ts
import type { PrimeUser } from '@/lib/prime-users';

/**
 * D-15 three-step actor cascade.
 *
 * Layer 1: live Prime fullName (from refreshed user list)
 * Layer 2: snapshot name on the audit/auth row (cookie-time userName)
 * Layer 3: bare email
 *
 * Defensive: treats empty / whitespace-only strings at each layer as missing.
 * Used by both <PrimeUserPicker> rows AND audit tab rows.
 */
export function resolveDisplayName(
  email: string,
  primeUsers: PrimeUser[],
  fallbackName?: string | null
): string {
  const normalised = email.trim().toLowerCase();
  const live = primeUsers.find(u => u.email === normalised);
  if (live?.fullName?.trim()) return live.fullName.trim();
  if (fallbackName?.trim()) return fallbackName.trim();
  return email;
}

/**
 * Returns true when the email could NOT be matched in the live directory —
 * the row should render with the "No Prime record found" tooltip (D-09).
 */
export function isUnresolvedEmail(email: string, primeUsers: PrimeUser[]): boolean {
  const normalised = email.trim().toLowerCase();
  return !primeUsers.find(u => u.email === normalised);
}

/** Returns the matched PrimeUser (or null) — for callers that need division. */
export function findPrimeUser(email: string, primeUsers: PrimeUser[]): PrimeUser | null {
  const normalised = email.trim().toLowerCase();
  return primeUsers.find(u => u.email === normalised) ?? null;
}
```

**Test cases (D-18):**
- live name hit → returns `primeUser.fullName.trim()`
- live name empty/whitespace → falls through to `fallbackName`
- live name absent + `entry.name` present → returns `entry.name.trim()`
- live name absent + `entry.name` absent → returns email verbatim
- whitespace-only email → returns email verbatim (no normalization on output)
- mixed-case email input → matches lowercase Prime emails (D-09 invariant)

### Pattern 4: Two-Gate Admin Auth (mirror Phase 1)

**Verified [VERIFIED: app/api/admin/prime-users/refresh/route.ts]** — exact ordering and shape:

```ts
// Gate 1: authenticated session?
const session = await getSession();
if (!session.userEmail) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Gate 2: admin?
const config = await getVisibilityConfig();
if (!isAdminEmail(session.userEmail, config)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Notes for the new GET endpoint:**

- The refresh route checks `session.userEmail` (not `session.accessToken`). The page-visibility GET checks `session.accessToken` (line 16). The audit/entries route checks BOTH (line 12). **Recommendation: mirror the refresh route exactly** since CONTEXT.md D-11 explicitly says so. This is a known minor inconsistency in the codebase — Phase 3 should not introduce a fourth pattern.
- Module-level exports: `export const runtime = 'nodejs'`, `export const maxDuration = 60`, `export const dynamic = 'force-dynamic'` — copy from refresh route.
- Log prefix: `[admin-prime-users]` for any internal errors. Existing prefixes in the codebase (verified): `[prime-users]`, `[session]`, `[audit]`, `[page-visibility]`. New prefix follows the same pattern.

**Response shape (D-11):**
```ts
{
  users: PrimeUser[],
  lastSuccessAt: string | null,
  lastError: string | null
}
```

The `lastSuccessAt` and `lastError` come from reading the directory blob directly. Currently `getAllPrimeUsers()` returns only the `users[]` slice — the blob also contains metadata. Two implementation options for the planner:

1. **Extend `lib/prime-users.ts`** with a new exported `getDirectoryMetadata()` reader (clean but D-22 says "no changes to Phase 1 modules" for **read-only references** — adding a new export is a judgment call). Recommendation: **acceptable**, since D-22's intent is "don't modify behavior" and adding a new function violates neither contract nor existing tests.
2. **Read the blob directly in the route handler** via `getCached<PrimeUserDirectoryBlob>('shbr-admin/prime-users.json')`. Couples the route to the blob key. Avoids touching `lib/prime-users.ts`.

**Recommendation:** Option 1 — add `getDirectoryMetadata(): Promise<{ lastSuccessAt: string | null; lastError: string | null }>` to `lib/prime-users.ts` as a read-only export. Lowest coupling, highest testability, smallest contract change. Test alongside Phase 1 patterns. Discuss with planner if D-22 should be amended (low risk; no Phase 1/2 behavior changes).

### Pattern 5: CSV Export Extension (D-17)

**What:** Add a "Display Name" column to the audit log CSV.

**Existing code:** [VERIFIED: app/admin/page.tsx:518-531] — a private `exportCSV()` function that builds CSV inline (does NOT use `lib/export-csv.ts:downloadCSV`):

```ts
function exportCSV(entries: AuditEntry[]) {
  const headers = ['Timestamp (AEDT)', 'Email', 'Name', 'Action'];
  const rows = entries.map(e => [formatAEDT(e.timestamp), e.email, e.name || '', e.action]);
  // ... CSV escaping + download
}
```

**Discovery:** `lib/export-csv.ts:downloadCSV` exists and is used by 9 other pages, but the admin tab uses an inline implementation. **Two options for the planner:**

1. **Replace inline `exportCSV` with `downloadCSV` call.** Aligns with codebase convention (CSV-via-shared-helper). Smallest diff: 14 lines → 4 lines.
2. **Keep inline; just add the column.** Smallest behavioral diff. Misses the convention alignment win.

**Recommendation:** Option 1 — replace with `downloadCSV` and add the new column. The two implementations have identical CSV-escaping behavior (verified: both use `replace(/"/g, '""')`); switching is risk-free.

**New column:**
```ts
const headers = ['Timestamp (AEDT)', 'Email', 'Display Name', 'Action'];
const rows = entries.map(e => [
  formatAEDT(e.timestamp),
  e.email,
  resolveDisplayName(e.email, primeUsers, e.name),  // D-15 cascade
  e.action,
]);
```

The cascade matches the on-screen rendering — "Display Name" reflects what the admin sees, not what was snapshotted at login.

### Anti-Patterns to Avoid

- **Inline-fetching `getAllPrimeUsers()` in a server component every render.** Phase 3 stays client-component (matches the existing `'use client'` admin page). All Prime data flows through `/api/admin/prime-users`. Don't try to RSC this — it conflicts with the existing `useAuth()` consumption pattern.
- **Calling `/api/admin/prime-users/refresh` from page mount.** That endpoint forces a Prime API hit (one of the 5,000/day budget). It's the explicit refresh button (D-13) only.
- **Putting the cascade inline in JSX.** D-15 needs the same logic in 4 places (picker rows, group rows, admin rows, audit rows). Extract first, render second. Saves ~30 lines per call site and makes the test target trivial.
- **Adding a 4th admin-auth pattern.** The codebase already has three slightly different two-gate patterns (refresh-route, page-visibility-route, audit-entries-route). Mirror **refresh-route** exactly per D-11.
- **Migrating `app/admin/page.tsx` ChangelogTab as part of D-20.** D-20 names only `VisibilityTab` and `AuditTab`. ChangelogTab has zero dependency on Phase 3 work; moving it expands diff and review surface for no value. Defer.
- **Storing `availableUsers` in `<PrimeUserPicker>` itself.** Picker stays dumb; parent (`VisibilityTab` or `AuditTab`) owns the fetch. This means one fetch on tab mount, three picker instances share the result via prop drilling — perfectly fine for ~30 records.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email normalization | Per-component `toLowerCase()` | `.trim().toLowerCase()` directly inline (1 line) — codebase pattern (Phase 1 D-09) | Already a documented invariant; a "normalizer utility" is overkill for two characters of work. |
| Admin authentication | Re-implement session+admin check | `getSession()` + `getVisibilityConfig()` + `isAdminEmail()` (mirror refresh route) | All three exist; CONTEXT.md D-11 mandates mirroring. |
| CSV escaping | Inline `replace(/"/g, '""')` | `lib/export-csv.ts:downloadCSV` | Used by 9 other pages; identical escaping behavior verified. |
| Tab routing | New tab management lib | Existing `useSearchParams() + router.replace()` (lines 50-82 of `app/admin/page.tsx`) | Already works; D-20 explicitly preserves the page-as-tab-router shape. |
| Toast / save feedback | New toast lib | Existing inline `<div>` toast (line 273-282) | Already lives in VisibilityTab; preserved on extraction. |
| Loading spinner | New spinner | `<Loader2>` from `lucide-react` (already imported) | Existing pattern at line 253. |
| `formatRelative()` (5 days ago, etc.) | Net-new helper | **Copy + extend** the existing one in `components/ui/DataRefreshButton.tsx:24-32` | Existing helper covers minutes/hours; D-13 needs days. Recommendation: extract+extend to `lib/format-relative.ts` (kebab-case) so picker (`Refreshed 5 days ago`) and the existing button can share it. **Caveat:** This is a small new lib — but it's a refactor of existing code, not net-new dependency surface. |

**Key insight:** Phase 3 is heavy on UI assembly, light on novel logic. The novel pieces (filter, cascade, two-line row) are 5–30 lines each and trivially testable. Almost everything else is "copy the existing pattern."

## Runtime State Inventory

> Phase 3 is greenfield UI work. It does not rename, refactor by string-replace, or migrate stored identifiers. The categories below are answered explicitly to confirm no hidden runtime state is at risk.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — VisibilityConfig blob schema unchanged (D-21). Audit blob schema unchanged (D-22). PrimeUser blob unchanged. | None |
| Live service config | None — no n8n/Datadog/Tailscale equivalents in this stack. Vercel Cron entries unchanged (`vercel.json` not touched). | None |
| OS-registered state | None — no Task Scheduler / launchd / systemd usage in this Vercel-hosted stack. | None |
| Secrets / env vars | None — no new env vars introduced. New endpoint reads same `BLOB_READ_WRITE_TOKEN` and `SESSION_SECRET` as existing routes. | None |
| Build artifacts | None — pure source-file additions/refactors. No package.json changes, no compiled binaries, no Docker images. | None |

**Verified by:** code-level read of `package.json`, `vercel.json` references in CLAUDE.md, blob storage usage in `lib/blob-cache.ts`, all admin route handlers.

## Common Pitfalls

### Pitfall 1: VisibilityConfig blob schema drift (D-21)

**What goes wrong:** Picker emits `{ email, fullName, division }` objects into `groups[].members` instead of `string[]`.

**Why it happens:** The picker UI thinks in terms of `PrimeUser` objects but the blob stores email-only arrays. A planner unfamiliar with the constraint might "improve" the schema along the way.

**How to avoid:** Picker `onChange` returns `string[]` (lowercase emails). All `PrimeUser` shape is purely view-time state. The blob schema is read-only across all of Phase 3 (D-21 + Project Constraint).

**Warning signs:** Build error in `lib/page-visibility.ts:saveVisibilityConfig` from type mismatch. Production blob fails to deserialize on next admin login (`groups[].members.map(m => m.toLowerCase())` throws). Fix: stop, revert schema change.

### Pitfall 2: Manual-email fallback (D-12) bypasses normalization

**What goes wrong:** Admin types `Jane@SHBR.com  ` with trailing space; saved as-is; never matches Prime cache after refresh.

**Why it happens:** Manual-fallback code path looks like a one-liner `setEmails([...emails, raw])` and skips the `.trim().toLowerCase()` invariant.

**How to avoid:** Manual fallback MUST normalize on insert: `setEmails([...emails, raw.trim().toLowerCase()])`. Test case: typing mixed-case + whitespace fallback email matches a Prime user on the next refresh.

### Pitfall 3: D-20 split scope creep

**What goes wrong:** Planner extracts `ChangelogTab` too, expanding the diff by ~80 lines for no in-scope value.

**Why it happens:** "Splitting `app/admin/page.tsx`" sounds like "split everything." D-20 explicitly names only Visibility and Audit tabs.

**How to avoid:** Plan tasks should split ONLY the two tabs D-20 names. ChangelogTab stays at the bottom of `app/admin/page.tsx`. The page is no longer 793 lines after the two extractions; ChangelogTab can be future cleanup.

**Warning signs:** Plan title says "Extract all tabs from admin page." Reject and re-scope.

### Pitfall 4: 3rd admin-auth pattern (D-11 says mirror Phase 1)

**What goes wrong:** New GET endpoint copies the audit-entries 401-or-404 pattern (which uses 404 for "not admin" — a deliberate stealth response) instead of the refresh-route 401/403 pattern.

**Why it happens:** Three existing patterns differ subtly:
- `refresh/route.ts`: 401 unauth, 403 not-admin
- `page-visibility/route.ts`: 401 unauth, 403 not-admin (similar but checks `accessToken`)
- `audit/entries/route.ts`: 401 unauth, **404** not-admin (stealth)

**How to avoid:** D-11 says "mirror `refresh/route.ts`." Use 401/403, check `session.userEmail` (not `accessToken`). Tests should assert exact status codes (D-18 says so).

### Pitfall 5: PrimeUser fullName whitespace (Phase 2 D-10 invariant)

**What goes wrong:** A Prime record with `fullName: '  '` (whitespace-only) makes the picker primary line render as a blank string instead of falling back to email.

**Why it happens:** Truthy check (`primeUser.fullName ? ... : email`) treats whitespace-only as truthy.

**How to avoid:** Always `.trim()` before truthiness check: `primeUser.fullName?.trim() || email`. The cascade utility (`lib/identity-display.ts`) already does this. **Test:** include a whitespace-only `fullName` in the cascade test fixture.

**Warning signs:** Picker rows show blank primary line for some users. Fix: confirm cascade utility is being used, not inline ternaries.

### Pitfall 6: Audit tab fetches `/api/admin/prime-users` but renders before fetch resolves

**What goes wrong:** First render of the audit table shows bare emails (cascade has no `primeUsers` yet); a 100ms-later second render shows full names. Visible flicker.

**Why it happens:** D-14 specifies client-side resolution; the fetch is async; Vitest doesn't catch this (no DOM in node env).

**How to avoid:** Either (a) defer rendering the table until the picker-data fetch resolves (loading spinner), or (b) accept the flicker and document it. CONTEXT.md hints at (b) by describing this as a "graceful" pattern. Recommendation: **(a) — match the existing `setLoading(true)` pattern** at the top of the audit tab; the spinner is already there.

**Warning signs:** Manual UAT shows audit rows render emails first then update. Acceptable per D-14 wording, but better UX with loading guard.

### Pitfall 7: Module-import cycle when extracting tabs

**What goes wrong:** `app/admin/page.tsx` imports from `app/admin/visibility-tab.tsx`; `visibility-tab.tsx` imports types/helpers that turn out to live in `page.tsx`. Circular module dependency.

**Why it happens:** `Tab` type, `slugify`, `pageGroups`, `EMPTY_CONFIG`, `TABS` are all defined at module level in `page.tsx` today.

**How to avoid:** During extraction, move shared types/helpers to a third file (`app/admin/admin-types.ts` or similar) OR duplicate the small ones (e.g., `slugify` is 1 line; can live in `visibility-tab.tsx` only — it's only used there). Audit which symbols cross the cut line BEFORE writing tasks.

**Verified cut-line audit (2026-04-25):**
- `Tab` type: used by `page.tsx` only (router state) — stays in `page.tsx`.
- `TABS` const: used by `page.tsx` only — stays.
- `slugify`: used by `VisibilityTab` only (group ID generation) — moves to `visibility-tab.tsx`.
- `pageGroups`: used by `VisibilityTab` only — moves to `visibility-tab.tsx`.
- `EMPTY_CONFIG`: used by `VisibilityTab` only — moves to `visibility-tab.tsx`.
- `formatAEDT`, `ActionBadge`, `exportCSV`: used by `AuditTab` only — moves to `audit-tab.tsx`.
- `ChangelogTab`, `TYPE_CONFIG`, `TypeBadge`, `DaySection`, `GITHUB_REPO`: out-of-scope — stays in `page.tsx`.

No circular import after split. Confirmed.

### Pitfall 8: `getAllPrimeUsers()` triggers a Prime API call on first GET

**What goes wrong:** First time an admin opens the Visibility tab on a fresh deployment, the new `GET /api/admin/prime-users` ends up calling Prime (because `getAllPrimeUsers()` first-miss bootstraps per Phase 1 D-03).

**Why it happens:** D-03 first-miss is a feature, not a bug. The first call writes the cache; subsequent calls are free.

**How to avoid (prevent surprise):** Document this in the plan — first admin to load the picker after a deploy WILL incur one Prime call. Subsequent calls are blob-only. Acceptable per Phase 1 design. Test case: vitest mock of `getAllPrimeUsers()` is enough; don't try to test the first-miss in the GET route's own tests (Phase 1 already did).

## Code Examples

### Example 1: GET /api/admin/prime-users handler (D-11)

```ts
// app/api/admin/prime-users/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';
import { getAllPrimeUsers, getDirectoryMetadata } from '@/lib/prime-users';
// ^^ getDirectoryMetadata is the proposed new export (see Pattern 4 notes)

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session.userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getVisibilityConfig();
  if (!isAdminEmail(session.userEmail, config)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [users, metadata] = await Promise.all([
      getAllPrimeUsers(),
      getDirectoryMetadata(),
    ]);
    return NextResponse.json({
      users,
      lastSuccessAt: metadata.lastSuccessAt,
      lastError: metadata.lastError,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[admin-prime-users]', e);
    return NextResponse.json({ users: [], lastSuccessAt: null, lastError: 'Internal error' }, { status: 500 });
  }
}
```

**Test scaffold (D-18 — mirror Phase 1 refresh route test):**
```ts
// app/api/admin/prime-users/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/page-visibility', () => ({ getVisibilityConfig: vi.fn(), isAdminEmail: vi.fn() }));
vi.mock('@/lib/prime-users', () => ({ getAllPrimeUsers: vi.fn(), getDirectoryMetadata: vi.fn() }));
import { GET } from './route';
// ... unauthenticated → 401, non-admin → 403, admin → 200 + body shape ...
```

### Example 2: VisibilityTab refresh button (D-13)

```tsx
// app/admin/visibility-tab.tsx — refresh button skeleton
import { useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { formatRelative } from '@/lib/format-relative';   // proposed shared helper

function RefreshButton({ onSuccess }: { onSuccess: (users: PrimeUser[]) => void }) {
  const [status, setStatus] = useState<{ kind: 'idle' } | { kind: 'busy' } | { kind: 'ok'; userCount: number; durationMs: number; cachedAt: string } | { kind: 'err'; error: string; lastSuccessAt: string | null }>({ kind: 'idle' });

  async function handleClick() {
    setStatus({ kind: 'busy' });
    const res = await fetch('/api/admin/prime-users/refresh', { method: 'POST' });
    const body = await res.json();
    if (res.ok) {
      setStatus({ kind: 'ok', ...body });
      // Optionally re-fetch /api/admin/prime-users to update the picker list:
      const r2 = await fetch('/api/admin/prime-users');
      if (r2.ok) onSuccess((await r2.json()).users);
    } else {
      setStatus({ kind: 'err', error: body.error, lastSuccessAt: body.lastSuccessAt });
    }
  }
  // ... render button + status text per D-13 ...
}
```

### Example 3: AuditTab cascade integration (D-14, D-15, D-17)

```tsx
// app/admin/audit-tab.tsx — partial
import { useEffect, useState } from 'react';
import { resolveDisplayName } from '@/lib/identity-display';
import { downloadCSV } from '@/lib/export-csv';
import type { PrimeUser } from '@/lib/prime-users';
import type { AuditEntry } from '@/lib/audit';

export function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [primeUsers, setPrimeUsers] = useState<PrimeUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // D-14: client-side resolution. Two parallel fetches; both gated by AdminPage.
    Promise.all([
      fetch('/api/audit/entries?limit=200').then(r => r.ok ? r.json() : { entries: [] }),
      fetch('/api/admin/prime-users').then(r => r.ok ? r.json() : { users: [] }),
    ]).then(([a, p]) => {
      setEntries(a.entries || []);
      setPrimeUsers(p.users || []);
      setLoading(false);
    });
  }, []);

  // D-17: CSV with cascade-resolved Display Name column
  function handleExport() {
    downloadCSV(
      `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Timestamp (AEDT)', 'Email', 'Display Name', 'Action'],
      entries.map(e => [
        formatAEDT(e.timestamp),
        e.email,
        resolveDisplayName(e.email, primeUsers, e.name),
        e.action,
      ])
    );
  }

  // ... table render uses resolveDisplayName(e.email, primeUsers, e.name) for primary line ...
  // ... `prime_user_miss` row gets title={e.detail || 'No detail'} (D-16 tooltip) ...
}
```

## State of the Art

This phase doesn't ride a moving frontier — it's a brownfield refactor inside a 14-month-old Next.js 14 project. There's no "old approach vs new approach" tension. The relevant table:

| Concept | What we use | Why |
|---------|------------|-----|
| Combobox UX | Plain React + ARIA roles | List ≤ 30; new dep cost not justified per D-02. |
| Async data fetching | `useEffect` + `fetch` | Project pattern; existing admin page does the same. |
| Test framework | Vitest 4 (Phase 1 + 2 baseline) | Already wired; co-located `*.test.ts`. |
| Shared component location | `components/ui/` (PascalCase) | CONVENTIONS.md + existing pattern. |
| Auth gating | iron-session + `isAdminEmail()` | Project standard. |

**Deprecated/outdated:** Nothing in scope is deprecated. The current `app/admin/page.tsx` textarea pattern is being replaced (not deprecated) per the milestone goal.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding a new export `getDirectoryMetadata()` to `lib/prime-users.ts` is acceptable under D-22's spirit ("no behavior change to Phase 1 modules") | Pattern 4 — Source endpoint | LOW. If planner disagrees, fall back to reading the blob directly inside the GET route handler — slightly more coupling but identical behavior. |
| A2 | `lib/prime-users.ts:getCached<PrimeUserDirectoryBlob>('shbr-admin/prime-users.json')` returns the metadata fields synchronously enough for the GET route to call it in parallel with `getAllPrimeUsers()` without doubling the blob read | Code Example 1 | LOW. `lib/blob-cache.ts` has an in-memory layer; second call is cache-hit. Worst case: two blob reads on cold start. Negligible. |
| A3 | Prime tenant continues to populate `null` for `division` and `region` (per Phase 1 probe) | D-03 filter scope, D-06 row render | LOW. Code is null-safe. If Prime ever populates `division`, the picker just becomes more useful — no regression. |
| A4 | The audit table fetch can complete before user interaction (no debounce / throttle needed) | Pitfall 6 | LOW. Audit blob is small; existing page already auto-refreshes every 60s without throttling. |
| A5 | Admins are comfortable with a flicker between "email" and "Display Name" on first paint of the audit tab if loading guard is omitted | Pitfall 6 alternative (b) | LOW. Recommendation is to use the loading guard and avoid this entirely. |
| A6 | The existing inline `formatRelative` in `DataRefreshButton.tsx` can be safely lifted to `lib/format-relative.ts` and extended to support "5 days ago" without regressing the existing button's behavior | Don't Hand-Roll | LOW. Current helper handles minutes/hours; extension adds days/weeks/months. Existing usage continues to call the same function with the same minute/hour ranges. |
| A7 | `prime_user_miss` audit rows can use the existing `ActionBadge` (amber `Miss` chip) without color-token changes | D-16 | NONE. Verified: `app/admin/page.tsx:512` already renders this badge. |
| A8 | A new `/api/admin/prime-users` endpoint will not push the Prime API budget over 5,000/day even with admins refreshing aggressively | Pitfall 8 | LOW. The GET endpoint reads from the cache only (no Prime call). Only the Phase-1 `refresh` route hits Prime. CLAUDE.md "cache before you call Prime" is honored. |

**Read this list to the discuss-phase agent before locking the plan** — A1, A4, A5 are the ones with judgment calls; the rest are code-level confirmations.

## Open Questions (RESOLVED)

1. **Should `getDirectoryMetadata()` be a new export on `lib/prime-users.ts` or an inline blob read in the GET route?**
   - What we know: D-22 says "no changes to Phase 1 modules"; adding a new function is technically a change but doesn't alter existing behavior or break tests.
   - What's unclear: How strictly to interpret D-22.
   - Recommendation: Add as a new export (cleaner, more testable). Confirm with planner; trivial to flip if rejected.
   - RESOLVED: implemented as additive export `getDirectoryMetadata()` in `lib/prime-users.ts` per Plan 03-01 Task 3. D-22's "no behavior change to Phase 1 modules" treated as additive-OK; existing exports untouched.

2. **Is the `formatRelative` extraction (Don't Hand-Roll table) worth the diff cost?**
   - What we know: Current helper is 9 lines, handles minutes/hours. Picker needs days. Two callers will share.
   - What's unclear: Whether the planner sees this as "shared utility" or "premature DRY."
   - Recommendation: Extract once both callers exist (during Phase 3 work). Defer the existing button's import switch if cleanup risk is concerning — both can call the same `lib/format-relative.ts:formatRelative` function safely.
   - RESOLVED: extracted to new `lib/format-relative.ts` (with unit test) per Plan 03-01 Task 2. Existing `DataRefreshButton.tsx` continues to call the same helper signature; days/weeks/months range added.

3. **Should the picker pre-fetch on tab mount or first focus?**
   - What we know: CONTEXT.md "Claude's Discretion" defaults to tab mount; payload is small.
   - What's unclear: Nothing significant.
   - Recommendation: Tab mount. Admins always need the data; deferring to focus saves nothing.
   - RESOLVED: tab mount per Plan 03-04. `<PrimeUserPicker>` consumers fetch `/api/admin/prime-users` on tab mount and pass `users` down as a prop.

4. **Inactive Prime users (`status !== 'active'`): grey out, hide entirely, or include with no styling?**
   - What we know: CONTEXT.md "Claude's Discretion" defaults to "include in results, tag visually."
   - What's unclear: How tag visually? Strikethrough? Fade? Icon?
   - Recommendation: Append `(inactive)` in the secondary line per D-06 styling, no color change. Easiest to implement, easiest for admins to read. UI-SPEC step can refine.
   - RESOLVED: append `(inactive)` text in the secondary line per Plan 03-03 picker row JSX; no color/strikethrough change. Honors D-06 row tokens unchanged.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Next.js dev/build | ✓ | (project requires 18+; CI/Vercel handles) | — |
| npm | Package install | ✓ | (project standard) | — |
| Vercel Blob | New endpoint reads cache | ✓ (existing prod) | (managed) | — |
| Prime API | Refresh button (existing endpoint) | ✓ (existing) | v2 | Phase 1 graceful degrade serves stale cache |
| Vitest | Tests | ✓ | 4.1.5 | — |
| All Phase 3 npm deps | Build | ✓ | (no new deps) | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

> Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | `vitest.config.ts` (node environment, includes `lib/**/*.test.ts` + `app/**/*.test.ts`) |
| Quick run command | `npx vitest run --reporter=dot <path>` |
| Full suite command | `npm test` (alias for `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | Replacing Dashboard Admins textarea with picker (UI integration) | manual UAT | n/a (Phase 3 D-19 — no browser tests) | n/a |
| ADMIN-02 | Replacing GroupCard textarea with picker (UI integration) | manual UAT | n/a | n/a |
| ADMIN-03 | New Group form uses picker (UI integration) | manual UAT | n/a | n/a |
| ADMIN-04 | Picker filters across name + email + division | unit (pure fn) | `npx vitest run components/ui/PrimeUserPicker.test.ts` | ❌ Wave 0 |
| ADMIN-05 | Stored emails not in Prime still render and removable | unit (cascade fn) + manual UAT | `npx vitest run lib/identity-display.test.ts` | ❌ Wave 0 |
| DISPLAY-01 | Group lists render name + division | unit (cascade) + manual UAT | `npx vitest run lib/identity-display.test.ts` | ❌ Wave 0 |
| DISPLAY-02 | Admins list renders name + division | unit (cascade) + manual UAT | `npx vitest run lib/identity-display.test.ts` | ❌ Wave 0 |
| DISPLAY-03 | Audit log renders Prime display name with fallback | unit (cascade) + manual UAT | `npx vitest run lib/identity-display.test.ts` | ❌ Wave 0 |
| (D-11) Auth contract | New GET route 401/403/200 | unit (route handler) | `npx vitest run app/api/admin/prime-users/route.test.ts` | ❌ Wave 0 |
| (D-17) CSV column | Audit CSV includes Display Name | unit (export integration) | covered by cascade tests + manual UAT row in CSV | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=dot <path-to-changed-test-file>`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`. Manual UAT script (covering ADMIN-01..03, picker keyboard nav, manual-email fallback, audit cascade flicker check) executed and signed off.

### Wave 0 Gaps

- [ ] `components/ui/PrimeUserPicker.test.ts` — covers ADMIN-04 (filter logic). MUST test: case-insensitive substring on `fullName`, `email`, `division`; null-safe on `division`; empty query returns full list; whitespace query treated as empty.
- [ ] `lib/identity-display.test.ts` — covers ADMIN-05 + DISPLAY-01/02/03 (cascade logic). MUST test: live-name hit, whitespace-only live-name falls through, fallback to `entry.name`, fallback to email, mixed-case email matches lowercase Prime emails (D-09).
- [ ] `app/api/admin/prime-users/route.test.ts` — covers D-11 auth contract. MUST test: unauthenticated → 401 (does NOT call `getAllPrimeUsers`), non-admin → 403 (does NOT call `getAllPrimeUsers`), admin → 200 with `{ users, lastSuccessAt, lastError }` shape.

*Existing test infrastructure** covers the framework setup. No new dev-deps. Wave 0 is purely "create the three test files with the correct mock boundaries — mirroring `app/api/auth/session/route.test.ts` and `lib/audit.test.ts` patterns."

## Security Domain

> `security_enforcement` is not explicitly disabled in `.planning/config.json` — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Two-gate auth (session + admin role) on all admin endpoints — pattern confirmed |
| V2 Authentication | partial | Session auth via iron-session — UNCHANGED in Phase 3; D-22 prohibits modification |
| V3 Session Management | partial | iron-session 8h cookie — UNCHANGED |
| V4 Access Control | yes | Admin-gate via `isAdminEmail()` — Phase 3 endpoint mirrors existing pattern |
| V5 Input Validation | yes | Picker email input MUST normalize (`.trim().toLowerCase()`); CSV escaping uses existing helper |
| V6 Cryptography | n/a | No new crypto in Phase 3 |
| V7 Error Handling | yes | `[admin-prime-users]` log internally, generic 401/403/500 to client |
| V11 Business Logic | yes | Manual-email fallback (D-12) is a privileged write — must require admin auth (it does, via parent VisibilityTab) |
| V13 API | yes | New GET endpoint sets `Cache-Control: no-store`; admin-only |
| V14 Configuration | n/a | No new config in Phase 3 |

### Known Threat Patterns for Phase 3 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Auth bypass on new endpoint | Spoofing | Two-gate check (session + isAdminEmail) — mirror Phase 1 pattern; test 401/403 explicitly (D-18) |
| IDOR on new endpoint | Information disclosure | Endpoint returns the ENTIRE Prime user list — admin-only by design. No per-user ID parameter, so no IDOR surface. |
| XSS in rendered Prime names | Tampering | React auto-escapes JSX text content. Names are rendered as `{primeUser.fullName}` (text), not `dangerouslySetInnerHTML`. **Verified: no `dangerouslySetInnerHTML` usages in admin tree** [VERIFIED via grep]. |
| XSS in division string | Tampering | Same as names — React-escaped. |
| CSV injection (formula injection) | Tampering | If `fullName` starts with `=`, `+`, `-`, `@`, Excel may execute. Existing `lib/export-csv.ts:downloadCSV` does NOT prefix-escape. **Recommended: add `'` prefix to CSV cells starting with formula chars.** Low risk for SHBR (admins are trusted; Prime data is internal); planner's call. |
| DoS via large user list | DoS | Prime tenant has ~30 users (CONTEXT.md verified); list is small; no virtualization needed. If list grows to 1000+, `<PrimeUserPicker>` may need a max-results cap (e.g., 50 visible filtered rows). Plan for "monitor and cap if needed." |
| CSRF on new endpoint | Tampering | iron-session uses `sameSite: 'lax'` cookies + `httpOnly` (verified `lib/session.ts:18`). GET endpoint is idempotent. POST endpoints (refresh, page-visibility) ALREADY use the same cookie scheme — Phase 3 inherits the existing CSRF posture; no new mitigation needed. |
| Admin gate via spoofed email | Spoofing | `isAdminEmail()` checks `session.userEmail` which is server-set during login (cannot be client-supplied). Verified `app/api/auth/login/route.ts` writes `userEmail` to the session. |
| Manual-email fallback abuse | Tampering | Manual fallback writes whatever email the admin types into the visibility config. Only admins can do this (parent route is admin-gated). Acceptable per D-12 ("preserves admin agency during outage"). |
| Tooltip data injection | Tampering | `title` attribute is rendered as plain text by browsers; cannot inject markup. Safe. |
| Audit log spam via picker actions | DoS | Phase 3 does NOT add audit log writes (D-22 — `lib/audit.ts` is read-only). No spam vector. |

**Phase 3 security posture summary:** No new attack surface beyond one new admin-only GET endpoint. The endpoint mirrors an existing auth pattern. All input rendering goes through React text-escape. CSV injection is the only mild new risk and is low-priority for a trusted-internal-admin context.

## Sources

### Primary (HIGH confidence)

- **`.planning/phases/03-admin-picker-identity-rich-display/03-CONTEXT.md`** — locked decisions D-01..D-22, ground truth for this phase
- **`.planning/phases/02-session-auth-context/02-CONTEXT.md` + 02-UI-SPEC.md** — Phase 2 D-10 cascade philosophy, `text-gray-300`/`text-gray-500` token lock
- **`.planning/phases/01-prime-user-directory/01-CONTEXT.md`** — Phase 1 D-13/D-14/D-19 metadata shape; Phase 1 D-22 co-located vitest pattern
- **`.planning/REQUIREMENTS.md`** — ADMIN-01..05, DISPLAY-01..03 acceptance criteria
- **`.planning/codebase/CONVENTIONS.md`** — naming, exports, log prefixes, ESLint settings
- **`.planning/codebase/CONCERNS.md` line 16** — confirmed 793-line `app/admin/page.tsx` flag (D-20 mitigation target)
- **`./CLAUDE.md`** — Prime API constraints (60 req/min, 5,000/day, no webhooks); brownfield-aware ways of working
- **`package.json`** — verified dependency surface (no Headless UI, no Radix, no react-select, no @vercel/kv)
- **`vitest.config.ts`** — verified test config (node env, kebab-case test paths)
- **`app/admin/page.tsx`** — read full file 1-796 for cut-line audit (Pitfall 7)
- **`app/api/admin/prime-users/refresh/route.ts`** — Phase 1 reference implementation (mirrored by D-11)
- **`app/api/admin/page-visibility/route.ts`** — alternate two-gate pattern (variant 2)
- **`app/api/audit/entries/route.ts`** — alternate two-gate pattern (variant 3 with 404 stealth)
- **`lib/prime-users.ts`** — verified `PrimeUser` shape, blob key, blob metadata structure
- **`lib/audit.ts`** — verified `AuditEntry` shape with `action: 'login' | 'logout' | 'prime_user_miss'`, optional `name`, optional `detail`
- **`lib/page-visibility.ts`** — verified `VisibilityConfig` shape (admins, groups, pages — all `string[]` and arrays of objects)
- **`lib/auth-context.tsx`** — verified `AuthContext` already exposes `primeUser` (Phase 2)
- **`lib/export-csv.ts`** — verified shared `downloadCSV` helper exists (used by 9 pages)
- **`components/ui/DataRefreshButton.tsx`** — verified existing `formatRelative()` function (minutes/hours support)
- **`components/ui/AuthGuard.tsx`** — verified Provider wiring carries `primeUser`
- **`app/search/page.tsx:91-95`** — verified prior-art for case-insensitive substring filter
- **`lib/prime-users.test.ts`, `lib/audit.test.ts`, `app/api/auth/session/route.test.ts`, `app/api/auth/login/route.test.ts`** — verified Phase 1 + 2 test patterns to mirror in Phase 3 (D-18)

### Secondary (MEDIUM confidence)

- **W3C ARIA Authoring Practices Guide — Combobox pattern** [CITED: w3.org/WAI/ARIA/apg/patterns/combobox/] — sourced for ARIA roles list (Pattern 1). Not fetched live in this research session; cited from training knowledge. Recommendation: planner verify exact attribute names if shipping a screen-reader-tested release.

### Tertiary (LOW confidence)

- None. All claims in this research are either verified against the codebase, explicitly cited from CONTEXT.md, or marked `[ASSUMED]` in the Assumptions Log.

## Metadata

**Confidence breakdown:**

- **User Constraints / Phase Requirements: HIGH** — copied verbatim from CONTEXT.md and REQUIREMENTS.md
- **Standard Stack: HIGH** — every claim verified against `package.json`
- **Architecture Patterns: HIGH** — extracted from existing code; no library claims
- **Don't Hand-Roll: HIGH** — references exact line numbers in existing files
- **Pitfalls: HIGH** — code-level audits (Pitfall 7 cut-line, Pitfall 4 auth pattern variants)
- **Code Examples: HIGH** — types and signatures verified against current `lib/`
- **Security Domain: MEDIUM** — STRIDE mapping is straightforward; ASVS categories are checklists; CSV injection is the one nuance
- **Validation Architecture: HIGH** — exact commands runnable today; gaps are simple file-creates

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days — codebase is stable; no fast-moving deps)

---
*Phase: 03-admin-picker-identity-rich-display*
*Research completed: 2026-04-25*
