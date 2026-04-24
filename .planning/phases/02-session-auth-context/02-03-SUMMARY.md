---
phase: 02-session-auth-context
plan: 03
subsystem: auth
tags: [auth, login, audit, prime-resolution, api-route, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-prime-user-directory
    provides: resolveByEmail() + getAllPrimeUsers() (no-throw, cache-first per D-16) — consumed verbatim from lib/prime-users.ts
  - phase: 02-session-auth-context (Wave 0 — Plan 02-01)
    provides: AuditEntry.action union widened to include 'prime_user_miss'; AuditEntry.detail field added; route.test.ts RED scaffold (8 tests pinning SESSION-02 + D-04 + D-06)
provides:
  - Login route writes a 'prime_user_miss' audit row on Prime-directory miss with cache-state discrimination ('cache_empty' vs 'cache_hit: no match')
  - Pitfall-6-safe call-site placement — resolveByEmail runs ONLY after session.save() and only on the OAuth-success branch
  - Login response shape contract enforced — no primeUser leak (D-04 / D-07 separation upheld)
  - 8 SESSION-02 contract tests flipped RED → GREEN (Wave-0 scaffold tests now passing)
affects: [02-02 (session route — sibling Wave-1 worktree), 02-04 (TopBar identity surface — depends on session-route delivery), admin audit log UI (DISPLAY-03 in Phase 3 — surfaces prime_user_miss rows)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Defensive call to never-throwing module — no try/catch around resolveByEmail / getAllPrimeUsers (Phase 1 D-16 contract)"
    - "Cache-state discrimination via length check — 'cache_empty' vs 'cache_hit: no match' detail string is admin-actionable signal (D-06)"
    - "Physical-line-ordering invariant — OAuth-failure return < session.save() < existing 'login' audit < resolveByEmail < miss-audit < success response. Acceptance criteria assert via grep -n. (Pitfall 6)"
    - "Audit-write inheriting silent-fail invariant — appendAuditLog already swallows blob-write failures (lib/audit.ts:38), miss-audit inherits"

key-files:
  created:
    - .planning/phases/02-session-auth-context/02-03-SUMMARY.md
    - .planning/phases/02-session-auth-context/deferred-items.md
  modified:
    - app/api/auth/login/route.ts (+22 lines: 1 import, 1 resolveByEmail call, 1 conditional miss-audit block; net 102→124 lines)

key-decisions:
  - "Inline comment at the resolveByEmail call site documents D-04 / Pitfall 6 ordering invariant — encoded in the source so future refactors see the constraint at the call site, not just in the plan."
  - "miss-audit email field uses normalisedEmail (the lowercased+trimmed value), matching the value passed to resolveByEmail — symmetric with the existing 'login' audit's normalised email."
  - "No try/catch around resolveByEmail / getAllPrimeUsers — Phase 1 D-16 guarantees no-throw; the outer try at line 32 is the only safety net needed (Phase 2 PATTERNS Anti-Pattern)."
  - "Login response stays {success: true, userName} — D-04 forbids returning primeUser in login response; the delivery path is /api/auth/session (Plan 02-02)."

patterns-established:
  - "Pattern: Phase-1-cache-as-audit-signal — login route uses Phase 1 directory NOT to deliver identity (that's the session route) but to record an audit event distinguishing real misses from cache outages. This pattern applies to any future audit-emitting consumer of a no-throw cache."
  - "Pattern: Order-by-line-number invariant assertion — acceptance criteria measure physical line numbers (grep -n) to enforce that OAuth-failure paths execute BEFORE Prime resolution. Tests reinforce via mockedResolve.not.toHaveBeenCalled() on the failure path."

requirements-completed: [SESSION-02]

# Metrics
duration: ~7 min
completed: 2026-04-24
---

# Phase 02 Plan 03: Login Route Prime Resolution + Cache-State Miss Audit Summary

**Wired resolveByEmail() into app/api/auth/login/route.ts AFTER session.save() and the existing 'login' audit, writing a prime_user_miss audit row on miss with detail='cache_empty' or 'cache_hit: no match' per D-06 — closes SESSION-02.**

## Performance

- **Duration:** ~7 min (388 s)
- **Started:** 2026-04-24T04:50:55Z
- **Completed:** 2026-04-24T04:58:00Z (approx — wall clock)
- **Tasks:** 1 (single-task plan; TDD tests pre-scaffolded in Wave 0)
- **Files modified:** 1 runtime file (+ 2 plan-dir docs created)

## Accomplishments

- Login route now calls `resolveByEmail(normalisedEmail)` exactly once on the OAuth-success branch, after `session.save()` and after the existing `'login'` audit fires (5-step physical line ordering preserved verbatim from PATTERNS § "Phase 2 insertion (D-04, D-06)").
- On a Prime miss, `getAllPrimeUsers()` is called O(1) against the Phase-1 in-memory blob-cache, and a `prime_user_miss` audit row is written with `detail = 'cache_empty'` (when the directory is empty) or `'cache_hit: no match'` (when populated but email absent) — an admin reviewing the audit log can now distinguish "Jane isn't a Prime user" from "Prime was down when Jane logged in".
- All 8 contract tests in `app/api/auth/login/route.test.ts` (Wave 0 RED scaffold) flipped GREEN. Includes the four originally-RED tests pinning SESSION-02 + D-04 + D-06 specifically, plus four invariant guards (rate-limit short-circuit, OAuth-failure short-circuit, login-audit-fires-once-on-miss, response-shape-no-primeUser-leak).
- Login response shape unchanged at `{success: true, userName}` — `primeUser` does NOT appear in the response body (D-04 / D-07 separation upheld; the delivery path is `/api/auth/session` via Plan 02-02 in the sibling worktree).
- Inline comments at the call site document the D-04 / Pitfall 6 ordering invariant in the source so future refactors see the constraint without needing to consult the plan.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-executor convention):

1. **Task 1: Extend login route — resolveByEmail post-auth + cache-state-aware prime_user_miss audit (D-04, D-06, Pitfall 6)** — `6884506` (feat)

_Note: This is a single-task plan. TDD tests were pre-scaffolded in Wave 0 (Plan 02-01), so no separate `test(...)` commit was authored in 02-03 — the GREEN flip is captured in the same `feat(...)` commit that wires the implementation. RED state was verified locally before the edit (3 failed / 5 passed)._

## Files Created/Modified

- `app/api/auth/login/route.ts` — added one named import (`resolveByEmail`, `getAllPrimeUsers` from `@/lib/prime-users`) and a single conditional block after the existing 'login' audit. Net diff is +22 lines, purely additive — no existing line was modified.
- `.planning/phases/02-session-auth-context/deferred-items.md` — documents 2 pre-existing out-of-scope issues found during verification (build's missing OPENAI_API_KEY env var; Wave-0 test scaffolds use `vi.spyOn(globalThis, 'fetch' as never)` which trips tsc but not vitest).
- `.planning/phases/02-session-auth-context/02-03-SUMMARY.md` — this file.

## Decisions Made

- **Resolved-PrimeUser is intentionally discarded after the miss check.** The login route binds `const primeUser = await resolveByEmail(...)` only to drive the `if (!primeUser)` branch — it is NOT stored in the session cookie (D-03), NOT returned in the response (D-04), and NOT cached for the session route to read (D-01 says session route does its own live read). This deliberate "use once and drop" pattern keeps the login route's responsibility scoped tightly to the audit-emit purpose.
- **Cache-state discrimination via `getAllPrimeUsers().length === 0` is the cheapest available signal.** Adding a richer cache-state probe (e.g., reading `lastSuccessAt` from the blob) would require either (a) exposing internal blob shape from `lib/prime-users.ts` or (b) parsing the blob a second time in the login route. The length-zero check is a single property read against an already-resolved array and matches the plan's PATTERNS specification verbatim.
- **No new TDD `test(...)` commit was created.** Wave 0 pre-scaffolded the 8 RED tests, so the implementation commit is the GREEN flip — the RED gate already exists in git history at the Wave 0 commit.

## Deviations from Plan

None — plan executed exactly as written. The only minor latitudes taken:

- (a) Created `deferred-items.md` to capture two pre-existing out-of-scope issues surfaced during the `npm run build` and `npx tsc --noEmit` verification steps (see "Issues Encountered" below). Both are explicitly tagged as Phase-1 / Wave-0 inheritances, not 02-03 work.
- (b) Skipped the separate `test(...)` commit prescribed in the generic TDD execution flow because Wave 0 already shipped the RED scaffold. The plan's Task 1 explicitly anticipates this — the task is `tdd="true"` in the metadata sense (TDD discipline) but its RED phase was done by Wave 0.

## Issues Encountered

Two pre-existing issues surfaced during verification — both pre-date this plan and are scoped out per Rule 3 SCOPE BOUNDARY:

1. **`npm run build` fails on `/api/report-assist/caption/route.ts` due to missing `OPENAI_API_KEY` env var.** Pre-existing environment-config concern. Verified via `npx tsc --noEmit` that the modified file (`app/api/auth/login/route.ts`) has zero TypeScript errors. Logged in `deferred-items.md`.
2. **`npx tsc --noEmit` reports `TS2339: Property 'mockResolvedValueOnce' does not exist on type 'never'`** for 8 call sites across `app/api/auth/login/route.test.ts` and `lib/audit.test.ts`. All are the Wave-0 pattern `vi.spyOn(globalThis, 'fetch' as never)`. Tests still execute and PASS at runtime — vitest does not run tsc. Logged in `deferred-items.md`.

## User Setup Required

None — no external service configuration required. The change is a server-side wiring of two existing module exports against an existing audit-log writer; no env vars added, no new blobs created, no new endpoints exposed.

## Next Phase Readiness

- **02-02 (session route — sibling Wave-1 worktree):** independent of this work; no merge conflict expected (different file).
- **02-04 (TopBar identity surface):** transitively depends on 02-02 (session-route delivery), not on this plan. This plan's contribution is the audit trail, not the user-visible identity.
- **Phase 3 admin UI (DISPLAY-03):** the `'prime_user_miss'` rows this plan emits will surface in the admin audit-log UI. Phase 3's `ActionBadge` component (`app/admin/page.tsx:508-513`) needs a third branch for the new action type — flagged in PATTERNS § Pitfall 3 as "planner discretion in 02 OR defer to 03". This plan deliberately did NOT touch `app/admin/page.tsx` (out of plan scope; defer per Pitfall 3 option 2).

## Self-Check

Verifying claims before returning:

- File `app/api/auth/login/route.ts` exists at expected path: `[ -f app/api/auth/login/route.ts ]` → FOUND
- Commit `6884506` exists in git log: `git log --oneline | grep 6884506` → FOUND (`6884506 feat(02-03): wire resolveByEmail + cache-state miss audit into login route`)
- 8/8 tests GREEN: re-run `npx vitest run app/api/auth/login/route.test.ts` → confirmed (Test Files 1 passed, Tests 8 passed)
- All grep acceptance checks pass:
  - `grep -c "import { resolveByEmail, getAllPrimeUsers } from '@/lib/prime-users'"` → 1
  - `grep -c "action: 'prime_user_miss'"` → 1
  - `grep -c "'cache_empty'"` → 1
  - `grep -c "'cache_hit: no match'"` → 1
  - `grep -c "D-04"` → 1
  - Response body line `return NextResponse.json({ success: true, userName });` → 1 occurrence (no `primeUser:` key)
- Line ordering invariant: OAuth-failure return at line 68 + 75 < session.save() at line 89 < `action: 'login'` at line 95 < `const primeUser = await resolveByEmail` at line 102 < `action: 'prime_user_miss'` at line 114 < success response at line 119

## Self-Check: PASSED

---
*Phase: 02-session-auth-context*
*Completed: 2026-04-24*
