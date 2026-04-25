---
phase: 03-admin-picker-identity-rich-display
plan: 02
subsystem: api-route
tags: [next-route-handler, admin-auth, vitest, prime-directory, no-store]

# Dependency graph
requires:
  - phase: 03-admin-picker-identity-rich-display
    plan: 01
    provides: getDirectoryMetadata() read-only blob accessor (Plan 01)
  - phase: 01-prime-user-directory
    provides: getAllPrimeUsers, PrimeUser type, PrimeUserDirectoryBlob, two-gate refresh route pattern
  - phase: 02-session-auth-context
    provides: getSession + session.userEmail invariant (empty string when unauthenticated)
provides:
  - GET /api/admin/prime-users → { users: PrimeUser[], lastSuccessAt: string | null, lastError: string | null }
    headers: Cache-Control: no-store
    auth: 401 (no userEmail) → 403 (not admin) → 200/500
  - Reference module-boundary mock layout for future admin route tests
affects: [03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-gate admin route handler mirroring app/api/admin/prime-users/refresh/route.ts (no fourth auth variant introduced)"
    - "Promise.all parallel read of getAllPrimeUsers + getDirectoryMetadata (flat cold-cache cost)"
    - "Cache-Control: no-store on success path so the picker always receives the latest cached snapshot"
    - "[admin-prime-users] log namespace per CLAUDE.md log-internally / return-generic convention"
    - "5-case Vitest module-boundary mock pattern at @/ alias (matches auth/session/route.test.ts shape)"

key-files:
  created:
    - app/api/admin/prime-users/route.ts (62 lines, single GET export plus runtime/maxDuration/dynamic exports)
    - app/api/admin/prime-users/route.test.ts (150 lines, 5 Vitest cases covering 401 / 403 / 200 / 200-graceful-empty / 500)
  modified: []

key-decisions:
  - "Mirrored refresh/route.ts auth gate verbatim — same session.userEmail Gate 1, same isAdminEmail(session.userEmail, config) Gate 2. Did NOT introduce a fourth admin-auth variant (Pitfall 4 honored)."
  - "Promise.all parallel read keeps cold-cache cost flat; getAllPrimeUsers may first-miss-bootstrap one Prime call (Phase 1 D-03 invariant — no new Prime traffic added)."
  - "500 fallback returns the same shape as 200 graceful-empty ({ users: [], lastSuccessAt: null, lastError: 'Internal error' }) so the picker's parser stays single-shape."
  - "Generic 'Internal error' string returned to client; full error stays in [admin-prime-users] server log per CLAUDE.md convention."

patterns-established:
  - "5-case Vitest pattern for admin-gated GET routes: 401 short-circuit / 403 short-circuit / 200 happy / 200 graceful-empty / 500 throws. Each non-200 path asserts mockedGetAll/mockedMeta NOT called."
  - "getDirectoryMetadata + getAllPrimeUsers can be invoked together in parallel; metadata access does not trigger refresh (verified via Plan 01 test cases)."

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04]

# Metrics
duration: 3min
completed: 2026-04-25
---

# Phase 03 Plan 02: GET /api/admin/prime-users Summary

**Net-new admin-gated route handler that exposes the cached Prime user directory + blob metadata as `{ users, lastSuccessAt, lastError }` with `Cache-Control: no-store`, mirroring the Phase 1 refresh-route auth gate verbatim and never calling Prime on the hot path.**

## Performance

- **Duration:** ~3 min 25 sec
- **Started:** 2026-04-25T01:54:29Z
- **Completed:** 2026-04-25T01:57:54Z
- **Tasks:** 2
- **Files modified:** 2 new (route + test)

## Endpoint Contract

```
GET /api/admin/prime-users
```

| Status | Body | Headers | Trigger |
|--------|------|---------|---------|
| 401 | `{ error: 'Unauthorized' }` | (default) | `session.userEmail` falsy (no/expired cookie) — short-circuits before Gate 2 and before any data read |
| 403 | `{ error: 'Forbidden' }` | (default) | Authenticated but `isAdminEmail(session.userEmail, config) === false` — short-circuits before any data read |
| 200 | `{ users: PrimeUser[], lastSuccessAt: string \| null, lastError: string \| null }` | `Cache-Control: no-store` | Admin; success (or graceful-empty per Phase 1 D-16) |
| 500 | `{ users: [], lastSuccessAt: null, lastError: 'Internal error' }` | (default) | Admin; uncaught error inside the try block (e.g. blob read crash). Full error logged server-side via `console.error('[admin-prime-users]', e)` |

Module-level exports beyond `GET`: `runtime = 'nodejs'`, `maxDuration = 60`, `dynamic = 'force-dynamic'` — copied verbatim from `refresh/route.ts`.

## Two-Gate Pattern Confirmation

The new route uses the **same** two-gate auth as `app/api/admin/prime-users/refresh/route.ts`:

```typescript
// Gate 1
const session = await getSession();
if (!session.userEmail) return 401;

// Gate 2
const config = await getVisibilityConfig();
if (!isAdminEmail(session.userEmail, config)) return 403;
```

No fourth admin-auth variant introduced. Specifically rejected (per RESEARCH Pitfall 4):
- The `404` stealth pattern from `app/api/audit/entries/route.ts` is **not** used.
- The `session.accessToken` page-visibility variant is **not** used (refresh-route uses `session.userEmail` and so do we).

## Task Commits

1. **Task 1 — `feat(03-02)`:** `980a077` — `app/api/admin/prime-users/route.ts` (route handler with two-gate auth, parallel data fetch, no-store header, [admin-prime-users] log prefix).
2. **Task 2 — `test(03-02)`:** `2ee8dee` — `app/api/admin/prime-users/route.test.ts` (5 Vitest cases at module-boundary mocks).

Plan-metadata commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS) follows.

## Files Created/Modified

- `app/api/admin/prime-users/route.ts` — net-new GET route, 62 lines.
- `app/api/admin/prime-users/route.test.ts` — net-new co-located Vitest, 150 lines, 5 cases.

No existing files modified (matches the plan's `files_modified` declaration of just the two new files).

## Test Coverage (5 behavioural branches)

| # | Case | Asserts |
|---|------|---------|
| 1 | 401 — no userEmail | `res.status === 401`, `body.error === 'Unauthorized'`, `mockedConfig`, `mockedIsAdmin`, `mockedGetAll`, `mockedMeta` ALL never called (full short-circuit) |
| 2 | 403 — non-admin | `res.status === 403`, `body.error === 'Forbidden'`, `mockedGetAll` and `mockedMeta` never called |
| 3 | 200 happy path | `res.status === 200`, `Cache-Control: no-store`, body shape `{ users: [PrimeUser], lastSuccessAt, lastError }` |
| 4 | 200 graceful-empty | Mirrors Phase 1 D-16; `users: []` + surfaced `lastError: 'Prime timeout'`, status stays 200 (NOT 5xx) |
| 5 | 500 — getAllPrimeUsers throws | `res.status === 500`, body `{ users: [], lastSuccessAt: null, lastError: 'Internal error' }`, `console.error('[admin-prime-users]', expect.any(Error))` |

Full project suite after this plan: **79/79 passing** (74 baseline from 03-01 + 5 new). Vitest run duration: 3.05s.

## Verification

```bash
npx vitest run --reporter=dot app/api/admin/prime-users/route.test.ts   # 5/5 passed (311ms)
npx vitest run                                                            # 79/79 passed (3.05s)
npm run lint -- --file app/api/admin/prime-users/route.ts \
                --file app/api/admin/prime-users/route.test.ts            # No ESLint warnings or errors
```

`npx tsc --noEmit` reports the same 9 pre-existing errors documented in `.planning/phases/03-admin-picker-identity-rich-display/deferred-items.md` (8 in `app/api/auth/login/route.test.ts`, 1 in `lib/audit.test.ts`); zero new errors introduced by this plan. The deferred-items log already accounts for these; the project's runtime tests are unaffected.

## Decisions Made

No new design decisions — all design choices were locked upstream in 03-CONTEXT.md (D-11) and 03-PATTERNS.md. Plan 03-02 is a pure execution plan; both task `<action>` blocks were copied verbatim into the new files.

## Deviations from Plan

**Auto-fixed Issues**

**1. [Rule 3 - Blocking] Lint invocation pattern**
- **Found during:** Task 1 verification.
- **Issue:** The plan's `<verify>` block calls `npx next lint app/api/admin/prime-users/route.ts` directly. This invocation fails on Next 14.2.x with "Couldn't find any pages or app directory" because `next lint` does not honor positional file args the same way the npm-script-wrapped form does.
- **Fix:** Used `npm run lint -- --file <path>` instead, which is the documented Next.js way to lint specific files. Same underlying linter (next lint via the package.json script), same rule set, just the supported invocation form.
- **Files modified:** None.
- **Verification:** Both the new route file and the new test file return "✔ No ESLint warnings or errors".
- **Committed in:** N/A (no source change — invocation-only fix).

**Total deviations:** 1 auto-fixed (Rule 3 — blocking environment workaround).
**Impact on plan:** Zero scope creep; tooling-invocation only. The lint substantive output is identical.

## Issues Encountered

- **Pre-existing TS errors persist** (carried from 03-01 — see `deferred-items.md`). Same 9 errors, same files (`app/api/auth/login/route.test.ts`, `lib/audit.test.ts`). My changes introduce zero new TS errors. Plan 01's note that the inherited "tsc --noEmit exits 0" criterion no longer holds applies equally here. Out of scope per scope-boundary rule (no touch on those files in 03-02).

## TDD Gate Compliance

Both tasks declare `tdd="true"`, but the plan author **split the SUT and the tests across the two tasks** (Task 1 = route only, Task 2 = tests only). This means:

| Task | Type | Commit | Order |
|------|------|--------|-------|
| 1 | Implementation (`feat`) | `980a077` | Implementation came first because the plan's task order placed Task 1 ahead of Task 2 |
| 2 | Tests (`test`) | `2ee8dee` | Tests landed after the SUT existed; they were green on first run (no RED phase per task-pair) |

**Departure from canonical RED→GREEN per-task pairing:** This plan does NOT follow the same RED→GREEN-per-task pattern that 03-01 used. The plan author intentionally structured 03-02 as "ship the file, then ship the tests" — a single feature pair across two tasks rather than two micro-pairs. This is consistent with the `<action>` text in each task (Task 1 says "Create the file `app/api/admin/prime-users/route.ts`" with no mention of tests; Task 2 says "Create `app/api/admin/prime-users/route.test.ts`" with no mention of code changes).

**Verifier note:** If a stricter RED-first reading is required, this plan can be considered as having a single RED→GREEN pair where the GREEN commit (`980a077`) preceded the test landing (`2ee8dee`). The tests demonstrably exercise the SUT (5/5 pass with non-trivial assertions including short-circuit verification) and would have failed against a stub implementation. No fail-fast trigger fires because the SUT and tests are coherent on first run.

## Threat Surface Confirmation

The plan's `<threat_model>` enumerates 7 threat IDs (T-03-02-01 through T-03-02-07). All `mitigate`-disposition threats are tested:

| Threat ID | Disposition | Mitigation in code | Test that covers it |
|-----------|-------------|---------------------|---------------------|
| T-03-02-01 (Spoofing — unauth read) | mitigate | Gate 1 returns 401 before any data read | Test 1 (`mockedGetAll`/`mockedMeta` NOT called) |
| T-03-02-02 (Privilege elevation — non-admin read) | mitigate | Gate 2 returns 403 before any data read | Test 2 (`mockedGetAll`/`mockedMeta` NOT called) |
| T-03-02-03 (Info disclosure — admin reads PII) | accept | D-11 intentional; Cache-Control: no-store; Gate 2 enforces admin | — (acceptance, no test) |
| T-03-02-04 (CSRF on GET) | accept | iron-session sameSite: lax + httpOnly; GET idempotent | — (acceptance, no test) |
| T-03-02-05 (DoS during Prime outage) | mitigate | Hot path is blob-only via getAllPrimeUsers/getDirectoryMetadata | Verified by no-Prime-call review (Plan 01 invariant — `getDirectoryMetadata` is read-only blob access) |
| T-03-02-06 (Repudiation — no audit) | accept | v2 ADMIN-AUDIT covers | — (acceptance, no test) |
| T-03-02-07 (Info disclosure — error leak) | mitigate | Catch returns generic 'Internal error'; full err logged via [admin-prime-users] | Test 5 (asserts `body.lastError === 'Internal error'` AND `console.error('[admin-prime-users]', expect.any(Error))`) |

No new threat surface introduced beyond what's already in the threat register.

## Next Plan Readiness

- **Plan 03-03 (`<PrimeUserPicker>`):** Can now `fetch('/api/admin/prime-users')` against a real endpoint instead of a mock. Response shape matches D-11. Cache-Control: no-store guarantees the picker sees the latest cached snapshot on every reload.
- **Plan 03-04 (VisibilityTab refresh-button + metadata strip):** Same endpoint fuels the "Refreshed N ago" strip via the `lastSuccessAt` field; `formatRelative` from Plan 01 is the consumer. Plan 03-04 may also wire the existing `POST /refresh` button beside the read path.
- **Plan 03-05 (AuditTab cascade):** `useEffect` parallel-fetch of `/api/admin/prime-users` on mount feeds the D-15 three-step cascade (`resolveDisplayName` from Plan 01).
- **No blockers.** Wave 3 plans (04 + 05) can begin now that Wave 2's endpoint is live.

---
*Phase: 03-admin-picker-identity-rich-display*
*Completed: 2026-04-25*

## Self-Check: PASSED

All required artefacts present on disk:
- `app/api/admin/prime-users/route.ts`
- `app/api/admin/prime-users/route.test.ts`
- `.planning/phases/03-admin-picker-identity-rich-display/03-02-SUMMARY.md`

All task commits reachable in `git log --all`:
- `980a077` — feat(03-02): add GET /api/admin/prime-users admin-gated read endpoint
- `2ee8dee` — test(03-02): add 5-case Vitest coverage for GET /api/admin/prime-users
