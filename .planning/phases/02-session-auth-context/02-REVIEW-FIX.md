---
phase: 02-session-auth-context
fixed_at: 2026-04-24T00:00:00Z
review_path: .planning/phases/02-session-auth-context/02-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-04-24
**Source review:** `.planning/phases/02-session-auth-context/02-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (Critical + Warning only — Info findings deferred)
- Fixed: 2
- Skipped: 0
- Test suite: **43/43 GREEN** (baseline was 42/42; +1 new WR-01 anti-regression test)

## Fixed Issues

### WR-01: Login miss path issues TWO sequential `getAllPrimeUsers` calls and can chain Prime API requests on bootstrap

**Files modified:** `app/api/auth/login/route.ts`, `app/api/auth/login/route.test.ts`
**Commit:** `488c715`
**Applied fix:** Adopted REVIEW Option A — replaced the `resolveByEmail()` + second `getAllPrimeUsers()` pair with a single `getAllPrimeUsers()` followed by a local `find()` against the already-normalised email. `resolveByEmail` removed from the import list (route is the only caller in this file). Inline comment expanded to capture the WR-01 rationale and the normalisation invariant that makes the local lookup semantically equivalent.

**Test impact:** Mirrored the contract change in `route.test.ts` — dropped the `resolveByEmail` mock from the module-boundary mock factory, switched the seven existing tests to mock `getAllPrimeUsers` directly, and added one new test (`'looks up the directory exactly ONCE per login on the miss path'`) that asserts `mockedGetAll.toHaveBeenCalledTimes(1)` to lock in the single-fetch contract against future regression. Replaced the `'calls resolveByEmail with the lowercased+trimmed email'` test with `'matches Prime users using the lowercased+trimmed email'` — same normalisation invariant, asserted against the new code path. Test count: 8 → 9 (full suite: 42 → 43).

### WR-02: `prime_user_miss` rows share the 200-entry audit ring buffer with `login` / `logout`

**Files modified:** `lib/audit.ts`
**Commit:** `08ac6bf`
**Applied fix:** Took the cheaper of the two options the review proposed — bumped `MAX_ENTRIES` from 200 to 500 with an inline comment explaining the Phase 2 context (shared writer + outage-amplification math). Stream-splitting deferred per review guidance ("unless a stream-split feels strongly warranted") since it would require a new blob key, a separate `MAX_ENTRIES`, and `/api/audit/entries` route changes for marginal benefit at current scale.

**Test impact:** None — `lib/audit.test.ts` does not assert against the cap value. 6/6 audit tests still GREEN.

## Skipped Issues

None.

## Out of Scope (Info-severity findings, per `fix_scope: critical_warning`)

The following Info findings from REVIEW.md were intentionally NOT fixed in this iteration. They are admin-page UX gaps (IN-01, IN-02), a documented-and-intentional behavioural choice (IN-03), and pre-existing tech debt unrelated to the Phase 2 diff (IN-04). All are appropriate follow-ups but none block phase verification:

- **IN-01:** Admin `actionFilter` UI does not include `prime_user_miss`
- **IN-02:** CSV export omits the `detail` column
- **IN-03:** Login response uses email as `userName` even when Prime resolution succeeds (correct per D-03/D-09 contract; flagged for UAT clarity only)
- **IN-04:** Pre-existing duplicate-fetch + 500ms timeout in admin page (predates Phase 2)

---

_Fixed: 2026-04-24_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
