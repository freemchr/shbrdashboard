---
phase: 03-admin-picker-identity-rich-display
plan: 01
subsystem: utilities
tags: [vitest, typescript, identity-cascade, prime-users, formatRelative]

# Dependency graph
requires:
  - phase: 01-prime-user-directory
    provides: PrimeUser type, PrimeUserDirectoryBlob, BLOB_KEY ('shbr-admin/prime-users.json'), getCached helper
  - phase: 02-session-auth-context
    provides: cascade philosophy (D-10 → extended to D-15), text-gray-300 / text-gray-500 identity tokens (informational, no code reuse)
provides:
  - resolveDisplayName(email, primeUsers, fallbackName?) → D-15 three-step cascade
  - isUnresolvedEmail(email, primeUsers) → tooltip-gating predicate (D-09)
  - findPrimeUser(email, primeUsers) → division-aware lookup helper
  - formatRelative(input: string | Date | number) → shared relative-time helper (UI-SPEC unit thresholds)
  - getDirectoryMetadata() → read-only blob metadata accessor (D-11)
affects: [03-02, 03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "lib/identity-display.ts pure-function module — co-located Vitest, named exports, @/ path alias for type imports"
    - "lib/format-relative.ts pure-function module — defensive against future timestamps and invalid input"
    - "Additive export pattern on Phase 1 lib/prime-users.ts (D-22 carve-out) — new read-only accessor, zero touch on existing exports"
    - "TDD RED→GREEN gate enforcement: each task has paired test/feat commits"

key-files:
  created:
    - lib/identity-display.ts (40 lines, 3 named exports, pure functions)
    - lib/identity-display.test.ts (93 lines, 15 Vitest cases)
    - lib/format-relative.ts (46 lines, 1 named export, accepts string | Date | number)
    - lib/format-relative.test.ts (77 lines, 13 Vitest cases using vi.useFakeTimers)
    - .planning/phases/03-admin-picker-identity-rich-display/deferred-items.md (out-of-scope log)
  modified:
    - lib/prime-users.ts (+20 lines: added getDirectoryMetadata; existing exports byte-equivalent)
    - lib/prime-users.test.ts (+51 lines: 3 new cases inside new describe('getDirectoryMetadata') block)

key-decisions:
  - "Honor D-15 cascade exactly as locked in 03-CONTEXT.md (live Prime fullName → fallbackName → email); never throw, treat whitespace-only at every layer as missing."
  - "formatRelative is additive only — DataRefreshButton.tsx inline copy is NOT swapped in this plan (intentional defer to avoid regressing Phase-1 UX before Plan 03-04 wires the new strip)."
  - "getDirectoryMetadata is a read-only metadata accessor — does NOT call Prime, does NOT trigger refresh, returns nulls when blob is missing (D-22 carve-out documented in 03-RESEARCH.md A1)."
  - "All matchers normalize via .trim().toLowerCase() to stay consistent with lib/page-visibility.ts:isAdminEmail (project-wide email invariant)."

patterns-established:
  - "TDD per-task commit pairs: test(03-01) RED then feat(03-01) GREEN for each task."
  - "Pre-existing tsc warnings in Phase 1/2 test files (mockResolvedValueOnce on never) are out-of-scope; logged in deferred-items.md."

requirements-completed: [ADMIN-04, ADMIN-05, DISPLAY-01, DISPLAY-02, DISPLAY-03]

# Metrics
duration: 6min
completed: 2026-04-25
---

# Phase 03 Plan 01: Wave 1 Utilities Summary

**Three pure utilities ship the D-15 three-step identity cascade, a shared formatRelative helper, and a read-only getDirectoryMetadata accessor — Plans 02-05 can now import freely with no execution-order coupling.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-25T01:39:39Z
- **Completed:** 2026-04-25T01:45:48Z
- **Tasks:** 3
- **Files modified:** 5 (3 new, 2 additive edits) + 1 deferred-items.md

## Accomplishments

- D-15 three-step actor cascade (`resolveDisplayName` + `isUnresolvedEmail` + `findPrimeUser`) shipped as pure functions with whitespace-defensive layer checks and case-insensitive email matching.
- Shared `formatRelative()` helper covering all six unit thresholds locked in 03-UI-SPEC, with defensive handling of future timestamps and invalid input.
- Additive `getDirectoryMetadata()` export on `lib/prime-users.ts` so the upcoming GET endpoint (Plan 03-02) can render "Last refreshed: 5 days ago" without recomputing it.
- 28 net-new Vitest cases (15 + 13) plus 3 cases extending the prime-users suite — full project suite passes 74/74.

## Task Commits

Each task was committed atomically using the TDD RED → GREEN pattern:

1. **Task 1 RED:** add failing tests for identity-display cascade — `88c04ba` (test)
2. **Task 1 GREEN:** implement identity-display three-step cascade — `ba6b177` (feat)
3. **Task 2 RED:** add failing tests for formatRelative helper — `c528415` (test)
4. **Task 2 GREEN:** implement formatRelative shared helper — `94829db` (feat)
5. **Task 3 RED:** add failing tests for getDirectoryMetadata — `3415eb2` (test)
6. **Task 3 GREEN:** add getDirectoryMetadata read-only accessor — `d3bb4d0` (feat)

**Plan metadata:** (final docs commit pending — created after self-check)

_TDD gate compliance: each of the three tasks has matching test() then feat() commits — RED preceded GREEN in every case. No REFACTOR pass needed (functions are already minimal)._

## Files Created/Modified

- `lib/identity-display.ts` — D-15 cascade utilities (`resolveDisplayName`, `isUnresolvedEmail`, `findPrimeUser`)
- `lib/identity-display.test.ts` — 15 cases covering all three exports, including whitespace-only fullName + mixed-case email defensive cases
- `lib/format-relative.ts` — shared formatRelative helper accepting `string | Date | number` with full unit coverage and clock-skew defense
- `lib/format-relative.test.ts` — 13 cases using `vi.useFakeTimers` for deterministic boundary checks at 60s / 60min / 24h / 7d / 30d
- `lib/prime-users.ts` — added `getDirectoryMetadata` after `resolveByEmail`; existing functions and types byte-equivalent
- `lib/prime-users.test.ts` — extended SUT imports + appended `describe('getDirectoryMetadata')` block with 3 new cases (populated, missing-blob, falsy-coerce)

## Public API surface for Plans 02-05

```typescript
// from lib/identity-display.ts
export function resolveDisplayName(
  email: string,
  primeUsers: PrimeUser[],
  fallbackName?: string | null,
): string;
export function isUnresolvedEmail(email: string, primeUsers: PrimeUser[]): boolean;
export function findPrimeUser(email: string, primeUsers: PrimeUser[]): PrimeUser | null;

// from lib/format-relative.ts
export function formatRelative(input: string | Date | number): string;

// from lib/prime-users.ts (additive)
export async function getDirectoryMetadata(): Promise<{
  lastSuccessAt: string | null;
  lastError: string | null;
}>;
```

These signatures match the plan's `must_haves.artifacts` exactly — no deviations.

## Decisions Made

- None beyond what is already locked in 03-CONTEXT.md and 03-UI-SPEC.md. Plan 03-01 is a pure execution plan; all design decisions were upstream.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing node_modules**
- **Found during:** Task 1 (first `npx vitest run` invocation)
- **Issue:** `node_modules/` was absent — `npx` resolved to a stale globally-cached `vitest@4.x` whose `vitest/config` import failed under the project's vitest.config.ts.
- **Fix:** Ran `npm install` once at the start of Task 1.
- **Files modified:** none committed (node_modules is gitignored; package.json + package-lock.json already on disk and unchanged).
- **Verification:** `npx vitest run` resolved to the local `node_modules/vitest@4.1.5`; all subsequent test invocations succeeded.
- **Committed in:** none (no source change — environment-only fix).

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking install)
**Impact on plan:** Zero scope creep; environment-only setup. All three tasks executed with the exact code prescribed by 03-PATTERNS.md.

## Issues Encountered

- **Pre-existing TypeScript errors in Phase 1/2 test files.** `npx tsc --noEmit` reports 9 errors in `app/api/auth/login/route.test.ts` (8) and `lib/audit.test.ts` (1) — all `Property 'mockResolvedValueOnce' does not exist on type 'never'` from `vi.mocked()` inference under Vitest 4.1.5. Verified pre-existing via `git stash` + re-run. **Out of scope per scope-boundary rule** (these files are NOT touched by 03-01). Logged in `.planning/phases/03-admin-picker-identity-rich-display/deferred-items.md`. Tests still RUN green via `vitest run` — only `tsc --noEmit` reports them. The plan's acceptance criterion `npx tsc --noEmit exits 0` was inherited from a clean baseline that no longer holds; my changes introduce zero new TS errors.
- **Pre-existing lint warning in `app/report-assist/polish/page.tsx`** (react-hooks/exhaustive-deps on line 533). Pre-existing, unrelated to 03-01. Out of scope.

## TDD Gate Compliance

Plan 03-01 has three tasks, each with `tdd="true"`. Each task gate-checked successfully:

| Task | RED commit | GREEN commit | RED→GREEN order verified |
|------|------------|--------------|--------------------------|
| 1: identity-display | `88c04ba` (test) | `ba6b177` (feat) | yes (RED preceded GREEN; RED failed with "Cannot find module") |
| 2: format-relative | `c528415` (test) | `94829db` (feat) | yes (RED preceded GREEN; RED failed with module-not-found) |
| 3: getDirectoryMetadata | `3415eb2` (test) | `d3bb4d0` (feat) | yes (RED preceded GREEN; RED ran with 3 failing tests + 20 passing existing) |

No fail-fast trigger: in every RED step the new tests genuinely failed before implementation. No REFACTOR commits — all three implementations are minimal and need no cleanup.

## Confirmation: DataRefreshButton inline copy unchanged

Per plan acceptance criterion: `components/ui/DataRefreshButton.tsx` still contains its inline `function formatRelative(date: Date)` helper. Verified via `grep -c "function formatRelative(date: Date)" components/ui/DataRefreshButton.tsx` → 1 match. The swap to the shared helper is intentionally deferred to a later plan (likely 03-04 when the refresh-strip is wired) to avoid broadening this plan's blast radius.

## Test counts

| File | Cases | Notes |
|------|-------|-------|
| lib/identity-display.test.ts | 15 | 8 cascade + 4 isUnresolvedEmail + 3 findPrimeUser |
| lib/format-relative.test.ts | 13 | All 6 unit thresholds + 3 input types + 2 defensive |
| lib/prime-users.test.ts (additive) | +3 (23 total) | populated, missing-blob, falsy-coerce |
| **Project total after 03-01** | 74 | 6 test files, all green |

## Next Phase Readiness

- **Plan 03-02 (Wave 2 — GET /api/admin/prime-users):** `getDirectoryMetadata` and `getAllPrimeUsers` are both available; the route can return `{ users, lastSuccessAt, lastError }` per D-11 with zero new server logic.
- **Plan 03-03 (Wave 2 — `<PrimeUserPicker>`):** `resolveDisplayName` + `isUnresolvedEmail` are ready for chip + dropdown rendering. `formatRelative` is ready for the picker's "Refreshed N ago" strip.
- **Plan 03-04 (Wave 3 — VisibilityTab):** `formatRelative` is ready for the top-of-tab refresh-metadata strip (UI-SPEC §"Refresh Button + Metadata Strip"); cascade utilities ready for GroupCard rows.
- **Plan 03-05 (Wave 4 — AuditTab):** Same cascade utilities power the D-15 three-step actor cell. `entry.name` (Layer 2) is already on `AuditEntry` from Phase 2.
- **No blockers.** Wave 2 plans (02 + 03) can run in parallel.

---
*Phase: 03-admin-picker-identity-rich-display*
*Completed: 2026-04-25*

## Self-Check: PASSED

All 6 files exist on disk and all 6 task commits are reachable in `git log --all`:
- lib/identity-display.ts, lib/identity-display.test.ts
- lib/format-relative.ts, lib/format-relative.test.ts
- .planning/phases/03-admin-picker-identity-rich-display/03-01-SUMMARY.md
- .planning/phases/03-admin-picker-identity-rich-display/deferred-items.md
- Commits: 88c04ba, ba6b177, c528415, 94829db, 3415eb2, d3bb4d0
