---
phase: 03-admin-picker-identity-rich-display
plan: 04
subsystem: ui
tags: [admin-page, picker, audit-cascade, vitest, jsdom, react-context, integration]

# Dependency graph
requires:
  - phase: 03-admin-picker-identity-rich-display (Wave 1, plans 02-03)
    provides: <PrimeUserPicker> component, <PrimeDirectoryProvider> + usePrimeDirectory hook, GET /api/admin/prime-users
  - phase: 03-admin-picker-identity-rich-display (Wave 0, plan 01)
    provides: vitest harness extended for .tsx + JSDOM, RED test scaffold (app/admin/page.test.tsx)
  - phase: 02-session-auth-context
    provides: AuthProvider/useAuth, AuthGuard, prime_user_miss audit event
  - phase: 01-prime-user-directory
    provides: PrimeUser type, blob cache, lowercase-at-store invariant
provides:
  - 3 wired <PrimeUserPicker> mounts in admin/page.tsx (Dashboard Admins, group editor, new group form)
  - <PrimeDirectoryProvider> mounted at AdminPage root (single fetch shared by VisibilityTab + AuditTab)
  - Audit table actor cell renders D-11 cascade (live PrimeUser → entry.name → entry.email)
  - "Prime miss" filter option in AuditTab dropdown (D-13)
  - /api/audit/entries allowlist accepts 'prime_user_miss' (Pitfall 6 paired)
  - aria-label on AuditTab <select>s for accessible-name addressing
affects: [v2-hardening, v2-enforcement, future-admin-features]

# Tech tracking
tech-stack:
  added: []  # Zero new deps Phase-wide. Wave 0 already added vitest+jsdom+RTL.
  patterns:
    - "Defensive name cascade with .trim() (mirrors TopBar.tsx:48 pattern)"
    - "Single Provider + many consumers across sibling tabs (RESEARCH Open Question 2)"
    - "Paired client/server change discipline (Pitfall 6 — dropdown <option> + API allowlist always co-modify)"
    - "vi.hoisted() for stable mock singletons referenced inside vi.mock() factories"

key-files:
  created:
    - .planning/phases/03-admin-picker-identity-rich-display/deferred-items.md  # logged pre-existing TS errors out of scope
  modified:
    - app/admin/page.tsx                  # 5 surgical mods + aria-label addition
    - app/api/audit/entries/route.ts      # 1-line allowlist update
    - app/admin/page.test.tsx             # mock setup fixes (router stability + tab=audit + auth re-prime)

key-decisions:
  - "Provider lives at AdminPage root, NOT inside VisibilityTab — both VisibilityTab and AuditTab are sibling consumers; mounting inside one tab would re-fetch on every tab switch and starve the other tab"
  - "Save handler now sends config.admins as-is (string[] from picker) instead of parsing a textarea — VisibilityConfig blob schema unchanged (admins/members both still string[]); existing POST /api/admin/page-visibility belt-and-braces server-side normalization still runs"
  - "GroupCard prop renamed from onUpdateMembers(raw: string) to onUpdateMembersList(emails: string[]) — picker emits arrays directly, no parse step needed"
  - "ActionFilter type widened to include 'prime_user_miss' — kept 'all'|'login'|'logout'|'prime_user_miss' (avoid renaming/restructuring the discriminated union)"
  - "aria-label='Action filter' added to the AuditTab action-filter <select> — needed for getByRole('combobox', {name: /action|filter/i}) and improves accessibility (Rule 2)"
  - "vi.hoisted() singleton for the routerStub — required because vi.mock() factories are hoisted above all imports, and a bare top-level const wouldn't be in scope at hoist time"

patterns-established:
  - "Cascade resolver mirrored from TopBar (Phase 2): live?.fullName?.trim() || entry.name || entry.email — .trim() short-circuits whitespace-only Prime data"
  - "D-12 dedup: const showEmailLine = displayName !== entry.email — prevents email/email visual repetition in the secondary line"
  - "byEmail.get(entry.email.toLowerCase()) — Pitfall 4 belt-and-braces lookup even though Phase 1 already lowercases at store"

requirements-completed:
  - ADMIN-01
  - ADMIN-02
  - ADMIN-03
  - ADMIN-04
  - ADMIN-05
  - DISPLAY-01
  - DISPLAY-02
  - DISPLAY-03

# Metrics
duration: ~50min
completed: 2026-04-24
---

# Phase 03 Plan 04: Admin Page Wiring + Audit Cascade + Filter Extension Summary

**Wired Wave 1's PrimeUserPicker + PrimeDirectoryProvider into 3 admin sites and a Prime-aware audit cascade, closing all 8 Phase 3 requirements with zero schema changes and zero new dependencies.**

## Performance

- **Duration:** ~50 minutes (executor wall time, including test infrastructure debugging)
- **Started:** 2026-04-24T21:11Z
- **Completed:** 2026-04-24T22:02Z (implementation tasks complete; awaiting Task 3 human-verify checkpoint)
- **Tasks:** 2 of 3 implementation tasks complete; Task 3 is a blocking checkpoint:human-verify
- **Files modified:** 3 (app/admin/page.tsx, app/admin/page.test.tsx, app/api/audit/entries/route.ts)
- **Files created:** 1 (deferred-items.md)
- **Lines:** +96 / -67 vs base commit `1fbfefe`

## Accomplishments

- Three `<PrimeUserPicker>` mounts wired (Dashboard Admins / Group member editor / New Group form)
- `<PrimeDirectoryProvider>` mounted at `<AdminPage>` root — single fetch shared by both VisibilityTab and AuditTab, survives tab switches (D-16)
- Audit table actor cells render the D-11 cascade with `.trim()` defensiveness (TopBar pattern)
- Audit filter dropdown gains "Prime miss" option between Login and Logout (D-13)
- `/api/audit/entries` allowlist accepts `prime_user_miss` (Pitfall 6 paired change)
- 6 RED admin-page tests turned GREEN; full Vitest suite 69/69 passing (was 63/69 on main, the 6 missing were exactly the RED scaffold)
- VisibilityConfig blob schema unchanged (D-23 honored — admins/members still string[])
- Zero new dependencies (`git diff package.json` shows no changes)

## Task Commits

1. **Task 1: Wire Provider + 3 picker mounts + audit cascade + filter dropdown extension** — `e69534d` (feat)
2. **Task 2: Allowlist 'prime_user_miss' in /api/audit/entries** — `0578eb0` (feat)
3. **Task 3: HUMAN-VERIFY checkpoint** — pending (blocking)

**Plan metadata commit (SUMMARY.md):** added at end of this worktree session.

## Files Created/Modified

- `app/admin/page.tsx` — 5 surgical modifications: Provider mount, 3 picker mounts (admins/group/new-group), AuditTab cascade + filter option + aria-label additions. State simplified (raw-string textareas → string[] picker callbacks).
- `app/api/audit/entries/route.ts` — 1-line allowlist update: `['login', 'logout']` → `['login', 'logout', 'prime_user_miss']`. No other changes.
- `app/admin/page.test.tsx` — Test mock infrastructure fixes (Rule 3 deviation, see below).
- `.planning/phases/03-admin-picker-identity-rich-display/deferred-items.md` — Logged pre-existing TS errors that exist on the clean base.

## Decisions Made

- **Save handler simplification (no parse step):** Picker emits `string[]` from a Set-deduped, lowercased Prime data source. The previous `.split(/[\n,]+/).map(.toLowerCase()).filter(Boolean)` parse is removed for both the admin emails save and the new-group save. Server-side `POST /api/admin/page-visibility` already re-normalizes — the client-side parse was duplicate work. VisibilityConfig blob schema unchanged.
- **`aria-label="Action filter"` on the action-filter `<select>` (NEW, not in plan):** The Wave 0 RED test queries `screen.getByRole('combobox', { name: /action|filter/i })`. Without an accessible name on the `<select>`, the query fails. Adding `aria-label` is non-visual (UI-SPEC Surface 13 visual register preserved) and improves accessibility for keyboard / screen-reader users (Rule 2). Date-range `<select>` also got `aria-label="Date range"` (avoiding the word "filter" so the regex disambiguates).
- **Provider mount placement:** AdminPage root, not VisibilityTab. RESEARCH Open Question 2 was decisive — both tabs consume `byEmail`, and mounting inside one tab would either re-fetch on every tab switch or leave the other tab without a directory. The Provider must outlive any single tab.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `aria-label` to AuditTab `<select>` elements**
- **Found during:** Task 1 (verifying RED tests turn GREEN)
- **Issue:** Wave 0 RED test queries `screen.getByRole('combobox', { name: /action|filter/i })`; the `<label>Action:</label>` markup wasn't `htmlFor`-linked to the `<select>`, so RTL couldn't find a combobox by accessible name. Both correctness (test passes) and accessibility (screen-reader users couldn't address the control by name) were affected.
- **Fix:** Added `aria-label="Action filter"` to the action-filter `<select>` and `aria-label="Date range"` to the range-filter `<select>` (avoiding the word "filter" in the latter so the test regex `/action|filter/i` matches exactly one element).
- **Files modified:** `app/admin/page.tsx`
- **Verification:** RED test "selecting Prime miss issues a fetch with action=prime_user_miss" turned GREEN.
- **Committed in:** `e69534d`

**2. [Rule 3 - Blocking] Wave 0 test mock setup needed three fixes to be runnable**
- **Found during:** Task 1 (running tests to verify GREEN state)
- **Issue:** The Wave 0 RED scaffold's mocks were under-specified for the GREEN scenario:
  1. `useSearchParams: () => new URLSearchParams()` — empty params meant AdminPage defaulted to `tab='visibility'`, so VisibilityTab rendered and crashed on `config.groups.length` (the global fetch mock returned audit-shaped JSON, leaving config undefined).
  2. `useRouter: () => ({...})` returned a *fresh object every render* — AuditTab's `fetchEntries` is `useCallback(..., [actionFilter, rangeFilter, router])`, so a new router each render meant a new fetchEntries each render → `useEffect(() => { fetchEntries(); }, [fetchEntries])` re-fired every render → setState in fetch resolution → re-render → infinite loop. This was the root cause of the test runner hanging at 90+ seconds.
  3. `vi.resetAllMocks()` in `beforeEach` clears `vi.fn(impl)` implementations, including the `useAuth` mock from the factory. Subsequent renders saw `useAuth() === undefined` and crashed on `const { isAdmin } = useAuth()`.
- **Fix:**
  1. `useSearchParams: () => new URLSearchParams('tab=audit')` — assertions are AuditTab-scoped; this is the only way to make them reachable.
  2. Hoisted singleton `routerStub` via `vi.hoisted()` — `vi.mock()` factories are hoisted above all imports, so a bare top-level `const` would not be in scope when the factory runs.
  3. Added `mockedUseAuth.mockReturnValue({...})` inside `beforeEach` to re-prime the auth mock after `vi.resetAllMocks()`.
- **Files modified:** `app/admin/page.test.tsx`
- **Verification:** All 6 admin-page tests now pass; full Vitest suite 69/69 GREEN; no test runner hangs.
- **Committed in:** `e69534d` (alongside the production code changes — the test fixes are part of the same RED→GREEN cycle).

---

**Total deviations:** 2 auto-fixed (1 missing critical / accessibility, 1 blocking / test infrastructure)
**Impact on plan:** Both fixes are essential to make the Wave 0 RED tests turn GREEN as promised. The accessibility fix is a Phase-3-aligned addition (UI-SPEC visual register unchanged; only ARIA semantic added). The test infrastructure fixes are confined to the test file and do not affect production code semantics.

## Issues Encountered

- **Test runner hang (~90s+ before timeout):** Initially mistook this for a vitest performance issue. Root cause was the `useRouter` mock returning a fresh object each render, causing AuditTab's `useCallback`/`useEffect` chain to re-fire infinitely. Resolved with the `vi.hoisted()` singleton fix described above.
- **Pre-existing TS errors:** `npx tsc --noEmit` reports 9 errors (8 in `app/api/auth/login/route.test.ts`, 1 in `lib/audit.test.ts`) — all `mockResolvedValueOnce` typing issues. Confirmed via `git stash` that they exist on the clean base commit `1fbfefe`. Out of scope per the scope-boundary rule; logged in `deferred-items.md` for the next maintenance pass.

## Verification Status

- [x] All 6 RED admin-page tests GREEN (`npx vitest run app/admin/page.test.tsx` exits 0, ~28s)
- [x] Full Vitest suite GREEN (`npx vitest run` exits 0, 69/69, ~22s)
- [x] No edits to `lib/page-visibility.ts` (`git diff lib/page-visibility.ts` empty)
- [x] No new dependencies (`git diff package.json` empty)
- [x] All 3 picker mount sites verified via grep
- [x] Locked placeholders verified via exact-string grep (1× admin emails copy, 2× group/new-group copy)
- [x] D-11 cascade verified via grep (`live?.fullName?.trim() || entry.name || entry.email`)
- [x] D-12 dedup verified via grep (`displayName !== entry.email`)
- [x] D-13 paired change verified (dropdown `<option value="prime_user_miss">Prime miss</option>` + API allowlist `'prime_user_miss'`)
- [x] Pitfall 4 belt-and-braces verified (`entry.email.toLowerCase()` lookup)
- [x] UI-SPEC Surface 12 visual classes preserved (`text-gray-300 text-sm`, `text-gray-600 text-xs`, `hover:bg-gray-800/30` all still present)
- [ ] Task 3 — `checkpoint:human-verify` (8 manual UAT items) — **PENDING orchestrator routing**

## Known Stubs

None. All UI surfaces wired to live data sources; no placeholder text or hardcoded empty values were introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 3 implementation is feature-complete pending the Task 3 human-verify checkpoint.
- After human approval, Phase 3 closes ALL 8 milestone requirements (ADMIN-01..05 + DISPLAY-01..03).
- Ready for `/gsd-verify-work` once the checkpoint resolves.
- v1.0 hardening / enforcement (e.g., NAV-DRIFT, ADMIN-AUDIT-01 config-change auditing) remains explicitly v2-deferred per REQUIREMENTS.md.

## Self-Check: PASSED

Verified:
- `app/admin/page.tsx` modified (commit `e69534d` present in `git log`)
- `app/api/audit/entries/route.ts` modified (commit `0578eb0` present in `git log`)
- `app/admin/page.test.tsx` modified (test infrastructure fixes — part of `e69534d`)
- `.planning/phases/03-admin-picker-identity-rich-display/deferred-items.md` exists
- `lib/page-visibility.ts` UNCHANGED (`git diff lib/page-visibility.ts` empty — D-23 schema invariant honored)
- `package.json` UNCHANGED (`git diff package.json` empty — zero new deps Phase-wide)

---
*Phase: 03-admin-picker-identity-rich-display*
*Plan: 04*
*Completed: 2026-04-24*
