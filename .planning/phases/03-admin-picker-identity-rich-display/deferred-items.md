# Phase 03 Deferred Items

Out-of-scope discoveries logged during execution. NOT fixed by current plans.

---

## Pre-existing TypeScript errors in test files (discovered during 03-01)

**Discovered:** 2026-04-25 during `npx tsc --noEmit` for plan 03-01 acceptance check.

**Count:** 9 errors, all pre-existing (verified by `git stash` + re-run).

**Files affected (pre-existing — not modified by 03-01):**
- `app/api/auth/login/route.test.ts` — 8 errors at lines 93, 105, 120, 137, 150, 162, 177, 188
- `lib/audit.test.ts` — 1 error at line 117

**Pattern:** `Property 'mockResolvedValueOnce' does not exist on type 'never'` — `vi.mocked()` inference issue with the installed Vitest version (4.1.5).

**Why deferred:** Scope boundary — these errors live in Phase 1 / Phase 2 test files that 03-01 does NOT modify. Tests still RUN green (`vitest run` passes); only `tsc --noEmit` reports them. The acceptance criterion "`npx tsc --noEmit` exits 0" in 03-01-PLAN.md was inherited from a clean baseline that no longer holds.

**Action proposed:** Address in a future hardening pass — likely a one-line fix per call site using `as never` or refining the `vi.mocked()` type inference. Not blocking for any Phase 3 plan.

**Verifier note:** `npx vitest run` (full suite) PASSES — these are TS-only complaints, not test failures.
