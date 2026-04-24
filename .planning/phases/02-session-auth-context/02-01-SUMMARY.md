---
phase: 02-session-auth-context
plan: 01
subsystem: testing
tags: [vitest, audit, contract-tests, tdd, wave-0]

# Dependency graph
requires:
  - phase: 01-prime-user-directory
    provides: PrimeUser type, resolveByEmail, getAllPrimeUsers (lib/prime-users.ts)
provides:
  - AuditEntry.action union widened with 'prime_user_miss' literal
  - AuditEntry.detail?: string optional field for cache-state diagnostics
  - vitest discovery extended to app/**/*.test.ts (Pitfall 1 / Option A)
  - lib/audit.test.ts (6 GREEN tests — type-extension contract)
  - app/api/auth/session/route.test.ts (8 contract tests, 4 RED — pinned for Plan 02-02)
  - app/api/auth/login/route.test.ts (8 contract tests, 3 RED — pinned for Plan 02-03)
  - VALIDATION.md per-task verification map populated; nyquist_compliant: true; wave_0_complete: true
  - Forgery guard documented above app/api/audit/log/route.ts VALID_ACTIONS allowlist
affects: [02-02-session-route, 02-03-login-route, 02-04-auth-context-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-test-first (D-16): RED contract tests in Wave 0 pin Wave 1 implementation shapes"
    - "Module-boundary mocking via @/lib/* paths (NOT next/headers / iron-session) per Pitfall 2"
    - "Forgery-guard invariant: server-only audit literals MUST NOT appear in browser-callable VALID_ACTIONS allowlist"
    - "Additive type widening (A2/A3): union extension + optional field stays backward-compat with persisted blob rows"

key-files:
  created:
    - lib/audit.test.ts
    - app/api/auth/session/route.test.ts
    - app/api/auth/login/route.test.ts
  modified:
    - lib/audit.ts
    - vitest.config.ts
    - app/api/audit/log/route.ts
    - .planning/phases/02-session-auth-context/02-VALIDATION.md

key-decisions:
  - "Vitest glob widened to ['lib/**/*.test.ts', 'app/**/*.test.ts'] (Option A) — accepts co-located route tests in app/"
  - "@/lib/session boundary mock chosen over mocking the underlying request-cookie module — fewer mocks, matches Phase 1 convention"
  - "Forgery guard preserved: VALID_ACTIONS in app/api/audit/log/route.ts stays ['login', 'logout'] — prime_user_miss is server-written only"
  - "ActionBadge fix scoped to Phase 2 Plan 04 Task 3 (NOT deferred to Phase 3 DISPLAY-03)"

patterns-established:
  - "Wave 0 closes planning gates with type extensions + RED contract tests before any Wave 1 implementation lands"
  - "Test fixture helpers (makeSession, makePrimeUser, makeOAuthOk/Fail, makeReq) at top of each route test file mirror lib/prime-users.test.ts:60-87 style"
  - "Console-spy + mockRestore pattern for tests exercising error-logging paths"

requirements-completed: [SESSION-02]

# Metrics
duration: ~10min
completed: 2026-04-24
---

# Phase 02 Plan 01: Wave 0 Test Scaffolds Summary

**AuditEntry union widened with 'prime_user_miss' literal + optional detail field, vitest glob extended to app/**, three new test files (one GREEN type-extension test, two RED contract scaffolds) shipped, VALIDATION.md gates flipped to wave_0_complete: true.**

## Performance

- **Duration:** ~10 min (excluding ~2 min npm install for fresh worktree)
- **Started:** 2026-04-24T04:34:00Z
- **Completed:** 2026-04-24T04:44:09Z
- **Tasks:** 5/5
- **Files modified:** 4
- **Files created:** 3

## Accomplishments

- AuditEntry type widened — `'login' | 'logout' | 'prime_user_miss'` with optional `detail?: string` (additive, A2/A3 backward-compat)
- Vitest test discovery now covers `app/**/*.test.ts` in addition to `lib/**/*.test.ts` (Pitfall 1 closed)
- 22 new test cases shipped across 3 files (6 GREEN audit + 8 session contract + 8 login contract)
- Forgery-guard documented above `app/api/audit/log/route.ts` `VALID_ACTIONS` — explicit warning that server-only literals must not be added (T-02-04 mitigation)
- 02-VALIDATION.md per-task map populated for ALL 10 tasks across plans 02-01..02-04; both Wave 0 frontmatter flags flipped to true; sign-off boxes ticked
- Plans 02-02 and 02-03 can now proceed with their test contracts already pinned in red — no spec drift risk

## Task Commits

Each task was committed atomically (worktree mode — commits will be merged by orchestrator):

1. **Task 1: Extend AuditEntry union + widen vitest glob** — `c00e2a1` (feat)
2. **Task 2: lib/audit.test.ts — round-trip tests for prime_user_miss + detail** — `a8543da` (test)
3. **Task 3: app/api/auth/session/route.test.ts — failing contract tests (SESSION-01/03)** — `a1bfa5b` (test)
4. **Task 4: app/api/auth/login/route.test.ts — failing contract tests (SESSION-02 + D-04)** — `432fd47` (test)
5. **Task 5: Populate VALIDATION.md verification map + flip nyquist_compliant** — `8404eb8` (docs)

_Note: TDD plan ran in two-phase shape — Task 1 establishes the type contract (effectively the GREEN gate for Task 2's tests); Tasks 3 & 4 are RED scaffolds that Wave 1 plans (02-02 and 02-03) will turn GREEN._

## Files Created/Modified

- **`lib/audit.ts`** — AuditEntry.action union widened; AuditEntry.detail?: string added. appendAuditLog signature unchanged (parameter type widens automatically via Omit<>). readAuditLog unchanged (JSON.parse tolerates absent detail field).
- **`vitest.config.ts`** — `include` glob widened from `['lib/**/*.test.ts']` to `['lib/**/*.test.ts', 'app/**/*.test.ts']`.
- **`app/api/audit/log/route.ts`** — Added single-line forgery-guard comment above `VALID_ACTIONS`. Allowlist value untouched.
- **`lib/audit.test.ts`** *(new)* — 6 GREEN tests across 3 describe blocks: type acceptance with/without detail, round-trip with cache_hit/cache_empty detail, silent-fail invariant, legacy-row backward compat.
- **`app/api/auth/session/route.test.ts`** *(new)* — 8 tests across 4 describe blocks. 4 GREEN (auth-cascade invariants), 4 RED (primeUser field, resolveByEmail call, primeUser:null on miss, [session] log prefix) — pinned for Plan 02-02.
- **`app/api/auth/login/route.test.ts`** *(new)* — 8 tests in 1 describe block. 5 GREEN (login audit count, OAuth-failure ordering, response shape, rate-limit short-circuit), 3 RED (cache_hit detail, cache_empty detail, email normalisation through resolveByEmail) — pinned for Plan 02-03.
- **`.planning/phases/02-session-auth-context/02-VALIDATION.md`** — Frontmatter `nyquist_compliant: true`, `wave_0_complete: true`. Per-task map populated with 10 rows. Wave 0 Requirements: 4/4 ticked. Validation Sign-Off: 6/6 ticked. Approval: ready.

## Decisions Made

- **Vitest glob Option A over Option B** — Widened the include glob to cover `app/**/*.test.ts` rather than extracting helpers to `lib/auth/`. Co-located tests are conventional in Next.js App Router; the glob change is a one-line config edit; helper extraction would have been ~3 new files plus rewiring two route handlers — more surface for marginal gain.
- **`@/lib/session` boundary mock for route tests** — Mocking at the import boundary (`vi.mock('@/lib/session', ...)`) is the Phase 1 convention from `lib/prime-users.test.ts:39-47`. Mocking `next/headers` + `iron-session` directly would require ≥3 nested mocks per test file with no benefit.
- **Forgery-guard comment phrased without the `prime_user_miss` literal** — The plan's acceptance criterion (`grep -c "prime_user_miss" app/api/audit/log/route.ts` returns 0) drove the comment to use the descriptive phrase "the Prime-resolution miss event" instead of the bare literal. Same security message, zero literal references in the browser-callable POST endpoint.
- **ActionBadge scope in Phase 2 (Plan 04 Task 3) NOT deferred to Phase 3 DISPLAY-03** — VALIDATION.md per-task map binds the badge fix to Plan 02-04 Task 3 to prevent shipping mislabeled "Logout" badges for the new `prime_user_miss` rows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded forgery-guard comment to satisfy acceptance criterion**
- **Found during:** Task 1 (Extend AuditEntry union + widen vitest glob)
- **Issue:** The plan's recommended comment text (`// SECURITY: prime_user_miss is server-only ...`) contained the literal `prime_user_miss`, which conflicted with the acceptance criterion `grep -c "prime_user_miss" app/api/audit/log/route.ts` returns 0. Two requirements pointed in opposite directions.
- **Fix:** Rephrased the comment to convey the same security guidance using the descriptive phrase "the Prime-resolution miss event" rather than the bare literal. Allowlist behavior (forgery guard) preserved; acceptance criterion satisfied.
- **Files modified:** `app/api/audit/log/route.ts`
- **Verification:** `grep -F -c "VALID_ACTIONS = ['login', 'logout'] as const"` returns 1 (intact); `grep -c "prime_user_miss"` returns 0; `grep -n "SECURITY"` confirms guard comment present.
- **Committed in:** c00e2a1 (Task 1 commit)

**2. [Rule 3 - Blocking] Reworded test-file boundary-mock comment to satisfy `next/headers` grep criterion**
- **Found during:** Task 3 (app/api/auth/session/route.test.ts)
- **Issue:** The plan's recommended top-of-file comment `// Module-boundary mocks (Pitfall 2 — mock @/lib/session, NOT next/headers).` contained the literal `next/headers`, conflicting with acceptance criterion `grep -c "next/headers" app/api/auth/session/route.test.ts returns 0`.
- **Fix:** Rephrased to "mock @/lib/session at the import boundary, NOT the underlying request-cookie module" — preserves the Pitfall 2 guidance while removing the literal token.
- **Files modified:** `app/api/auth/session/route.test.ts`
- **Verification:** `grep -c "next/headers"` returns 0; tests still discoverable and harness still runs cleanly.
- **Committed in:** a1bfa5b (Task 3 commit)

**3. [Rule 3 - Blocking] Adjusted RateLimitResult test fixture to include `remaining` field**
- **Found during:** Task 4 (app/api/auth/login/route.test.ts)
- **Issue:** Plan-supplied mock used `{ allowed: true, resetAt: 0 }` but the real `RateLimitResult` interface (lib/rate-limit.ts:14-18) requires `remaining: number` as well. TypeScript would have rejected the mock.
- **Fix:** Added `remaining: 9` (allowed) / `remaining: 0` (denied) to both `mockedRateLimit.mockReturnValue(...)` calls. Behavior unchanged; type contract satisfied.
- **Files modified:** `app/api/auth/login/route.test.ts`
- **Verification:** `npx vitest run app/api/auth/login/route.test.ts` runs to completion; rate-limit short-circuit test passes (5 GREEN, 3 RED as designed).
- **Committed in:** 432fd47 (Task 4 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking, all minor — all test/comment fidelity tweaks). Zero behavior changes from the plan; only adjustments to satisfy strict grep-based acceptance criteria and a missing field in the supplied mock.
**Impact on plan:** No scope creep. Every plan-listed `<acceptance_criteria>` row passes. Plan's intended behavior (security guidance preserved, contract tests pinned, glob widened) shipped exactly as designed.

## Issues Encountered

- **Pre-existing build failure unrelated to plan scope:** `npm run build` fails with `Missing credentials. Please pass an apiKey, or set the OPENAI_API_KEY environment variable.` from `app/api/report-assist/*` route. This is an environment issue (no `.env.local` in worktree), not a regression from any Plan 02-01 change. Used `npx tsc --noEmit` as the actual TypeScript health check — passes cleanly with no output. Documented to `deferred-items.md` is unnecessary because this is a per-environment artifact, not a code defect.
- **Worktree branch base mismatch on agent start:** Branch was based on `f29db2b4` instead of expected `f80cf7e6`. Hard-reset per worktree_branch_check protocol; confirmed HEAD now matches expected base before any work began.
- **node_modules absent in worktree:** Required `npm install` (~2 min, 499 packages) before tests/typecheck could run. Standard worktree initialization.

## User Setup Required

None — no external service configuration introduced. All new files use mocked dependencies; no env vars required.

## Next Phase Readiness

**Wave 1 plans (02-02, 02-03) are unblocked:**
- `app/api/auth/session/route.test.ts` has 4 RED contract tests — Plan 02-02 closes them by importing `resolveByEmail`, adding `primeUser` to the response, and switching the error log prefix to `[session]`.
- `app/api/auth/login/route.test.ts` has 3 RED contract tests — Plan 02-03 closes them by importing `resolveByEmail` + `getAllPrimeUsers` and writing the cache-state-discriminated `'prime_user_miss'` audit AFTER `session.save()`.
- Both routes will use the `'prime_user_miss'` literal which is now accepted by the `AuditEntry.action` union (Task 1).

**Verification snapshot at end of Wave 0:**
- 4 test files discovered by vitest (lib/prime-users.test.ts, lib/audit.test.ts, app/api/auth/session/route.test.ts, app/api/auth/login/route.test.ts)
- 42 total tests: 35 GREEN, 7 RED (4 in session-route + 3 in login-route — exactly the contracts pinned for Wave 1)
- VALIDATION.md `nyquist_compliant: true`, `wave_0_complete: true`, all 4 Wave 0 gates ticked, Approval: ready

**No blockers for Wave 1.**

## Self-Check: PASSED

- File `lib/audit.ts` exists (modified)
- File `vitest.config.ts` exists (modified)
- File `app/api/audit/log/route.ts` exists (modified)
- File `lib/audit.test.ts` exists (created)
- File `app/api/auth/session/route.test.ts` exists (created)
- File `app/api/auth/login/route.test.ts` exists (created)
- File `.planning/phases/02-session-auth-context/02-VALIDATION.md` exists (modified)
- Commit `c00e2a1` (Task 1 — feat) present in git log
- Commit `a8543da` (Task 2 — test) present in git log
- Commit `a1bfa5b` (Task 3 — test) present in git log
- Commit `432fd47` (Task 4 — test) present in git log
- Commit `8404eb8` (Task 5 — docs) present in git log

---
*Phase: 02-session-auth-context*
*Completed: 2026-04-24*
