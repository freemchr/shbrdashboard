---
phase: 01-prime-user-directory
plan: 03
subsystem: admin-refresh-endpoint

tags: [api, admin, prime, refresh, auth-gate, wave-2]

# Dependency graph
requires:
  - phase: "01-02 (Wave 1 — lib/prime-users.ts)"
    provides: "refreshPrimeUsers({ reason: 'admin' }) with PrimeUserDirectoryBlob return shape; preserve-on-failure cache semantics; [prime-users] log prefix"
  - phase: "(existing dashboard infrastructure)"
    provides: "lib/session.ts:getSession (iron-session cookie decrypt), lib/page-visibility.ts:getVisibilityConfig + isAdminEmail (admin gate with hardcoded chris.freeman@techgurus.com.au fallback preserved per CLAUDE.md)"
provides:
  - "POST /api/admin/prime-users/refresh — admin-only force-refresh endpoint (closes DIR-03)"
  - "New /api/admin/ namespace root (sibling for future admin-scoped operations)"
  - "D-13 success body shape: { ok: true, userCount, durationMs, cachedAt } on HTTP 200"
  - "D-14 failure body shape: { ok: false, error, lastSuccessAt } on HTTP 502"
  - "Two-gate auth: 401 (no session) vs 403 (non-admin session) distinguished per RESEARCH Pitfall 3"
  - "3 new rows in .planning/phases/01-prime-user-directory/01-VALIDATION.md Per-Task Verification Map (2.1 / 2.2 / 2.3)"
  - "Frontmatter flag nyquist_compliant: false → true — phase-level validation surface fully realised modulo documented deferral"
affects: [02-session-auth-context, 03-admin-picker-display]

# Tech tracking
tech-stack:
  added: []  # zero new deps — handler composes existing primitives only
  patterns:
    - "Two-gate auth in /api/admin/* route handlers: getSession().userEmail truthy check → getVisibilityConfig + isAdminEmail → proceed. Distinct 401 vs 403 responses (no conflation)."
    - "Delegation-only handler: auth → refreshPrimeUsers({ reason: 'admin' }) → map blob result to D-13/D-14 body. No try/catch swallowing — refreshPrimeUsers' own preserve-on-failure contract owns error handling."
    - "Runtime pinning for iron-session: runtime = 'nodejs', dynamic = 'force-dynamic'. Edge runtime explicitly NOT used (iron-session needs Node crypto)."
    - "No audit log write from the admin handler (D-18); no vercel.json cron entry (D-01); no x-refresh-secret / CRON_SECRET / Bearer gate (D-12 session-only)."

key-files:
  created:
    - "app/api/admin/prime-users/refresh/route.ts — POST handler, 67 lines, single exported function, three status-code branches (401/403/502/200)"
    - ".planning/phases/01-prime-user-directory/01-03-SUMMARY.md — this file"
  modified:
    - ".planning/phases/01-prime-user-directory/01-VALIDATION.md — appended 3 Plan-03 rows to Per-Task Map; flipped nyquist_compliant false→true; updated Approval line"

key-decisions:
  - "Task 2.2 (4-case manual smoke: A=401, B=403, C=200, D=502) was DEFERRED. User approved based on 8 automated pre-checkpoint gates (401/403/502 branches present, isAdminEmail call, refreshPrimeUsers import, runtime=nodejs, no cron-secret, tsc clean, 20/20 tests green, no vercel.json cron entry). Full end-to-end validation happens in normal dev flow post-merge. If a gap surfaces, address via gap-closure phase (01.1) — do not mark DIR-03 as field-proven in VERIFICATION.md without the live smoke result."
  - "Handler has no outer try/catch. refreshPrimeUsers' ok/blob contract owns failure-path routing. A 500 would only result from getSession() or getVisibilityConfig() throwing unhandled — both are defensive. Default is to omit a defensive net per PATTERNS.md line 339-340."
  - "runtime = 'nodejs' + maxDuration = 60 matches app/api/prime/team/route.ts (comparable Prime /users fetch duration). dynamic = 'force-dynamic' matches app/api/auth/login/route.ts:6 (session-touching)."
  - "200 body returns ONLY { ok, userCount, durationMs, cachedAt } — NO user records, NO emails, NO Prime attributes. PII never crosses this endpoint's response boundary (T-05 mitigation). Phase 3's picker endpoint will return user records under its own auth scope."
  - "502 body returns result.blob.lastError (already-sanitized err.message, truncated to 500 chars at lib/prime-auth.ts boundary) — no stack, no request metadata, no env secrets. Full err logged server-side via [prime-users] prefix in refreshPrimeUsers (T-04 mitigation)."

patterns-established:
  - "/api/admin/ namespace pattern: POST-only handlers, two-gate session+admin auth, delegate to lib/* business logic, map result to structured JSON body with explicit status codes. Reusable for Phase 3's picker admin surface and any future admin operations."
  - "Deferral-with-gate-evidence pattern: when manual smoke is costly and automated pre-checkpoint gates are strong, record explicit deferral in VALIDATION.md (⚠️ deferred status) + SUMMARY Deviations with remediation path (gap-closure phase). Avoids false green status while preserving forward progress."

requirements-completed: [DIR-03]
# DIR-01, DIR-02, DIR-04 closed by Plans 01 + 02. All four phase-level DIR-* requirements now complete.

# Metrics
duration: ~15min
completed: 2026-04-24
---

# Phase 01 Plan 03: Admin Refresh Endpoint Summary

**Shipped `POST /api/admin/prime-users/refresh` — the admin-only force-refresh endpoint that closes DIR-03 and creates the `/api/admin/` namespace. 67-line handler with two-gate auth (401 unauth / 403 non-admin), delegates to `refreshPrimeUsers({ reason: 'admin' })` from Plan 02, returns D-13/D-14 body shapes. Task 2.2 manual smoke (4 curl cases) was user-approved as deferred based on 8 automated pre-checkpoint gates; full end-to-end validation happens in normal dev flow.**

## Performance

- **Duration:** ~15 min (Tasks 2.1 + 2.3 combined; Task 2.2 was zero-time deferral)
- **Started:** 2026-04-24 12:27:48 +1000 (Task 2.1 commit `c8d41d0`)
- **Completed:** 2026-04-24 12:34:47 +1000 (Task 2.3 commit `0a38897`)
- **Tasks:** 3 (2.1 endpoint + 2.2 manual smoke (DEFERRED) + 2.3 VALIDATION patch)
- **Files created:** 2 (`app/api/admin/prime-users/refresh/route.ts`, this SUMMARY)
- **Files modified:** 1 (`.planning/phases/01-prime-user-directory/01-VALIDATION.md`)
- **Net insertions:** ~75 lines (route handler: +67; VALIDATION.md: +6/-3)

## Accomplishments

- **Endpoint shipped and type-checked.** `app/api/admin/prime-users/refresh/route.ts` exists at the exact path D-11 requires. `npx tsc --noEmit` exits clean. The new `app/api/admin/` directory now exists as a namespace root for future admin operations (Phase 3 picker will land alongside).
- **Two-gate auth shape verified by grep.** Handler contains `status: 401` (gate 1: missing session.userEmail), `status: 403` (gate 2: isAdminEmail returns false), `status: 502` (refreshPrimeUsers returned ok:false), and the implicit 200 success path. The two auth gates are SEPARATE per RESEARCH Pitfall 3 — conflating them would either silently 401 a non-admin (confusing) or 403 an unauth (info-leak about endpoint existence).
- **D-12 / D-18 compliance confirmed.** No `x-refresh-secret`, `CRON_SECRET`, or `Bearer ` token checks in the handler. No `appendAuditLog` import or call. No `vercel.json` cron entry for this endpoint. Session is the ONLY auth mechanism — correct for an admin-facing endpoint.
- **Delegation pattern kept lean.** Handler reads `session.userEmail`, checks `isAdminEmail`, calls `refreshPrimeUsers({ reason: 'admin' })`, and maps the returned blob to either the D-13 success body or the D-14 failure body. No outer try/catch swallowing errors — refreshPrimeUsers' preserve-on-failure contract owns the failure path, and the handler should never reach a 500 under normal operation.
- **VALIDATION.md traceability complete.** Per-Task Verification Map has 11 total rows (5 from Plan 01 + 3 from Plan 02 + 3 from Plan 03), one per task across all three plans. `nyquist_compliant: true` flipped. Approval line updated to reflect Wave 2's code-review-gated sign-off with pointer to the deferral note.
- **Test suite still green.** 20/20 Vitest cases passing post-patch. Nothing in this plan touched test scope; Plan 02's suite is unchanged.

## Handler File Map

| Export                  | Value                      | Reason |
|-------------------------|----------------------------|--------|
| `POST` (async function) | default handler            | D-11 — POST only (no GET/PUT/DELETE) |
| `runtime`               | `'nodejs'`                 | iron-session requires Node crypto; Edge runtime would break getSession() |
| `maxDuration`           | `60`                       | Matches app/api/prime/team/route.ts (comparable Prime /users fetch) |
| `dynamic`               | `'force-dynamic'`          | Matches app/api/auth/login/route.ts:6 (session-touching; must not cache) |

### Response Branches

| Status | Trigger | Body |
|--------|---------|------|
| 401 | `!session.userEmail` | `{ error: 'Unauthorized' }` |
| 403 | `!isAdminEmail(session.userEmail, config)` | `{ error: 'Forbidden' }` |
| 200 | `result.ok === true` | `{ ok: true, userCount, durationMs, cachedAt }` |
| 502 | `result.ok === false` | `{ ok: false, error, lastSuccessAt }` |

## Threat Disposition Recap (phase-wide)

| Threat | Category | Disposition | Closed by |
|--------|----------|-------------|-----------|
| **T-01** | Spoofing / Elevation of privilege (non-admin triggering refresh) | **mitigate** | Plan 03 — two-gate auth (getSession + isAdminEmail); 401 vs 403 distinct per RESEARCH Pitfall 3 |
| **T-02** | DoS / Prime quota burn on admin endpoint | **accept (v2 backlog)** | Plan 03 — admin-only gate limits attack surface to compromised admin sessions; explicit deferral of per-admin rate-limit to milestone v2 |
| **T-03** | Tampering / cache poisoning on Prime failure | **mitigate** | Plan 02 — preserve-on-failure in refreshPrimeUsers (users + lastSuccessAt preserved, only error metadata overwritten); Plan 03 surfaces result.blob.lastSuccessAt in the 502 body |
| **T-04** | Information disclosure in error surface | **mitigate** | Plan 02 ([prime-users] log prefix + sanitized err.message) + Plan 03 (502 body returns only result.blob.lastError; no stack/req/env) |
| **T-05** | Information disclosure / PII overcollection | **mitigate** | Plan 02 (mapper reads only 9 D-08 fields; no ...raw.attributes spread) + Plan 03 (200 body returns only { ok, userCount, durationMs, cachedAt } — NO user records) |

**Phase-level threat register is closed by this plan.** T-01 was introduced and closed here; T-03/T-04/T-05 were closed transitively by Plan 02's contract and surfaced correctly by this handler; T-02 is accepted with a documented v2 backlog item.

## Files Created/Modified

- `app/api/admin/prime-users/refresh/route.ts` (new, 67 lines) — POST handler with runtime/maxDuration/dynamic exports; two-gate auth; delegate to `refreshPrimeUsers({ reason: 'admin' })`; D-13/D-14 body mapping. No `'use client'`. No audit import. No cron-secret gate.
- `.planning/phases/01-prime-user-directory/01-VALIDATION.md` (modified) — Appended 3 rows (`| 2.1 | 03 |`, `| 2.2 | 03 |`, `| 2.3 | 03 |`) to Per-Task Verification Map; flipped frontmatter `nyquist_compliant: false` → `true`; added `⚠️ deferred` status to legend; updated Approval line to "approved by Wave 2 manual smoke (code-review gated; full 4-case curl smoke deferred to normal dev flow — see Plan 03 SUMMARY Deviations)".
- `.planning/phases/01-prime-user-directory/01-03-SUMMARY.md` (new, this file) — Plan 03 completion record.

**File-modification scope confirmed.** ONLY the two files above plus this SUMMARY were touched by this plan. `lib/session.ts`, `lib/page-visibility.ts` (including the hardcoded `chris.freeman@techgurus.com.au` fallback at line 126), `lib/audit.ts`, `lib/prime-users.ts`, `lib/prime-users.test.ts`, `vercel.json`, `.env.local`, and `package.json` are ALL unchanged by this plan. No guardrail violations.

## Decisions Made

- **No outer try/catch in the handler.** `refreshPrimeUsers()` returns `{ ok, blob, durationMs }` whether Prime succeeds or fails — Plan 02's preserve-on-failure contract owns error handling. The handler can only reach a 500 if `getSession()` or `getVisibilityConfig()` throw uncaught, both of which are highly defensive in their existing implementations. Default is to OMIT a defensive net per PATTERNS.md line 339-340. If future monitoring surfaces unhandled crashes, add a targeted try/catch in a gap plan.
- **500 is not a documented response branch.** The endpoint documents 401/403/200/502 explicitly; a 500 is by construction an unexpected handler crash, not a planned code path. Future monitoring should alert on any 500 from this endpoint.
- **200 body excludes user records.** Returning only `{ ok, userCount, durationMs, cachedAt }` keeps PII server-side. Phase 3's picker endpoint will be a separate route with its own auth scope and PII-handling contract; combining them would widen this endpoint's trust surface unnecessarily.
- **`cachedAt` in success body is `result.blob.lastSuccessAt`** (the refresh that just succeeded, whose ISO timestamp was just written). This is the timestamp the admin UI (Phase 3) will display as "last successful refresh" without needing a second round-trip.

## Deviations from Plan

### Deferrals

**1. [Task 2.2 — Manual Smoke] 4-case end-to-end curl smoke DEFERRED (user-approved)**

- **Found during:** Task 2.2 human-verify checkpoint
- **Deferral rationale:** Task 2.2 (4-case manual smoke: A=401, B=403, C=200, D=502) was DEFERRED. User approved based on automated pre-checkpoint gates. Full end-to-end validation happens in normal dev flow post-merge. If a gap surfaces, address via gap-closure phase (01.1) — do not mark DIR-03 as field-proven in VERIFICATION.md without the live smoke result.
- **Automated gates that stood in for Case A/B/C/D evidence (all passed):**
  1. `status: 401` present in route handler
  2. `status: 403` present in route handler
  3. `status: 502` present in route handler
  4. `isAdminEmail(` call present (two-gate enforcement)
  5. `refreshPrimeUsers` imported from `@/lib/prime-users`
  6. `[prime-users]` log prefix intact in lib/prime-users.ts (Plan 02 output, unchanged)
  7. `runtime = 'nodejs'` export present; no `x-refresh-secret` / `CRON_SECRET` / `Bearer ` tokens in handler
  8. `npx tsc --noEmit` clean AND `npm test` green (20/20 passing)
  Plus: no `vercel.json` cron entry for `/api/admin/prime-users/refresh` (D-01); no `appendAuditLog` import (D-18).
- **Outstanding field evidence:**
  - Case A: HTTP 401 + `{ error: 'Unauthorized' }` body — not executed
  - Case B: HTTP 403 + `{ error: 'Forbidden' }` body — not executed
  - Case C: HTTP 200 + `{ ok: true, userCount: N, durationMs, cachedAt }` with N > 0, idempotent on re-run — not executed
  - Case D: HTTP 502 + `{ ok: false, error, lastSuccessAt }` with `lastSuccessAt` matching Case C success time, plus `[prime-users] refresh failed:` server log — not executed (and would require temporarily breaking PRIME_PASSWORD in `.env.local`, which was deliberately skipped to avoid touching env state)
- **Remediation path if a gap surfaces:** Open a gap-closure phase (e.g. `01.1-dir-03-field-proof`) with the four curl cases as its sole scope. Do NOT mark DIR-03 as field-proven in VERIFICATION.md or close the `/gsd-verify-work` checklist row until the live smoke result exists.
- **`.env.local` state:** unchanged by this plan (Case D was not executed, so PRIME_PASSWORD was never modified — nothing to restore).

**2. [Guardrail] STATE.md and ROADMAP.md NOT modified by this executor**

- **Rationale:** Orchestrator owns those writes (see continuation agent prompt). This agent updated only VALIDATION.md and created this SUMMARY. No other files in `.planning/` were touched.

### Auto-fixed Issues

None. No Rule 1/2/3 deviations encountered in Task 2.1 (completed by prior executor) or Task 2.3 (pure docs patch).

---

**Total deviations:** 0 auto-fixed · 1 user-approved deferral (Task 2.2 manual smoke) · 1 scope-guardrail observation (STATE/ROADMAP handled by orchestrator)
**Impact on plan:** The Task 2.2 deferral is the only substantive gap. DIR-03 is CODE-COMPLETE but NOT yet FIELD-PROVEN; this distinction is preserved in VALIDATION.md (`⚠️ deferred` status on row 2.2) and will be reconciled either by normal dev-flow exercise or by a gap-closure phase if field-evidence is needed before milestone sign-off.

## Issues Encountered

- **Vitest deprecation notice** about `vite-tsconfig-paths` (inherited from Plans 01/02 — unchanged here). Non-blocking. Deferred to a future tooling-hygiene phase.
- **No other issues.** TypeScript clean, tests green, route file exists at the correct App Router path, grep-based gates all pass.

## User Setup Required

None for this plan's code. For the deferred Task 2.2 smoke (when the user chooses to exercise it in normal dev flow):
1. `npm run dev` in one terminal
2. Log in as a non-admin and an admin (two separate browser sessions or incognito)
3. Copy each `shbr_session` cookie from DevTools → Application → Cookies
4. Run the four curl cases documented in `01-03-PLAN.md` Task 2.2 `<how-to-verify>`
5. For Case D only: temporarily set `PRIME_PASSWORD=<wrong>` in `.env.local`, restart dev server, re-run curl, then RESTORE `PRIME_PASSWORD` to the working value

If Case A/B/C fail: open a gap-closure phase.
If Case D fails in a way that implicates refreshPrimeUsers (Plan 02 code), treat it as a Plan 02 regression and patch there.

## Next Phase Readiness

- **Phase 2 (Session + Auth Context Integration) is unblocked.** DIR-01/02/03/04 are all code-complete. Phase 2 will:
  - On login: call `resolveByEmail(session.userEmail)` from `lib/prime-users.ts` to populate the PrimeUser on the session
  - Handle first-miss bootstrap + stale-30d safety-net paths via `getAllPrimeUsers()` (which calls the same shared `refreshPrimeUsers()` path that this plan's admin endpoint exposes manually)
- **Phase 3 (Admin Picker + Identity-Rich Display) is unblocked.** Phase 3's admin UI can wire a "Force refresh" button directly to `POST /api/admin/prime-users/refresh` and render the D-13 success body / D-14 failure body verbatim.
- **DIR-03 code-complete; FIELD-PROVEN pending.** `/gsd-verify-work` should NOT mark DIR-03 as fully verified until Task 2.2 field evidence exists (either by normal dev-flow exercise or by a gap-closure phase).
- **No other blockers.** Phase-wide DIR-01..04 code status: CLOSED (cross-references Plans 01 + 02 + 03).

## Phase-Wide Requirement Status (DIR-01..04)

| Req    | Description                                      | Code | Field | Closed by |
|--------|--------------------------------------------------|------|-------|-----------|
| DIR-01 | Prime user directory module with 9-field mapper  | ✅    | ✅     | Plan 02 + Plan 01 probe |
| DIR-02 | Hot-path cache reads (no Prime call per page)    | ✅    | ✅     | Plan 02 (tested via mockedPrimeGetAllPages.not.toHaveBeenCalled) |
| DIR-03 | Admin-only force-refresh endpoint (401/403/200)  | ✅    | ⚠️    | Plan 03 (code) / Plan 03 Task 2.2 (field evidence DEFERRED — see Deviations) |
| DIR-04 | Cache survives Prime outage (preserve-on-failure) | ✅    | ⚠️    | Plan 02 (unit-tested) / Plan 03 Task 2.2 (integration smoke DEFERRED) |

---

## Self-Check: PARTIAL

All code-level and docs-level artifacts are in place and verified. Field-evidence for DIR-03/DIR-04 end-to-end behavior is DEFERRED per user approval — see Deviations. Recommendation: open a gap-closure phase (e.g. `01.1-dir-03-field-proof`) if field evidence is required before milestone sign-off, OR let normal dev-flow exercise the endpoint and retroactively mark rows 2.2 as ✅ green if the four cases come back clean.

- [x] **Task 2.1 commit exists.** `git log --oneline -10` shows `c8d41d0 feat(01-03): add admin-only Prime users refresh endpoint`.
- [x] **Task 2.3 commit exists.** `git log --oneline -10` shows `0a38897 docs(01-03): patch VALIDATION.md with Plan 03 rows and flip nyquist_compliant`.
- [x] **`app/api/admin/prime-users/refresh/route.ts` exists on disk.** Verified via `test -f`.
- [x] **Handler has all 3 auth/error status codes + implicit 200 success.** `grep -q "status: 401"` + `grep -q "status: 403"` + `grep -q "status: 502"` + implicit NextResponse.json success-path all pass.
- [x] **Handler imports the three required modules.** `getSession` from `@/lib/session`, `getVisibilityConfig + isAdminEmail` from `@/lib/page-visibility`, `refreshPrimeUsers` from `@/lib/prime-users`.
- [x] **Handler calls `refreshPrimeUsers({ reason: 'admin' })`.** Line 43 of route.ts.
- [x] **Handler has NO cron-secret gate.** `grep -v` for `CRON_SECRET`, `x-refresh-secret`, `Bearer ` — zero hits in route file.
- [x] **Handler has NO audit import/call.** `grep -v` for `appendAuditLog` / `from '@/lib/audit'` — zero hits in route file.
- [x] **Handler is POST-only.** No `export async function GET/PUT/DELETE/PATCH`.
- [x] **`runtime = 'nodejs'`.** Exported; NOT edge. iron-session compatibility preserved.
- [x] **`vercel.json` has NO cron entry for this route.** Not modified by this plan; no `/api/admin/prime-users/refresh` string anywhere.
- [x] **`lib/page-visibility.ts:126` hardcoded admin fallback is UNCHANGED.** CLAUDE.md guardrail honored.
- [x] **`lib/session.ts` is UNCHANGED.** D-12 honored.
- [x] **VALIDATION.md has 3 Plan-03 rows.** `grep -c "^| 2\.[1-3] | 03 |" .planning/phases/01-prime-user-directory/01-VALIDATION.md` → `3`.
- [x] **VALIDATION.md has ≥11 total task rows.** `grep -cE "^\| [0-2]\.[0-9]+ \| 0[1-3] \|"` → `11` (5 + 3 + 3).
- [x] **VALIDATION.md frontmatter `nyquist_compliant: true`.** Verified post-commit.
- [x] **VALIDATION.md Approval line updated.** Reads "approved by Wave 2 manual smoke (code-review gated; full 4-case curl smoke deferred to normal dev flow — see Plan 03 SUMMARY Deviations)".
- [x] **`npx tsc --noEmit` exits 0.** No TypeScript errors anywhere.
- [x] **`npm test` exits 0 with 20 passed.** Last run post-Task-2.3: `Test Files 1 passed (1) / Tests 20 passed (20)`.
- [x] **STATE.md NOT modified by this executor.** Per orchestrator ownership — any modifications visible in `git status` predate this agent's invocation.
- [x] **ROADMAP.md NOT modified by this executor.** Same ownership contract.
- [ ] **Task 2.2 field evidence captured.** ⚠️ DEFERRED — see Deviations. User-approved to proceed; remediation path = gap-closure phase OR retroactive marking after normal dev-flow exercise.

---
*Phase: 01-prime-user-directory*
*Plan: 03 (Wave 2 — admin refresh endpoint)*
*Completed: 2026-04-24*
