# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24)

**Core value:** Reliable, role-appropriate access to Prime ERP data for SHBR team members — the right people see the right dashboards, backed by the identity Prime already knows about them.
**Current focus:** Phase 1 — Prime User Directory

## Current Position

Phase: 1 of 3 (Prime User Directory)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-24 — Roadmap created; 17 v1 requirements mapped across 3 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Prime User Directory | 0 | — | — |
| 2. Session & Auth Context Integration | 0 | — | — |
| 3. Admin Picker & Identity-Rich Display | 0 | — | — |

**Recent Trend:**
- Last 5 plans: —
- Trend: — (no plans executed yet)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Milestone: Prime is the user directory — attribute-driven rule groups rejected for predictability
- Milestone: Group membership stays email-keyed at storage layer — zero-migration path
- Milestone: Scope is identity integration only — hardening/enforcement deferred to future milestone
- Milestone: Cache Prime `/users` rather than call per session — 5,000/day rate limit makes per-request calls unsafe

### Pending Todos

None yet.

### Blockers/Concerns

- Cache refresh cadence (TTL vs cron vs on-demand) is an open design question for Phase 1 planning
- No test harness exists (no Jest/Vitest) — test strategy for this milestone is an open question for Phase 1 planning
- Iron-session cookie shape extension requires care: existing users have encrypted cookies in flight; Phase 2 must handle old-shape cookies gracefully

## Deferred Items

Items acknowledged and carried forward (tracked in REQUIREMENTS.md v2 section):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Enforcement | Server-side page + API visibility enforcement | Deferred to v2 | Milestone init |
| Admin audit | Audit trail for admin config changes | Deferred to v2 | Milestone init |
| Bootstrap | Remove hardcoded developer admin fallback | Deferred to v2 | Milestone init |
| Rule groups | Attribute-driven rule-based groups | Rejected (out of scope) | Milestone init |
| Nav drift | `ALL_PAGES` vs Sidebar nav reconciliation | Deferred to v2 | Milestone init |

## Session Continuity

Last session: 2026-04-24
Stopped at: Roadmap written — 3 phases, 17/17 requirements mapped, ready for Phase 1 planning
Resume file: None
