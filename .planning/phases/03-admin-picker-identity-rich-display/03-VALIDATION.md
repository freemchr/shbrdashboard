---
phase: 3
slug: admin-picker-identity-rich-display
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (added Phase 1) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

*Planner fills this table per task in PLAN.md files.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Populated by planner from RESEARCH.md Validation Architecture section.*

- [ ] `components/ui/PrimeUserPicker.test.ts` — filter logic tests (case-insensitive, name + email + division, null-safe, multi-token)
- [ ] `lib/identity-display.test.ts` — three-step actor cascade (live → entry.name → email; whitespace handling)
- [ ] `app/api/admin/prime-users/route.test.ts` — 401/403/200 contract for new GET endpoint

*Existing vitest config and Phase 1 / Phase 2 fixtures cover the rest.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Picker keyboard navigation (↑/↓/Enter/Esc/Backspace) | ADMIN-01..03 | Browser DOM + keyboard events outside vitest harness | Open Visibility tab → focus picker → type, navigate, Enter, Esc; verify chip add/remove |
| Picker visual chrome (focus ring, dropdown shadow, chip styling) | ADMIN-01, DISPLAY-01 | Visual fidelity — Tailwind class output not auto-checkable | Inspect against Phase 2 UI-SPEC tokens (`text-sm`, `text-gray-300`, `text-gray-500`) |
| Refresh button metadata rendering ("Refreshed N units ago · X.Ys") | ADMIN-04 (implicit) | Live Prime call timing | Click refresh; verify metadata line updates with userCount, durationMs, relative cachedAt |
| Stale-entry tooltip on email-only rows | ADMIN-05 | Native `title` hover | Add unresolvable email; hover; verify "No Prime record found" tooltip |
| CSV export "Display Name" column | DISPLAY-03 | File download outside vitest | Export CSV; open; verify column order Timestamp / Email / Display Name / Action |
| Manual-email fallback during Prime outage (D-12) | ADMIN-04 (graceful degradation) | Requires breaking `/api/admin/prime-users` | Temporarily disable endpoint; confirm "Prime directory unavailable" message + raw email-input field |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
