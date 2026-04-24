---
phase: 3
slug: admin-picker-identity-rich-display
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

This phase introduces the dashboard's first React component requiring DOM interaction (combobox keyboard nav, mouse selection, focus management). Existing Vitest harness from Phases 1+2 covers Node-side test files (`lib/*.test.ts`, `app/api/*/route.test.ts`) but does NOT cover `.tsx` files or DOM rendering. **Wave 0 must extend the test harness before any picker component test can run** — see RESEARCH.md "Wave 0 Gaps" and "Pitfall 7" for the concrete gap.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 (existing, since Phase 1 D-20) |
| **Config file** | `vitest.config.ts` — needs Wave 0 widening (`include` glob to accept `.tsx` + JSDOM environment) |
| **Quick run command** | `npx vitest run <file>` (single-file, no watch) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10s full suite (43 tests as of Phase 2 close-out, expect ~75-90 after Phase 3) |

DOM testing additions:
- `@vitest/browser` is OUT OF SCOPE per Phase 1 D-21 / Phase 2 D-25 (no browser harness this milestone)
- **JSDOM via Vitest's built-in `environment: 'jsdom'`** — install `jsdom` as dev-dep, set per-file `// @vitest-environment jsdom` directive OR config-level `test.environment: 'jsdom'` for `.tsx` files only
- Library helper: `@testing-library/react` (`render`, `screen`, `fireEvent`, `waitFor`) — installed in Wave 0 alongside JSDOM

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <file>` for the test file(s) the task touches
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~3s per single-file run, ~10s full suite

---

## Per-Task Verification Map

The exact task breakdown comes from PLAN.md files. This map is the verification skeleton — each plan task must populate the row with its task ID, the test command, and the file-exists status (✅ once Wave 0 completes, ❌ until then).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | DIR-04 (test infra) | — | N/A — config | infra | `npx vitest run --config vitest.config.ts --reporter=verbose 2>&1 \| grep "Test Files"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | — | — | N/A — fixture | infra | `npx vitest run components/ui/PrimeUserPicker.test.tsx` (RED — file scaffold only) | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | ADMIN-04 (filter contract) | — | RED test pins typeahead filter | unit | `npx vitest run components/ui/PrimeUserPicker.test.tsx -t "filter"` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 0 | DISPLAY-03 (audit cascade) | — | RED test pins audit name resolution | unit | `npx vitest run app/admin/page.test.tsx -t "actor cascade"` | ❌ W0 | ⬜ pending |
| 03-02-XX | 02 | 1 | ADMIN-01..04, DIR-* | T-03-XX | picker delivers Prime users; tri-state directory | unit + DOM | `npx vitest run components/ui/PrimeUserPicker.test.tsx` (GREEN) | ✅ post-W0 | ⬜ pending |
| 03-03-XX | 03 | 1 | ADMIN-01..03 | T-03-XX | endpoint serves cached directory only (no live Prime call) | unit | `npx vitest run app/api/admin/prime-users/route.test.ts` | ✅ post-W0 | ⬜ pending |
| 03-04-XX | 04 | 2 | ADMIN-05, DISPLAY-01..03 | T-03-XX | site integrations consume picker; audit cascade renders | unit + DOM | `npx vitest run app/admin/page.test.tsx` | ✅ post-W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

The planner's job in step 8 is to fill in the actual task IDs and concrete commands per plan. The wave column above reflects the expected breakdown:
- **Wave 0:** Vitest config widening, JSDOM install, Testing Library install, RED test scaffolds (picker + audit cascade)
- **Wave 1:** Implementation that flips Wave 0 RED tests GREEN — picker component (Plan 02) and GET endpoint (Plan 03), parallelizable since they don't share files
- **Wave 2:** Site integrations (Plan 04) — admin page wiring, audit table cascade, filter dropdown extension; depends on Waves 0 and 1

---

## Wave 0 Requirements

These MUST be addressed before any Wave 1 picker test can run. Wave 0 is solo (no parallel) and additive — does not modify existing source code.

- [ ] **`vitest.config.ts`** — widen `include` glob from `['lib/**/*.test.ts', 'app/**/*.test.ts']` to also include `'**/*.test.tsx'`; set `environment: 'jsdom'` (or per-file directive)
- [ ] **`package.json` devDependencies** — install `jsdom` (~5MB) and `@testing-library/react` (~50KB) plus `@testing-library/jest-dom` for matchers; commit `package-lock.json`
- [ ] **`components/ui/PrimeUserPicker.test.tsx`** — RED test scaffold per RESEARCH.md "Test Strategy" section: tri-state container assertions, filter substring across name/email/division, keyboard nav (arrow/enter/esc/backspace), chip add/remove, historical detection, ARIA attributes per Pattern 4
- [ ] **`app/api/admin/prime-users/route.test.ts`** — RED test scaffold for the new GET endpoint: 401 unauthenticated, 403 non-admin (per RESEARCH.md Open Question #1), response shape, `getCached()` not `getAllPrimeUsers()` (per RESEARCH.md, prevents Prime call on cold deploy)
- [ ] **`app/admin/page.test.tsx`** — RED test scaffold for AuditTab actor cascade (`livePrimeUser?.fullName → entry.name → entry.email`) and filter dropdown extension (`prime_user_miss` accepted)

After Wave 0 ships, the planner's plan files for Waves 1+2 can fill in the GREEN-flipping implementation tasks against these scaffolds.

---

## Manual-Only Verifications

These behaviors require human visual confirmation in the deployed preview/prod environment — same model as Phase 1 D-21 / Phase 2 D-25 (no browser harness this milestone, manual smoke is the verification mechanism).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Picker dropdown visual layout (3-line rows, dot separator, division when present) | ADMIN-04, D-03 | DOM tests assert content but not pixel layout / typography | Open `/admin` → Visibility tab → focus admin search → verify dropdown rows match UI-SPEC §"Picker Dropdown Row" exactly |
| Chip visual treatment (compact, name-only, hover tooltip via native `title`) | D-04 | DOM tests assert classes but tooltip is browser-native | Hover over a chip → confirm browser tooltip shows division + email; resize narrow → confirm chip truncates at `max-w-[200px]` |
| Historical chip italic+gray distinction | D-08 | Visual styling of italic/gray vs live chips | Add a non-Prime email manually (or wipe directory) → confirm visual distinction matches UI-SPEC |
| Inline refresh hint visibility + last-refresh-ago text | D-10 | Conditional rendering + `formatRelative` correctness over time | Trigger historicals → confirm hint appears with "X ago" copy; click refresh → confirm hint disappears once cache is fresh |
| Audit row two-line actor cascade visual | DISPLAY-03 | DOM test asserts text content, not visual hierarchy | Open `/admin` → Audit tab → verify each row shows name (primary) over email (secondary); for cascade-to-email rows, only one line renders |
| Audit filter dropdown shows "Prime miss" option | D-13 | Native `<select>` rendering | Open filter dropdown → confirm "Prime miss" option present between Login and Logout |
| Picker keyboard navigation feel (arrow loop, focus ring visibility) | D-19 + RESEARCH Pattern 4 | DOM tests assert ARIA state but not perceived smoothness | Type, arrow up/down, observe focus ring on dropdown row; press Enter on highlighted row; press Esc; press Backspace on empty input → last chip removed |
| Empty/error state copy + visual register | D-20 | Edge case requires triggering Prime cache empty | Wipe directory blob (or test on fresh deploy) → focus picker → confirm empty state matches UI-SPEC copy |

These items will be captured in `03-HUMAN-UAT.md` after the verifier runs (same pattern as Phase 2's human_needed status flow).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner enforces)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (planner enforces)
- [ ] Wave 0 covers all MISSING references (vitest config + JSDOM + Testing Library + 3 RED test scaffolds)
- [ ] No watch-mode flags (commands all use `vitest run`, never `vitest`)
- [ ] Feedback latency < 10s (single-file ~3s, full suite ~10s — verified against Phase 2 timings)
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 ships and the per-task map is filled in

**Approval:** pending — frontmatter `status: draft`. Planner sets to `approved` after Wave 0 ships and per-task map is filled in (or the plan-checker bumps it).
