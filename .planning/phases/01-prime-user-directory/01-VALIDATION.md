---
phase: 1
slug: prime-user-directory
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (to be installed in Wave 0 per D-20) |
| **Config file** | `vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `npm test -- lib/prime-users.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds (pure-logic unit suite, no network) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- lib/prime-users.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

*The planner fills this table once PLAN.md files are authored. Each task either gets an automated `vitest` command or depends on a Wave 0 file. Expect rows for: email normalization, `resolveByEmail` hit/miss, empty-cache branch, stale-cache branch, Prime-unreachable branch, record-shape mapping, admin endpoint auth (401/403/200), admin endpoint failure (502).*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 0.1 | 01 | 0 | DIR-01,DIR-02,DIR-04 | — | Vitest devDeps installed + npm scripts wired | setup | `node -e "const p=require('./package.json'); process.exit(p.scripts.test&&p.devDependencies.vitest?0:1)"` | ❌ → ✅ Wave 0 | ⬜ pending |
| 0.2 | 01 | 0 | DIR-01,DIR-02,DIR-04 | — | vitest.config.ts created with node env + tsconfigPaths | setup | `test -f vitest.config.ts && grep -q "environment: 'node'" vitest.config.ts` | ❌ → ✅ Wave 0 | ⬜ pending |
| 0.3 | 01 | 0 | DIR-01,DIR-02,DIR-04 | — | Test stub created with PROBE FINDINGS comment + ≥12 it.todo cases | setup | `npm test` (exits 0 with all todo) | ❌ → ✅ Wave 0 | ⬜ pending |
| 0.4 | 01 | 0 | DIR-01 | — | Prime /users attribute keys captured; probe script removed | manual smoke | `! test -f scripts/probe-prime-users.ts && ! grep -q "<fill in:" lib/prime-users.test.ts` | manual | ⬜ pending |
| 0.5 | 01 | 0 | (meta) | — | VALIDATION.md Per-Task Map updated for Plan 01 rows | docs | `grep -q "\| 0.1 \| 01 \|" .planning/phases/01-prime-user-directory/01-VALIDATION.md` | ✅ self-verifying | ⬜ pending |
| 1.1 | 02 | 1 | DIR-01,DIR-02,DIR-04 | T-03,T-04,T-05 | lib/prime-users.ts implemented (composes primeGetAllPages + blob-cache; preserve-on-failure; PII-safe mapper) | unit | `npx tsc --noEmit lib/prime-users.ts` exits 0 | ❌ → ✅ Wave 1 | ⬜ pending |
| 1.2 | 02 | 1 | DIR-01,DIR-02,DIR-04 | T-03 | All ≥12 Vitest cases implemented and passing (covers DIR-01 mapping, DIR-02 hot-path, DIR-04 resilience, Pitfall 1 first-miss-no-write) | unit | `npm test` exits 0 with ≥12 passed | ❌ → ✅ Wave 1 | ⬜ pending |
| 1.3 | 02 | 1 | (meta) | — | VALIDATION.md Per-Task Map updated for Plan 02 rows | docs | `grep -q "\| 1.[1-3] \| 02 \|" .planning/phases/01-prime-user-directory/01-VALIDATION.md` | ✅ self-verifying | ⬜ pending |
| 2.1 | 03 | 2 | DIR-03 | T-01,T-04 | Admin endpoint shipped: 401/403/502/200 branches; isAdminEmail two-gate; runtime nodejs; no cron-secret check | code | `npx tsc --noEmit && grep -q "isAdminEmail(" app/api/admin/prime-users/refresh/route.ts` | ❌ → ✅ Wave 2 | ✅ green (code-review approved) |
| 2.2 | 03 | 2 | DIR-03,DIR-04 | T-01,T-02,T-03 | Manual smoke: A=401, B=403, C=200 (idempotent), D=502 with lastSuccessAt preserved + [prime-users] log line | manual smoke | (4 curl cases — see Manual-Only Verifications) | manual | ⚠️ deferred (user-approved via 8 automated gates; full smoke happens in normal dev flow) |
| 2.3 | 03 | 2 | (meta) | — | VALIDATION.md updated for Plan 03 + nyquist_compliant flipped to true | docs | `grep -q "nyquist_compliant: true" .planning/phases/01-prime-user-directory/01-VALIDATION.md` | ✅ self-verifying | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ⚠️ deferred*

---

## Wave 0 Requirements

- [ ] Install `vitest`, `vite-tsconfig-paths` as devDependencies (per RESEARCH.md §Vitest Integration)
- [ ] Create `vitest.config.ts` at repo root (node environment, `@/` alias via `vite-tsconfig-paths`)
- [ ] Add `"test": "vitest"` and `"test:run": "vitest run"` scripts to `package.json`
- [ ] Create `lib/prime-users.test.ts` — stub test file with `describe()` blocks for each validation case
- [ ] **Prime `/users` probe (throwaway script)** — one live call to capture actual attribute keys for `division`/`region`/`roleOrTrade`; record findings in a code comment or CONTEXT.md update; delete the probe script before plan wave 1. This closes Gate 1 from RESEARCH.md.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin force-refresh end-to-end against live Prime | DIR-03 | No integration harness in this milestone; live OAuth requires real credentials | 1. Log in as an admin user in dev. 2. `curl -X POST -b "<session cookie>" http://localhost:3000/api/admin/prime-users/refresh`. 3. Assert `200 { ok: true, userCount: N, durationMs: ..., cachedAt: ... }`. 4. Re-run — assert `userCount` unchanged on idempotent refresh. |
| Cache survives Prime outage | DIR-04 | Requires simulating Prime 5xx/timeout in a real environment | 1. Populate cache via step above. 2. Temporarily point `NEXT_PUBLIC_PRIME_API_URL` to an unreachable host (or revoke Prime creds). 3. Hit force-refresh — assert `502 { ok: false, error, lastSuccessAt }` and `console.error` logs `[prime-users]`. 4. Call `getAllPrimeUsers()` from a test page/REPL — assert previous cache still returns. |
| Non-admin + unauthenticated access to refresh endpoint | DIR-03 | Session cookie plumbing requires browser context | 1. Logged-out `curl -X POST /api/admin/prime-users/refresh` → assert 401. 2. Logged in as non-admin → assert 403. |

*Prime `/users` call-volume observation (DIR-04 success criterion #4) is implicit: after Phase 1 ships, normal page loads should not increment Prime's request counter for `/users` — verify by watching Prime's rate-limit headers across a dashboard session.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Vitest install, config, test stub, Prime probe)
- [ ] No watch-mode flags (use `vitest run` for CI-safe single-shot)
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter once planner wires the Per-Task Verification Map

**Approval:** approved by Wave 2 manual smoke (code-review gated; full 4-case curl smoke deferred to normal dev flow — see Plan 03 SUMMARY Deviations)
