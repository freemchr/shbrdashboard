---
phase: 01-prime-user-directory
verified: 2026-04-24T12:43:00Z
status: human_needed
score: 11/11 must-haves verified (code-level)
must_haves_total: 11
must_haves_verified: 11
overrides_applied: 0
gaps: []
deferred: []
human_verification:
  - test: "Task 2.2 — 4-case manual smoke against live dev server"
    expected: "Case A unauth=HTTP 401 `{error:'Unauthorized'}`; Case B non-admin=HTTP 403 `{error:'Forbidden'}`; Case C admin=HTTP 200 `{ok:true, userCount>0, durationMs, cachedAt}` idempotent on re-run; Case D outage (PRIME_PASSWORD broken)=HTTP 502 `{ok:false, error, lastSuccessAt}` with lastSuccessAt matching Case C + dev server log `[prime-users] refresh failed:`"
    why_human: "Requires live Prime OAuth credentials (.env.local), a running dev server, a logged-in browser (two sessions — admin and non-admin) to copy shbr_session cookies from DevTools, and temporarily breaking PRIME_PASSWORD in .env.local for Case D. User explicitly deferred this checkpoint via 8 automated pre-checkpoint gates (all passed). DIR-03 and DIR-04 are CODE-COMPLETE and tsc/test-clean but have NOT been exercised end-to-end. Do NOT mark DIR-03/DIR-04 as field-proven without the live smoke result."
  - test: "Observation of Prime /users call volume under normal dashboard traffic (ROADMAP SC #4)"
    expected: "After Phase 1 ships and users navigate the dashboard normally, Prime's /users endpoint counter does not increment per page load — only on first-miss bootstrap, the 30-day safety net, and explicit admin refresh. Budget footprint stays well under 5,000/day."
    why_human: "Requires production telemetry / Prime rate-limit header observation across a real session. No automated harness in this milestone (D-21). Unit tests assert the hot-path NEVER calls primeGetAllPages on a fresh cache (tests 11, 19), but only live traffic observation proves the budget claim. Note: this SC is NOT exercised until Phase 2 (login integration) wires `resolveByEmail` into a hot path — Phase 1 alone only creates the module."
---

# Phase 01: Prime User Directory — Verification Report

**Phase Goal:** "A cached, authoritative Prime user directory is available server-side for every downstream consumer, without putting the 5,000/day Prime budget at risk."
**Verified:** 2026-04-24T12:43:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement — Two-Part Assessment

The phase goal splits cleanly into two testable claims:

1. **"A cached, authoritative Prime user directory is available server-side for every downstream consumer"** — PASSES at the code level. `lib/prime-users.ts` ships with `getAllPrimeUsers()`, `resolveByEmail()`, and `refreshPrimeUsers()` exported; 20/20 unit tests assert the behaviors; `tsc --noEmit` is clean. Phase 2 can import `resolveByEmail` on day one.
2. **"without putting the 5,000/day Prime budget at risk"** — PASSES at the code level via the hot-path tests (tests 11, 18, 19 assert `primeGetAllPages` is never called when the cache is fresh) and the preserve-on-failure semantics (tests 7, 8). The *field* claim requires live traffic observation (SC #4) which is deferred to post-milestone monitoring and flagged under `human_verification`.

**Code-level verdict: Goal achieved.** Field-level verdict: pending Task 2.2 smoke and Phase 2 integration telemetry.

---

## Observable Truths (merged from ROADMAP SCs + PLAN must_haves)

### Roadmap Success Criteria (Phase 1, from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Server-side lookup can resolve an email to a Prime user record without live Prime call on the hot path | VERIFIED (code) | `lib/prime-users.ts:217-222` `resolveByEmail` → `getAllPrimeUsers` → returns cached blob.users when fresh; test 11 asserts `expect(mockedPrimeGetAllPages).not.toHaveBeenCalled()` on fresh cache; test 19 re-asserts via `resolveByEmail` call path. |
| SC-2 | Logged-in admin can trigger explicit cache refresh from an authenticated endpoint and observe updated directory data | VERIFIED (code) / FIELD-DEFERRED | Route at `app/api/admin/prime-users/refresh/route.ts:28-67` implements POST with two-gate auth + delegation to `refreshPrimeUsers({reason:'admin'})`. Returns D-13 success body `{ok:true, userCount, durationMs, cachedAt}`. Code-complete but Task 2.2 live smoke deferred → see human_verification. |
| SC-3 | When Prime is unreachable/rate-limited/auth-error, most recent cached directory continues serving lookups; no request crashes; failure is logged | VERIFIED (unit) | Tests 7, 13, 15 assert: preserve-on-failure with existing blob (users preserved, error metadata written); first-miss + Prime fail returns `[]` without throw (D-16); stale-cache + Prime fail returns stale users (D-17). Test 9 asserts `[prime-users] refresh failed:` log line. |
| SC-4 | Observed Prime `/users` call volume from normal dashboard traffic stays well under 5,000/day budget | NEEDS_HUMAN | No live-traffic observation possible from code verification. Unit tests assert the necessary condition (hot-path makes zero Prime calls) but cannot prove the sufficient condition (normal dashboard traffic doesn't invoke the module in a pathological way). Phase 2 is the first integration; telemetry becomes meaningful then. Flagged for operator observation post-milestone. |

### PLAN must_haves (merged across Plans 01, 02, 03)

| # | Truth (from PLAN frontmatter) | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm test` exits 0 with ≥12 cases | VERIFIED | Live run: `Test Files 1 passed (1) / Tests 20 passed (20) / Duration 3.90s`. Floor of 12 exceeded by 67%. |
| 2 | Server-side import of `getAllPrimeUsers` returns cached users without Prime call on fresh cache | VERIFIED | Test 11 (`mockedPrimeGetAllPages.not.toHaveBeenCalled()` on fresh cache). `lib/prime-users.ts:193-210` encodes the three-branch decision tree (first-miss / 30-day / fresh return). |
| 3 | `resolveByEmail('Some.Mixed@Case.com')` matches lowercase-stored email and returns PrimeUser | VERIFIED | Test 17 asserts `'  JANE@SHBR.COM  '` resolves to the user stored as `'jane@shbr.com'`. Normalization at `lib/prime-users.ts:218` (COMPARE) and `:105` (STORE). |
| 4 | First-miss (empty cache) triggers ONE refresh and serves the result | VERIFIED | Test 12 asserts `primeGetAllPages` called exactly once (`toHaveBeenCalledTimes(1)`); `lib/prime-users.ts:197-200`. |
| 5 | 30-day stale cache triggers ONE refresh; if Prime fails, previous users still returned | VERIFIED | Test 14 (success path, fresh user returned) + test 15 (failure path, stale users preserved). `lib/prime-users.ts:203-207`. |
| 6 | Refresh failure with previous blob: users preserved verbatim; lastError/lastErrorAt updated | VERIFIED | Test 7 asserts `persisted.users.length === 3` (preserved), `persisted.lastError === 'Prime down'`, `persisted.lastSuccessAt === existingSuccessAt`. `lib/prime-users.ts:156-169`. |
| 7 | First-miss + Prime failure: `setCached` NEVER called (no empty-users blob persisted) | VERIFIED | Test 8 asserts `expect(mockedSetCached).not.toHaveBeenCalled()`. Guard at `lib/prime-users.ts:167-169` (`if (existing)`). Closes RESEARCH Pitfall 1. |
| 8 | All console errors use `[prime-users]` prefix (D-18) | VERIFIED | Test 9 asserts `expect.stringMatching(/^\[prime-users\] refresh failed:/)`. Log call at `lib/prime-users.ts:155`. |
| 9 | All required test cases (≥12 from RESEARCH Test Map) implemented and passing | VERIFIED | 20/20 implemented + passing; 0 `it.todo` remaining. |
| 10 | POST /api/admin/prime-users/refresh: 401 unauth / 403 non-admin / 200 admin / 502 outage | VERIFIED (code) / FIELD-DEFERRED | All four branches present in `app/api/admin/prime-users/refresh/route.ts`. Live smoke deferred → human_verification. |
| 11 | No CRON_SECRET / x-refresh-secret check (D-12); no vercel.json cron entry (D-01) | VERIFIED | `grep CRON_SECRET\|x-refresh-secret\|Bearer\|appendAuditLog` on route.ts + prime-users.ts → 0 hits. `grep prime-users vercel.json` → 0 hits (file does not reference this endpoint). |

**Score:** 11/11 PLAN must_haves verified at the code level; 3/4 ROADMAP SCs verified at the code level (SC-4 requires live telemetry).

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | `test`/`test:run` scripts + `vitest@^4.1.5` + `vite-tsconfig-paths@^6.1.1` devDeps | VERIFIED | Scripts present (lines 10-11); devDeps present (lines 39-40). |
| `vitest.config.ts` | Node env, lib/**/*.test.ts include, tsconfigPaths plugin, globals:false, clearMocks:true | VERIFIED | 13-line config matches verbatim spec. Runs cleanly (3.9s). |
| `lib/prime-users.test.ts` | ≥12 implemented `it()` cases covering DIR-01/02/04; PROBE FINDINGS block preserved; module-boundary mocks for `./prime-auth` + `./blob-cache` | VERIFIED | 20 `it()` cases, 0 `.todo`, PROBE FINDINGS block intact at lines 1-24 with actual 11-key Prime attribute union, mocks at lines 39-47. |
| `lib/prime-users.ts` | ≥120 lines; 6 named exports; composes primeGetAllPages + getCached/setCached; preserve-on-failure refresh; no `...raw.attributes` spread; no audit import | VERIFIED | 222 lines; exports PrimeUser, PrimeUserDirectoryBlob, mapRawToPrimeUser, refreshPrimeUsers, getAllPrimeUsers, resolveByEmail (6 named); `grep audit` → 0 hits; `grep \.\.\.raw.attributes` → 0 hits (only banned-pattern comment). |
| `app/api/admin/prime-users/refresh/route.ts` | POST handler with 401/403/502/200 branches; `isAdminEmail()` + `getSession()` + `refreshPrimeUsers()` imports; runtime='nodejs' | VERIFIED | 67 lines; all four status codes present; all three required imports present at lines 20-22; `runtime = 'nodejs'` at line 24. Only POST exported (no GET/PUT/DELETE/PATCH). |
| `app/api/admin/` namespace directory | Exists (new admin-scoped namespace per D-11) | VERIFIED | Directory exists; contains `prime-users/refresh/route.ts`. Sibling-ready for Phase 3's picker admin endpoint. |
| `.planning/phases/01-prime-user-directory/01-VALIDATION.md` | 11 rows total in Per-Task Map (5+3+3); nyquist_compliant: true | VERIFIED | 11 rows present; frontmatter `nyquist_compliant: true` and `wave_0_complete: true`; row 2.2 correctly marked `⚠️ deferred (user-approved via 8 automated gates)`. |

---

## Key Link Verification (Level 3: Wiring)

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lib/prime-users.ts` | `lib/prime-auth.ts:primeGetAllPages` | named import at line 25 | WIRED | `import { primeGetAllPages } from '@/lib/prime-auth'`; called once at line 142 with `('/users', 100)`. Grep confirms source export exists (`lib/prime-auth.ts`). |
| `lib/prime-users.ts` | `lib/blob-cache.ts:getCached+setCached` | named import at line 26 | WIRED | `import { getCached, setCached } from '@/lib/blob-cache'`; `getCached` called at line 139 + 194; `setCached` called at lines 152 + 168. |
| `lib/prime-users.test.ts` | `lib/prime-users.ts` | relative import at line 29-36 | WIRED | `import { resolveByEmail, getAllPrimeUsers, refreshPrimeUsers, mapRawToPrimeUser, type PrimeUser, type PrimeUserDirectoryBlob } from './prime-users'` — all 6 required symbols imported. |
| `app/api/admin/prime-users/refresh/route.ts` | `lib/session.ts:getSession` | named import at line 20 | WIRED | Confirmed: `export async function getSession()` at `lib/session.ts:24`. Called at route.ts:30. |
| `app/api/admin/prime-users/refresh/route.ts` | `lib/page-visibility.ts:isAdminEmail+getVisibilityConfig` | named import at line 21 | WIRED | Confirmed: `getVisibilityConfig` at `lib/page-visibility.ts:90`; `isAdminEmail` at `lib/page-visibility.ts:121`. Called at route.ts:37-38. |
| `app/api/admin/prime-users/refresh/route.ts` | `lib/prime-users.ts:refreshPrimeUsers` | named import at line 22 | WIRED | `import { refreshPrimeUsers } from '@/lib/prime-users'`; called at route.ts:43 with `{ reason: 'admin' }`. This is currently the ONLY production consumer of `refreshPrimeUsers`/`getAllPrimeUsers`/`resolveByEmail` — expected at end of Phase 1; Phase 2 will add `resolveByEmail` consumers. |

---

## Data-Flow Trace (Level 4)

Phase 1 ships a server module and an API endpoint, not a rendering surface. There are no dynamic-data components to trace through JSX — Level 4 applies narrowly here.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `lib/prime-users.ts:refreshPrimeUsers` | `raw: RawPrimeUser[]` | `primeGetAllPages('/users', 100)` (lib/prime-auth.ts — live Prime API) | Yes (Prime OAuth + paginated fetch; probe-confirmed 30 users in SHBR tenant) | FLOWING |
| `lib/prime-users.ts:getAllPrimeUsers` | `blob: PrimeUserDirectoryBlob \| null` | `getCached('shbr-admin/prime-users.json')` (lib/blob-cache.ts — Vercel Blob) | Yes (real blob storage; same keyspace as existing production `shbr-admin/page-visibility.json`) | FLOWING (pending first live refresh) |
| `app/api/admin/prime-users/refresh/route.ts:POST` | `result: {ok, blob, durationMs}` | `refreshPrimeUsers({reason:'admin'})` | Yes (delegates to the same live-Prime path above) | FLOWING (code-wired; first live flow happens during Task 2.2 smoke or normal dev use) |
| Route 200 response body | `result.blob.users.length`, `result.blob.lastSuccessAt`, `result.durationMs` | live `refreshPrimeUsers` call | Yes | FLOWING |
| Route 502 response body | `result.blob.lastError`, `result.blob.lastSuccessAt` | `refreshPrimeUsers` error-path blob (preserve-on-failure) | Yes | FLOWING |

No hollow-prop or disconnected-source patterns detected. The blob has not yet been populated in production (no Prime `/users` call has been made from this module in prod), so a very first admin refresh will be a first-miss bootstrap — this is the expected, tested path (test 12).

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite passes | `npm test` | `Test Files 1 passed (1) / Tests 20 passed (20) / 3.90s` | PASS |
| Module exports expected functions | `node -e "const m = require('./lib/prime-users'); ..."` (skipped — TS module, requires runtime transpile) | N/A | SKIP (TS module; 20-case unit suite verifies exports via import) |
| TypeScript clean | `npx tsc --noEmit` | Exits 0; no output | PASS |
| Admin endpoint returns non-empty | `curl -X POST http://localhost:3000/api/admin/prime-users/refresh` | Requires running dev server + session cookie | SKIP — routed to human_verification |
| Admin endpoint only exports POST | `grep -E "export async function (GET\|PUT\|DELETE\|PATCH)" route.ts` | 0 matches | PASS |
| No forbidden imports | `grep -E "CRON_SECRET\|x-refresh-secret\|Bearer \|appendAuditLog\|from '@/lib/audit'"` on both files | 0 matches | PASS |
| No hardcoded vercel.json cron | `grep prime-users vercel.json` | 0 matches (file does not reference this endpoint) | PASS |

---

## Requirements Coverage (DIR-01..04)

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| **DIR-01** | 01-01, 01-02 | Server-side fetcher retrieves Prime users list from `/users` via existing Prime auth client, paginated across all pages | SATISFIED | `lib/prime-users.ts:142` calls `primeGetAllPages('/users', 100)` (the paginated primitive at `lib/prime-auth.ts:107-135`). `mapRawToPrimeUser` produces the 9-field PrimeUser (D-08) for each record. Test 6 (success path) + tests 1-5 (mapper coverage) verify the fetch+map pipeline. Probe (Wave 0) confirmed live Prime shape. |
| **DIR-02** | 01-01, 01-02 | Prime user directory cached server-side with explicit TTL keeping daily Prime calls well under 5,000/day budget | SATISFIED (unit) / NEEDS_HUMAN (observation) | Cache implemented via `getCached`/`setCached` on `shbr-admin/prime-users.json` with `INDEFINITE_TTL_MS = 50y` (D-01 — refresh is on-demand only, not TTL-driven). 30-day safety net at `lib/prime-users.ts:203-207` provides an upper bound. Hot-path verified by tests 11, 18, 19 (`primeGetAllPages.not.toHaveBeenCalled` on fresh cache). ROADMAP SC-4 ("call volume stays under budget") needs post-Phase-2 telemetry; flagged in human_verification. |
| **DIR-03** | 01-03 | Admin-only endpoint can force-refresh Prime user cache on demand | SATISFIED (code) / FIELD-DEFERRED | `POST /api/admin/prime-users/refresh` exists with correct two-gate auth (401 unauth / 403 non-admin / 200 admin / 502 outage). All 8 automated pre-checkpoint gates passed. **Task 2.2 manual 4-case smoke DEFERRED by user** — DIR-03 is CODE-COMPLETE but NOT FIELD-PROVEN; see human_verification. |
| **DIR-04** | 01-02, 01-03 | Cache failures do not corrupt cached data or crash dependent requests — stale cache preferred to hard failure | SATISFIED (unit) / FIELD-DEFERRED | Preserve-on-failure semantics in `refreshPrimeUsers` (lib/prime-users.ts:141-174). Test coverage: test 7 (existing blob + Prime fail → users preserved, error metadata written), test 8 (first-miss + Prime fail → NO blob written, Pitfall 1), test 13 (empty cache + Prime fail → returns `[]` without throw), test 15 (stale + Prime fail → returns stale users). DIR-04 Case D (outage 502 with preserved lastSuccessAt) shares the deferred Task 2.2 smoke; integration-layer field evidence pending. |

**Coverage:** 4/4 DIR requirements traced to actual code. No orphaned requirements. 2/4 (DIR-03, DIR-04) have field-evidence deferred to the manual smoke that was user-approved as bypassable via 8 automated gates.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/prime-users.ts` | 142-152 | Successful-but-empty Prime response (`primeGetAllPages → []`) is treated as a valid refresh and cached; 30-day safety net then suppresses re-fetch for 30 days | Warning (WR-01 from code review) | Edge case. Probe confirmed SHBR tenant has ~30 users. If Prime ever returns `[]` (tenant misconfiguration, permission change, Prime bug), the directory silently empties for 30 days. Code review notes this is intentional/tested (test 10 locks it in) but recommends a 0-users guard when existing blob was populated. **Not a blocker — flagged for operator awareness.** |
| `lib/prime-users.ts` | 134-135, 155, 172 | `opts.reason` accepted on signature but `void opts.reason;` — never included in logs | Warning (WR-02 from code review) | Observability gap. An operator seeing `[prime-users] refresh failed:` in logs cannot distinguish admin click vs. first-miss bootstrap vs. 30-day safety net. Not a correctness issue; recommended follow-up: include `reason=${opts.reason}` in the error log. **Not a blocker.** |
| `lib/prime-users.ts` | 55-59 | `RawPrimeUser.type` field declared but never read | Info (INF-01) | Harmless documentation of JSON:API envelope shape. No action required. |
| `lib/prime-users.ts` | 66-70, 105, 106, 218 | Three slightly different string-normalization shapes for "trim-to-non-empty-or-null" | Info (INF-02) | Benign; consolidate if a fourth site appears. No action required. |
| `lib/prime-users.ts` | 115 | `status: str(a.status) ?? 'unknown'` — 'unknown' not in the observed Prime value set (only 'active'/'inactive' seen in probe) | Info (INF-03) | Defensive default. Flag for Phase 3 picker design — consider narrowing the type or surfacing a log when 'unknown' fires. No action required in this phase. |
| `vitest.config.ts` + `lib/prime-users.test.ts` | config:10 + test:56-58 | `clearMocks: true` + per-test `vi.resetAllMocks()` — the latter is strictly stronger, making the former redundant | Info (INF-04) | Benign belt-and-braces. No behavioral impact. No action required. |
| `app/api/admin/prime-users/refresh/route.ts` | 25 | `maxDuration = 60` is conservative for a single-page `/users` fetch (~30 users, <10s worst case) | Info (INF-05) | Intentional conservatism matching `app/api/prime/team/route.ts` precedent. No action required. |

**Summary:** 0 Critical · 2 Warning · 5 Info. All findings documented in `01-REVIEW.md`. Neither warning blocks verification. Both are acknowledged follow-ups.

---

## Human Verification Required

### 1. Task 2.2 — 4-case manual smoke against live dev server (DEFERRED by user, gated by 8 automated pre-checks)

**Test:** Run `npm run dev` locally, then execute four curl cases against `http://localhost:3000/api/admin/prime-users/refresh`:

- **Case A (unauth):** `curl -i -X POST http://localhost:3000/api/admin/prime-users/refresh`
  → **Expected:** HTTP 401 + `{"error":"Unauthorized"}`
- **Case B (non-admin):** Log in as a non-admin in the browser, copy `shbr_session` cookie, then `curl -i -X POST -b "shbr_session=<cookie>" http://localhost:3000/api/admin/prime-users/refresh`
  → **Expected:** HTTP 403 + `{"error":"Forbidden"}`
- **Case C (admin):** Log in as admin, copy cookie, POST; then repeat immediately for idempotency.
  → **Expected:** HTTP 200 + `{"ok":true,"userCount":N,"durationMs":...,"cachedAt":"<ISO>"}` with N > 0; second call returns same shape
- **Case D (outage):** After C succeeds, set `PRIME_PASSWORD=<wrong>` in `.env.local`, restart dev server, repeat admin POST.
  → **Expected:** HTTP 502 + `{"ok":false,"error":"<message>","lastSuccessAt":"<ISO matching Case C>"}`; dev-server log contains `[prime-users] refresh failed:`. Restore `PRIME_PASSWORD` after.

**Why human:** Requires live Prime OAuth credentials in `.env.local` (dev-only), a running Next.js dev server, two browser sessions to obtain session cookies (admin + non-admin), and temporary mutation of `.env.local` for Case D. This checkpoint was user-approved as deferred based on 8 automated gates (401/403/502 branches present, isAdminEmail call, refreshPrimeUsers import, runtime=nodejs, no cron-secret gate, tsc clean, 20/20 tests green, no vercel.json cron entry — all PASSED). DIR-03 and DIR-04 are CODE-COMPLETE and tsc/test-clean but NOT FIELD-PROVEN. Remediation path if a gap surfaces: open a gap-closure phase (e.g. `01.1-dir-03-field-proof`).

**Do NOT mark DIR-03 as field-proven in `/gsd-audit-uat` until this result exists.**

### 2. Prime /users call-volume observation (ROADMAP SC #4)

**Test:** After Phase 2 ships (the first consumer of `resolveByEmail` on the login path), watch Prime rate-limit headers across a typical dashboard session. Normal navigation should not increment the `/users` counter — only login (bootstrap + every 30 days), admin refresh clicks, and the 30-day safety net timer.

**Expected:** Daily `/users` call count stays well under the 5,000/day shared budget — realistically single-digits per day per deployment.

**Why human:** Requires live production telemetry and operator-level observation of Prime rate-limit headers. No automated harness in this milestone (D-21). Unit tests prove the necessary condition (hot-path makes zero Prime calls) but only live traffic can prove the sufficient condition (no pathological consumer pattern emerges). This check is meaningful only AFTER Phase 2 integration lands.

---

## Gaps Summary

**No code-level gaps.** All PLAN must_haves verified (11/11). All DIR-01..04 requirements have code implementations traced to files, functions, and test cases. All key-links (imports + calls) are wired. `tsc --noEmit` is clean. Test suite is 20/20 green. Code review found 0 Critical, 2 Warning, 5 Info — all acknowledged, none blocking.

**Field-level gap (user-accepted):** Task 2.2's 4-case manual smoke (401/403/200/502) was explicitly deferred by the user based on strong automated pre-checkpoint evidence. The route handler is code-complete but has NOT been exercised end-to-end against a live dev server. This is recorded under `human_verification[0]` so `/gsd-audit-uat` and `/gsd-progress` surface it. DIR-03 remains `⚠️ deferred` in VALIDATION.md row 2.2 until field evidence is captured.

**Observation-level item (post-Phase-2):** ROADMAP SC-4 (Prime call volume under 5,000/day budget) is unit-verifiable only as a necessary condition. The sufficient condition requires post-Phase-2 live traffic observation; flagged under `human_verification[1]`.

**Reviewer acknowledgements (non-blocking):**
- **WR-01** (empty Prime response `[]` cached as success): edge-case correctness note; tested intentional behavior. Not a blocker.
- **WR-02** (`opts.reason` unused in logs): observability gap, not a correctness issue. Not a blocker.

Overall: Phase 1 achieves its goal at the code level. Two items require human verification before the phase can be treated as field-proven.

---

_Verified: 2026-04-24T12:43:00Z_
_Verifier: Claude (gsd-verifier)_
