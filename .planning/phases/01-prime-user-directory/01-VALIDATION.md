---
phase: 1
slug: prime-user-directory
status: draft
nyquist_compliant: false
wave_0_complete: false
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

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

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

**Approval:** pending
