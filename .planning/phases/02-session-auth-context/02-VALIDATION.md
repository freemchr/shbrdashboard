---
phase: 2
slug: session-auth-context
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-24
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 (shipped by Phase 1) |
| **Config file** | `vitest.config.ts` — Wave 0 widened `include` glob to `['lib/**/*.test.ts', 'app/**/*.test.ts']` (Pitfall 1 / Option A — see Plan 02-01 Task 1) |
| **Quick run command** | `npm test` (= `vitest run`) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~1-2s today (20 tests); grows to ~5-7s with Phase 2 additions (~36-40 tests) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + manual smoke for SESSION-04 / DISPLAY-04
- **Max feedback latency:** ~3 seconds

---

## Per-Task Verification Map

> Populated by the planner from the Phase Requirements → Test Map in RESEARCH.md §"Validation Architecture".
> Planner MUST assign every task in every PLAN.md a row here, including its test type and automated command.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01 T1 | 01 | 0 | SESSION-02 (D-06 type) | T-02-04 | Audit row tampering — type widening keeps existing rows valid; VALID_ACTIONS allowlist intact | unit + tsc | `npm run build` | lib/audit.ts | ⬜ pending |
| 02-01 T2 | 01 | 0 | SESSION-02 (D-06) | T-02-04 | Round-trip new audit shape preserves detail | unit | `npx vitest run lib/audit.test.ts` | lib/audit.test.ts | ⬜ pending |
| 02-01 T3 | 01 | 0 | SESSION-01, SESSION-03 (RED scaffold) | T-02-01, T-02-02 | Contract pin: primeUser field, no audit on miss | unit (RED) | `npx vitest run app/api/auth/session/route.test.ts` | app/api/auth/session/route.test.ts | ⬜ pending |
| 02-01 T4 | 01 | 0 | SESSION-02 (RED scaffold) | T-02-03, T-02-05 | Contract pin: miss audit + Pitfall 6 ordering invariant | unit (RED) | `npx vitest run app/api/auth/login/route.test.ts` | app/api/auth/login/route.test.ts | ⬜ pending |
| 02-01 T5 | 01 | 0 | (planning gate) | n/a | n/a | doc | `grep "nyquist_compliant: true" .planning/phases/02-session-auth-context/02-VALIDATION.md` | this file | ⬜ pending |
| 02-02 T1 | 02 | 1 | SESSION-01, SESSION-03 | T-02-01, T-02-02 | Live-read primeUser; no audit write on miss; [session] log prefix | unit (GREEN) | `npx vitest run app/api/auth/session/route.test.ts` | app/api/auth/session/route.ts | ⬜ pending |
| 02-03 T1 | 03 | 1 | SESSION-02 | T-02-03, T-02-05 | Miss audit with cache-state detail; D-04 ordering | unit (GREEN) | `npx vitest run app/api/auth/login/route.test.ts` | app/api/auth/login/route.ts | ⬜ pending |
| 02-04 T1 | 04 | 2 | SESSION-04 | T-02-01 (consumed) | AuthContext + AuthGuard hydration carry primeUser | manual-smoke (DevTools) | `npm run build` (typecheck only) + manual | lib/auth-context.tsx, components/ui/AuthGuard.tsx | ⬜ pending |
| 02-04 T2 | 04 | 2 | DISPLAY-04 | T-02-01 (consumed) | TopBar fallback cascade primeUser?.fullName?.trim() ‖ userEmail | manual-smoke (visual) | manual: log in as Chris (Prime hit) + as non-Prime email | components/ui/TopBar.tsx | ⬜ pending |
| 02-04 T3 | 04 | 2 | (Pitfall 3) | T-02-04 (display) | ActionBadge renders prime_user_miss as a distinct amber badge (NOT mislabeled "Logout") | manual-smoke (visual) | manual: open admin audit tab after Plan 03 lands and a miss row exists | app/admin/page.tsx | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> From RESEARCH.md "Wave 0 Gaps". Must be resolved in Wave 0 (before any Wave 1 implementation can land).

- [x] **Vitest glob decision** — widened `vitest.config.ts` `include` to `['lib/**/*.test.ts', 'app/**/*.test.ts']` (Option A). Without this, `*.test.ts` files under `app/api/auth/` would be silently skipped. Closed in Plan 02-01 Task 1.
- [x] **Test file scaffolds** — Option A files created in Plan 02-01 Tasks 2–4:
  - `app/api/auth/session/route.test.ts` (RED, 4/8 contract tests fail awaiting Plan 02)
  - `app/api/auth/login/route.test.ts` (RED, 3/8 contract tests fail awaiting Plan 03)
  - `lib/audit.test.ts` (GREEN, 6/6 — type extension complete)
- [x] **`next/headers` mock decision** — `@/lib/session` boundary mock (recommended). Tests never mock the underlying request-cookie module directly. Closed in Plan 02-01 Tasks 3 and 4.
- [x] **`ActionBadge` scope decision** — fix `app/admin/page.tsx:508-513` to render `'prime_user_miss'` rows properly in Phase 2 Plan 04 Task 3 (NOT deferred to Phase 3 DISPLAY-03). See plan 02-04 verification map row.

---

## Manual-Only Verifications

> Deferred per D-15 (no browser/RSC test harness this milestone — matches Phase 1 D-21).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `AuthGuard` hydrates `primeUser` into AuthContext from session fetch | SESSION-04 | No RSC/browser test harness | Log in as Chris's account; open React DevTools; inspect `AuthContext` provider value — expect `primeUser.fullName` populated |
| `useAuth().primeUser` accessible from client components | SESSION-04 | No RSC/browser test harness | Same as above; confirm value visible in any `useAuth()` consumer |
| TopBar renders `primeUser.fullName` when populated | DISPLAY-04 | Visual | Log in as Chris's account; verify TopBar shows display name (not email) |
| TopBar falls back to `userEmail` when `primeUser` is null | DISPLAY-04 | Visual | Log in with a non-Prime email (or while cache is empty); verify TopBar shows email |
| TopBar handles whitespace-only fullName | DISPLAY-04 | Visual (if helper not extracted) | Rarely possible in live data — covered by unit test if display-name helper is extracted to `lib/`; otherwise DOM-inspect |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready (Wave 0 closes 02-01)
