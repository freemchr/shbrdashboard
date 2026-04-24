---
phase: 2
slug: session-auth-context
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 (shipped by Phase 1) |
| **Config file** | `vitest.config.ts` — **Wave 0 must widen `include` glob OR extract helpers to `lib/` (see RESEARCH.md Wave 0 Gap)** |
| **Quick run command** | `npm test` (= `vitest run`) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~1-2s today (20 tests); grows to ~2-3s with Phase 2 additions (~35-40 tests) |

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
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> From RESEARCH.md "Wave 0 Gaps". Must be resolved in Wave 0 (before any Wave 1 implementation can land).

- [ ] **Vitest glob decision** — widen `vitest.config.ts` `include` to `['lib/**/*.test.ts', 'app/**/*.test.ts']` OR extract helpers to `lib/auth/` and test there. Without this, `*.test.ts` files under `app/api/auth/` will be silently skipped.
- [ ] **Test file scaffolds** (one of these shapes):
  - Option A (glob widened): `app/api/auth/session/route.test.ts`, `app/api/auth/login/route.test.ts`, `lib/audit.test.ts`
  - Option B (helper extracted): `lib/auth/session-response.test.ts`, `lib/auth/login-miss-audit.test.ts`, `lib/audit.test.ts`
- [ ] **`next/headers` mock decision** — mock at `@/lib/session` boundary (recommended) OR mock `next/headers` directly in every route test.
- [ ] **`ActionBadge` scope decision** — fix `app/admin/page.tsx:508-513` to render `'prime_user_miss'` rows properly in Phase 2, OR explicitly defer to Phase 3 DISPLAY-03.

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
