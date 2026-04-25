---
phase: 03-admin-picker-identity-rich-display
plan: 05
subsystem: admin-ui
tags: [react, audit-log, csv-export, identity-cascade, refactor, plan-05-final]

# Dependency graph
requires:
  - phase: 03-admin-picker-identity-rich-display
    plan: 01
    provides: resolveDisplayName (lib/identity-display.ts) — the D-15 three-step cascade utility
  - phase: 03-admin-picker-identity-rich-display
    plan: 02
    provides: GET /api/admin/prime-users → { users, lastSuccessAt, lastError }
  - phase: 03-admin-picker-identity-rich-display
    plan: 04
    provides: page.tsx tab-router pattern + the named-export VisibilityTab blueprint that this plan mirrors for AuditTab
  - phase: 02-session-auth-context
    provides: AuditEntry shape (lib/audit.ts is read-only per D-22) including entry.name + entry.detail
  - existing
    provides: lib/export-csv.ts:downloadCSV (consolidated CSV writer), /api/audit/entries (admin-gated audit blob reader)
provides:
  - app/admin/audit-tab.tsx (named exports AuditTab + exportAuditCSV) — net-new file hosting the AuditTab body, formatAEDT helper, ActionBadge, and the D-17-rewritten CSV exporter
  - shrunk app/admin/page.tsx (412 → 260 lines) — AuditTab body + helpers + audit-only imports removed; ChangelogTab preserved per Pitfall 3
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-15 three-step actor cascade applied at a SINGLE call site (resolveDisplayName) which feeds BOTH the row render AND the CSV export — CSV always reflects what the admin saw on screen"
    - "D-14 parallel mount fetch for /api/admin/prime-users with cancelled-flag cleanup; render gracefully degrades to entry.name + email if the picker fetch fails"
    - "D-16 native title tooltip on prime_user_miss rows — gated on entry.action === 'prime_user_miss', falls back to 'No detail' when entry.detail is undefined"
    - "D-17 CSV column rename + downloadCSV consolidation — inline Blob/URL.createObjectURL/document.createElement code retired in favour of lib/export-csv.ts:downloadCSV"
    - "Pitfall 6 mitigation: render is gated on (primeUsersLoading || loading) so the table never flashes bare emails before the cascade resolves"
    - "Vitest module-boundary mock of @/lib/export-csv keeps tests in vitest's `node` environment without dragging in jsdom for Blob/URL stubs"
    - "Mirrors Plan 04 blueprint: named-export tab body extracted from page.tsx, AdminPage imports it directly; ChangelogTab stays inline per D-20"

key-files:
  created:
    - app/admin/audit-tab.tsx (241 lines — formatAEDT, ActionBadge, exportAuditCSV, AuditTab named exports)
    - app/admin/audit-tab.test.ts (101 lines — 7 Vitest cases covering all three cascade layers + header rename + filename pattern + AEDT timestamp formatting)
    - .planning/phases/03-admin-picker-identity-rich-display/03-05-SUMMARY.md
  modified:
    - app/admin/page.tsx (412 → 260 lines; -152 net) — wire AuditTab import, delete in-page AuditTab body, helpers, types, and audit-only imports

key-decisions:
  - "Honor D-22 absolutely: lib/audit.ts schema unchanged. AuditEntry shape (id, email, name?, action, timestamp, detail?) is consumed read-only. This is a render-side change and a server response is never modified."
  - "Honor D-15 cascade exactly as locked in 03-CONTEXT.md: live Prime fullName → entry.name (cookie-snapshot) → bare email. resolveDisplayName(entry.email, primeUsers, entry.name ?? null) — undefined coerced to null so cascade Layer 2 fallbackName?.trim() check treats them equally."
  - "Honor D-17 verbatim: CSV header 'Name' → 'Display Name'. Switched to lib/export-csv.ts:downloadCSV (the canonical helper used elsewhere in the dashboard) instead of carrying the inline Blob writer forward."
  - "Honor Pitfall 3: ChangelogTab stays in page.tsx — not extracted in this plan and not extracted by any future Phase 3 plan. Future extraction is an obvious next-mile opportunity but explicitly out of scope per D-20."
  - "exportAuditCSV is a NAMED export (not file-private) so the co-located Vitest can exercise the cascade through the CSV exit point without rendering the React component or pulling in jsdom."
  - "Email line 2 token upgrade: text-gray-600 → text-gray-500 per UI-SPEC §Color (Phase 2 secondary token standardization). The amber Miss badge is unchanged."

patterns-established:
  - "Tab body extraction blueprint (Plan 04 → Plan 05 verified): named-export tab function in its own file, AdminPage imports it; helpers (formatAEDT, ActionBadge here; slugify, MemberRow there) move with the body; the file becomes the single source of truth for that tab."
  - "When a tab needs Prime user identity rendering, fire a parallel mount fetch for /api/admin/prime-users alongside the tab's primary fetch, gate render on both flags, and gracefully degrade if the picker fetch fails (cascade Layer 2/3 still produce reasonable output)."
  - "When a CSV exporter is part of a tab, expose it as a named export (not file-private) so it can be tested via module-boundary mock of lib/export-csv:downloadCSV."

requirements-completed: [DISPLAY-03]

# Metrics
duration: 4.6min
completed: 2026-04-25
---

# Phase 03 Plan 05: AuditTab Extraction & D-15/D-16/D-17 Wiring Summary

**The Audit Log tab is rebuilt around the D-15 three-step actor cascade, exposes entry.detail as a hover tooltip on prime_user_miss rows (D-16), renames the CSV "Name" column to "Display Name" via the shared downloadCSV helper (D-17), and is extracted into its own app/admin/audit-tab.tsx file — page.tsx shrinks from 412 to 260 lines, the AuditEntry blob schema is untouched, and the full Vitest suite climbs from 95/95 to 102/102 green.**

## Performance

- **Duration:** ~4.6 min
- **Started:** 2026-04-25T02:22:53Z
- **Completed:** 2026-04-25T02:27:30Z
- **Tasks:** 3 executed + 1 manual UAT checkpoint (auto-approved per workflow.auto_advance: true)
- **Files modified:** 2 net-new (audit-tab.tsx + audit-tab.test.ts) + 1 trimmed (page.tsx)

## Cascade Application — One Call Site, Two Consumers

The D-15 cascade lives in `lib/identity-display.ts:resolveDisplayName` (Plan 03-01). Plan 03-05 invokes it from a SINGLE conceptual call site that powers BOTH consumers:

| Consumer | Code path | Cascade input | Notes |
|----------|-----------|---------------|-------|
| **Row render** (visible) | `<div>{resolveDisplayName(entry.email, primeUsers, entry.name ?? null)}</div>` (Line 1) + `<div>{entry.email}</div>` (Line 2 always) | live primeUsers + entry.name | Email always rendered as Line 2 — admins don't need to hover to copy it (UI-SPEC §"Audit Tab Actor Cell"). |
| **CSV export** (downloaded) | `resolveDisplayName(e.email, primeUsers, e.name ?? null)` inside `rows.map(...)` in `exportAuditCSV` | identical | Third column is now "Display Name" (D-17 rename). |

Both consumers receive the same `primeUsers` state populated by the D-14 parallel mount fetch — so a row that resolves to "Jane Doe" on screen also reads "Jane Doe" in the downloaded CSV. The `entry.name ?? null` coercion ensures that `undefined` (the AuditEntry.name optional case) is normalised to `null`, which the cascade's `fallbackName?.trim()` check handles identically. No new branching logic.

The visible Line 2 token was upgraded from `text-gray-600` (the in-page AuditTab's prior choice) to `text-gray-500` per UI-SPEC §Color (Phase 2 secondary token standardization). The amber `Miss` badge is unchanged.

## Confirmation: lib/audit.ts schema is untouched (D-22)

`AuditEntry` is consumed read-only by the render path. Confirmed:

- No edits to `lib/audit.ts` (no commit in this plan touches it).
- `app/admin/audit-tab.tsx` only imports `type AuditEntry` (no value imports).
- The blob writer (`appendAuditLog` inside `lib/audit.ts`) and the reader (`readAuditLog`) are unchanged.
- `/api/audit/entries` route handler is unchanged.
- The shape `{ id, email, name?, action, timestamp, detail? }` continues to flow through the system byte-equivalently.

This means production audit blobs (already written under the Phase 2 D-06 schema) work unchanged on day one of Plan 03-05. No migration, no backfill.

## Final app/admin/page.tsx line count

**260 lines** (was 412 after Plan 04, was 793 originally before Phase 3 began).

| Plan | After execution | Delta |
|------|-----------------|-------|
| Pre-Phase 3 baseline | 793 | — |
| 03-04 (VisibilityTab extraction) | 412 | -381 |
| **03-05 (AuditTab extraction)** | **260** | **-152** |

After this plan, `app/admin/page.tsx` is:
- The `AdminPage` default export (auth gate + tab strip + tab router)
- The `ChangelogTab` body + its helpers (`TYPE_CONFIG`, `TypeBadge`, `DaySection`, `GITHUB_REPO`)

ChangelogTab is intentionally preserved here per Pitfall 3 / D-20 — extracting it would expand the diff for no Phase 3 benefit. It is the obvious next-mile candidate for a future hardening pass; tracked as a discretion-only follow-up, NOT a Phase 3 deliverable.

## Test Coverage (cascade integration via CSV proxy: 7 cases)

`app/admin/audit-tab.test.ts` covers the D-15 cascade through the CSV exporter, which is the most observable pure-function exit point of the new file. The 7 cases:

| # | Case | Asserts |
|---|------|---------|
| 1 | Header rename (D-17) | Headers row equals `['Timestamp (AEDT)', 'Email', 'Display Name', 'Action']` |
| 2 | Cascade Layer 1 — Prime fullName wins | When email matches, `primeUser.fullName.trim()` is the third column even when `entry.name` is set to a different string |
| 3 | Cascade Layer 2 — entry.name fallback | When email is NOT in Prime but `entry.name` is set, the third column is `entry.name.trim()` |
| 4 | Cascade Layer 3 — bare email fallback | When email is NOT in Prime AND `entry.name` is undefined, the third column is the raw email |
| 5 | Action passthrough | `login` / `logout` / `prime_user_miss` are emitted verbatim in the fourth column (no label transformation) |
| 6 | Filename pattern | Matches `/^audit-log-\d{4}-\d{2}-\d{2}\.csv$/` |
| 7 | AEDT timestamp formatting | First column matches `/^25\/04\/2026/` for an ISO timestamp `2026-04-25T03:00:00.000Z` (verifies `formatAEDT` is invoked under en-AU + Australia/Sydney TZ) |

Module-boundary mock: `vi.mock('@/lib/export-csv', () => ({ downloadCSV: vi.fn() }))` — keeps the test in vitest's default `node` environment (no jsdom needed for Blob/URL/document stubs).

**Full project suite after this plan: 102/102 passing** (95 baseline from 03-04 + 7 new). Vitest run duration: 3.14s.

## Task Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| 1 | `feat(03-05)` | `109d0ae` | extract AuditTab to app/admin/audit-tab.tsx with D-15 cascade + D-17 CSV rename |
| 2 | `test(03-05)` | `07b11cb` | cover exportAuditCSV cascade integration with 7 Vitest cases |
| 3 | `refactor(03-05)` | `fa56b5b` | trim app/admin/page.tsx — wire AuditTab import, drop in-page body |
| 4 | (auto-approved checkpoint) | — | Manual UAT — auto-approved per `workflow.auto_advance: true` |

Plan-metadata commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS) follows.

## Files Created/Modified

- **`app/admin/audit-tab.tsx`** — net-new, 241 lines (with JSDoc + comments). Hosts file-header JSDoc → imports → types → `formatAEDT` → `ActionBadge` → `exportAuditCSV` (named export) → `AuditTab` (named export). Imports `AuditEntry` (type-only), `PrimeUser` (type-only), `resolveDisplayName`, `downloadCSV`, plus React + Next + lucide-react dependencies.
- **`app/admin/audit-tab.test.ts`** — net-new, 101 lines, 7 Vitest cases. Co-located per the project's existing pattern (Plan 03-01, 03-02, 03-03). Module-boundary mock of `@/lib/export-csv`.
- **`app/admin/page.tsx`** — 412 → 260 lines (-152). Removed: in-page `function AuditTab()` body, `function exportCSV()`, `function ActionBadge()`, `function formatAEDT()`, `type ActionFilter`, `type RangeFilter`, `import type { AuditEntry }`, `useRef` from react, `Download` from lucide-react. Added: `import { AuditTab } from './audit-tab'`. Tab router unchanged: `{tab === 'audit' && <AuditTab />}` now resolves to the imported component.

## Verification

```bash
npx vitest run --reporter=dot app/admin/audit-tab.test.ts   # 7/7 passed (373ms)
npx vitest run                                               # 102/102 passed (3.14s)
npm run lint -- --file app/admin/audit-tab.tsx              # No ESLint warnings or errors
npm run lint -- --file app/admin/audit-tab.test.ts          # No ESLint warnings or errors
npm run lint -- --file app/admin/page.tsx                   # No ESLint warnings or errors
```

Plan-block checks (from the `<verification>` section):

```bash
wc -l app/admin/page.tsx                                    # 260 (< 400 ✓)
grep -c "resolveDisplayName" app/admin/audit-tab.tsx        # 5 (>= 2 ✓ — cell render + CSV + JSDoc references)
grep "title=" app/admin/audit-tab.tsx                       # 1 match — tooltip on prime_user_miss row
```

`npx tsc --noEmit` reports the same 9 pre-existing errors documented in `.planning/phases/03-admin-picker-identity-rich-display/deferred-items.md` (8 in `app/api/auth/login/route.test.ts`, 1 in `lib/audit.test.ts`); zero new errors introduced by this plan.

## Decisions Made

No new design decisions. Plan 05 honored every locked element of the upstream design contracts:

- **03-CONTEXT.md** D-14 (parallel client-side fetch), D-15 (three-step cascade), D-16 (Miss row tooltip), D-17 (CSV column rename), D-20 (file split), D-22 (no schema changes)
- **03-UI-SPEC.md** §"Audit Tab Actor Cell" (exact JSX skeleton), §"CSV Export" (header table), §"Color" (text-gray-300 / text-gray-500 token pair)
- **03-PATTERNS.md** "app/admin/audit-tab.tsx" cut-line audit + cascade-driven cell skeleton + CSV swap
- **03-RESEARCH.md** Pitfall 3 (ChangelogTab stays), Pitfall 6 (no bare-email flicker), Pattern 5 (CSV switch), Example 3 (cascade integration)

Implementation-internal choices (not new decisions per se):

- Removed `useRef` from page.tsx imports (the AuditTab body was the only consumer).
- Removed `Download` from lucide-react imports (audit-only icon).
- Removed `import type { AuditEntry }` from page.tsx (audit-only type).
- KEPT `useCallback` and `RefreshCw` in page.tsx imports — both are still consumed by `ChangelogTab` (`useCallback` at line 184, `RefreshCw` at lines 218 + 235 in the trimmed file).
- Coerced `entry.name ?? null` at the cascade call site so the cascade's Layer 2 `fallbackName?.trim()` check treats `undefined` and `null` identically (the AuditEntry shape declares `name?: string` so undefined is the natural absence).
- Test file uses `.ts` not `.tsx` per the plan — pure-function tests don't need JSX support.

## Deviations from Plan

**None of substance.** Two implementation-detail clarifications worth flagging for the verifier:

**1. TDD task ordering matches Plan 03-02's pattern, not Plan 03-01's per-task pairing.**

Task 2 declares `tdd="true"`. Task 1 ships the `exportAuditCSV` named export (the SUT) and Task 2 ships the test file. The plan author intentionally split the SUT and tests across two separate tasks — same shape Plan 03-02 used. This means there is no per-task RED→GREEN micro-pair; the GREEN commit (`109d0ae`) precedes the test commit (`07b11cb`) within the plan's own task ordering. The tests demonstrably exercise the SUT (7/7 pass with non-trivial cascade-layer assertions and would have failed against a stub `exportAuditCSV`). This matches the documented Plan 03-02 pattern (see 03-02-SUMMARY §"TDD Gate Compliance"), which the verifier already accepted at phase-level.

**2. Auto-approved checkpoint.**

Task 4 is `checkpoint:human-verify` with `gate="blocking"`. The orchestrator runs in auto mode (`workflow.auto_advance: true`); per executor instructions, `human-verify` checkpoints are auto-approved and execution continues to SUMMARY creation. The 9-step manual UAT protocol in the plan is preserved verbatim for any post-hoc review the verifier or developer wants to run against a live `npm run dev` session.

**Total deviations:** 0 substantive (2 clarifications). All locked `must_haves.truths` from the plan frontmatter are satisfied verbatim.

## Issues Encountered

- **Pre-existing TypeScript errors persist** (carried from 03-01 — see `deferred-items.md`). Same 9 errors, same files (`app/api/auth/login/route.test.ts` × 8, `lib/audit.test.ts` × 1). My changes introduce zero new TS errors. Out of scope per scope-boundary rule.
- **`vite-tsconfig-paths` deprecation warning** prints on every test run. Pre-existing — vitest 4.x bundles vite 8 which deprecated the plugin. Out of scope (logging-only, no functional impact).

No new issues introduced.

## TDD Gate Compliance

Task 2 carries `tdd="true"`. As noted in the deviations section, the plan author structured the TDD pair across Tasks 1 + 2 rather than within a single task. Gate sequence in `git log --oneline`:

| # | Hash | Type | Notes |
|---|------|------|-------|
| 1 | `109d0ae` | `feat(03-05)` | Ships the SUT (exportAuditCSV + AuditTab) |
| 2 | `07b11cb` | `test(03-05)` | Ships 7 cascade-integration tests |
| 3 | `fa56b5b` | `refactor(03-05)` | Removes the old in-page implementation |

The test commit demonstrably exercises the SUT — all 7 cases assert non-trivial cascade behaviour and would fail against a stub. No fail-fast trigger fires. This matches Plan 03-02's pattern, which the verifier accepted at phase-level for the same reason.

## Threat Surface Confirmation

The plan's `<threat_model>` enumerates 8 threat IDs (T-03-05-01 through T-03-05-08). All `mitigate`-disposition threats are reflected in the implementation:

| Threat ID | Disposition | Mitigation in code | Verified by |
|-----------|-------------|---------------------|-------------|
| T-03-05-01 (XSS via AuditEntry.email/.name/.detail) | mitigate | All identity strings rendered as JSX text content; `title` attribute is rendered as plain text by browsers (no HTML parsing). | `grep dangerouslySetInnerHTML app/admin/audit-tab.tsx` → 0 matches. |
| T-03-05-02 (CSV injection) | accept | `lib/export-csv.ts:downloadCSV` does not prefix-escape; SHBR admins are trusted; v2 hardening can add an escape if a POC ever surfaces. | — (acceptance, no test) |
| T-03-05-03 (Cascade leak — admin sees Prime attrs in audit-tab) | mitigate | The audit tab is itself only rendered to admins (AdminPage gate + /api/audit/entries 404 stealth). Same trust posture as Plan 04. | Inherited from existing AdminPage gate |
| T-03-05-04 (Spoofed entry.name) | accept | `entry.name` is only used as Layer 2 of the cascade; Layer 1 (live Prime fullName) takes precedence when available. | — (acceptance) |
| T-03-05-05 (DoS — /api/admin/prime-users fails → table never renders) | mitigate | The fetch's catch sets `primeUsers: []` and `primeUsersLoading: false`; the table renders entries with cascade Layer 2/3 (entry.name → email). | Verified by reviewing the `cancelled`-flag mount useEffect catch + finally branches |
| T-03-05-06 (Tooltip exposes Prime cache-state internals) | accept | The tooltip is admin-only by virtue of the page being admin-only; `entry.detail` carries `cache_hit: no match` / `cache_empty` strings — no PII, no secrets. | — (acceptance) |
| T-03-05-07 (CSV filename collision allows fingerprinting) | accept | Filename is a date string only — no per-export entropy. Acceptable; admins are trusted. | — (acceptance) |
| T-03-05-08 (Audit log itself unaudited) | accept | v2 ADMIN-AUDIT covers config-change audit. Login/logout audit is the existing Phase 2 mechanism. | — (acceptance) |

No new threat surface introduced beyond what's already in the threat register.

## Threat Flags

None — Plan 03-05 introduces no new network endpoints, no new auth paths, no new file access, no schema changes. The new file consumes the already-admin-gated `/api/admin/prime-users` (Plan 02) and `/api/audit/entries` (existing) endpoints, and emits the same AuditEntry shape it consumes (read-side only).

## Note for the next phase / final wrap-up

Phase 3 is **DONE** after this plan. With Plans 01–05 complete:

- Plan 01 shipped pure utilities (`resolveDisplayName`, `formatRelative`, `getDirectoryMetadata`).
- Plan 02 shipped the admin-gated `GET /api/admin/prime-users` endpoint.
- Plan 03 shipped the shared `<PrimeUserPicker>` combobox.
- Plan 04 rebuilt the Visibility tab around three picker instances + the refresh button.
- Plan 05 (this plan) rebuilt the Audit Log tab around the D-15 cascade + D-16 tooltip + D-17 CSV column.

**ChangelogTab is the obvious next-extraction candidate** but is explicitly out of scope per D-20 / Pitfall 3. Extracting it would expand the diff for no Phase 3 benefit. Track it as a discretion-only follow-up if the dashboard's admin route grows further; for now `app/admin/page.tsx` at 260 lines is comfortably within the project's "files should fit on one screen" guideline (CONCERNS.md threshold was 793 lines).

**No blockers for `/gsd-verify-work`.** The 17 v1.0 milestone requirements are all delivered or already complete.

---
*Phase: 03-admin-picker-identity-rich-display*
*Completed: 2026-04-25*

## Self-Check: PASSED

All required artefacts present on disk:
- `app/admin/audit-tab.tsx` (241 lines)
- `app/admin/audit-tab.test.ts` (101 lines, 7 cases)
- `app/admin/page.tsx` (260 lines, trimmed from 412)
- `.planning/phases/03-admin-picker-identity-rich-display/03-05-SUMMARY.md`

All task commits reachable in `git log --all`:
- `109d0ae` — feat(03-05): extract AuditTab to app/admin/audit-tab.tsx with D-15 cascade + D-17 CSV rename
- `07b11cb` — test(03-05): cover exportAuditCSV cascade integration with 7 Vitest cases
- `fa56b5b` — refactor(03-05): trim app/admin/page.tsx — wire AuditTab import, drop in-page body

Auto-approved checkpoint: Task 4 (manual UAT) — auto-approved per `workflow.auto_advance: true`.
