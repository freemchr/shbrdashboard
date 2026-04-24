# SHBR Dashboard

## What This Is

A Next.js 14 dashboard for SHBR Group that surfaces Prime ERP data (jobs, financials, scheduling, WHS, analytics) to internal staff, with admin-controlled per-group page visibility and AI-assisted report writing on top. Primary users are SHBR operational, estimating, and management staff; authentication is via Prime OAuth so every user is already a Prime account.

## Core Value

Reliable, role-appropriate access to Prime ERP data for SHBR team members — the right people see the right dashboards, backed by the identity Prime already knows about them.

## Current Milestone: v1.0 Prime-Aligned Admin & Access Control

**Goal:** Replace the admin/visibility system's local email-list identity model with a Prime-sourced user directory, so admins manage access against authoritative user data (name, division, region, role) instead of re-entered email strings.

**Target features:**
- Pull user records from Prime `/users` (name, division, region, role/trade) and cache server-side
- Extend session and auth context so the logged-in user carries Prime attributes, not just email + derived name
- Replace the paste-emails-into-textarea group member UI with a searchable Prime-backed user picker
- Show Prime-sourced name + division wherever we currently render a bare email (audit log, admin UI, top bar)
- Group memberships stay locally stored (email-keyed) for continuity — only the identity layer changes

## Requirements

### Validated

<!-- Inferred from existing brownfield codebase — shipped, in production, relied upon. -->

- ✓ Prime OAuth password-grant authentication with 8-hour iron-session cookies — existing
- ✓ ~27 dashboard pages consuming Prime data (overview, stalled/aging, financial, pipeline, map, reports, reports AI assist, WHS, weather, CAT forecast, clients, locations, ops, team, SLA, SLA predictor, estimators, timeline, bottlenecks, vulnerable customers, EOL, flexi-calc, flagged, command-centre, search, socials) — existing
- ✓ Admin hub with Visibility / Audit Log / Changelog tabs at `/admin` — existing
- ✓ Group-based page visibility config persisted to Vercel Blob with 1-min in-memory cache — existing
- ✓ AI report-assist features using OpenAI GPT-4o (caption, enhance, polish, score, validate-scope) — existing
- ✓ Prime API client with OAuth token caching, retry on 429/401, paginated fetch with 1.1s throttle — existing
- ✓ Scheduled Vercel cron jobs (client/location analytics refresh, geocode, timeline, BOM warnings, SLA predict) — existing
- ✓ Audit log for login/logout events, with filterable admin UI and CSV export — existing
- ✓ Kiosk mode for full-bleed public/monitoring display — existing
- ✓ Brute-force login rate limit (10 attempts / 15 min / IP) — existing

### Active

<!-- Current milestone scope — hypotheses until shipped. -->

- [ ] Fetch and cache Prime `/users` list for use as authoritative user directory
- [ ] On login, resolve the authenticated email against Prime `/users` and store attributes (display name, division, region, role/trade) in the session
- [ ] `/api/auth/session` returns Prime-sourced user attributes in addition to current fields
- [ ] `AuthContext` carries Prime user attributes; consumers (TopBar, admin UI) read from context rather than deriving from email
- [ ] Admin "Page Visibility" tab replaces email textarea inputs with a searchable Prime user picker showing name + division
- [ ] Group member lists, admin lists, and audit entries display Prime-sourced name + division rather than bare emails
- [ ] New group members are added by picking from Prime users (picker-first UX); the underlying storage shape (`groups[].members: email[]`) stays the same
- [ ] Prime user cache has an explicit refresh cadence (to be decided in planning — TTL, cron, or on-demand)

### Out of Scope

<!-- Deferred to future milestones. Each has a reason to prevent re-adding. -->

- Server-side page + API route enforcement of visibility — acknowledged gap, but current milestone is scoped to identity. A hidden-from user today can still load page HTML or hit `/api/prime/*` directly with a valid session. Deferred so the Prime integration ships cleanly first.
- Audit trail for admin config changes (who edited which group when) — nice to have but orthogonal to identity integration.
- Removing the hardcoded `chris.freeman@techgurus.com.au` admin fallback in `lib/page-visibility.ts` — a developer-specific fallback that should be env-driven only. Low risk today, deferred.
- Attribute-driven "rule" groups (e.g., "all users in division=Estimators auto-belong") — deliberately rejected in favour of explicit email-keyed membership for predictability.
- `ALL_PAGES` vs Sidebar nav drift cleanup — separate concern, both lists are manually maintained and can diverge.
- Blob silent fail-open behaviour review — when the visibility blob 404s or times out, everything becomes visible to everyone. May be intentional availability-over-security posture; deferred for dedicated review.

## Context

**Brownfield — substantial existing system.** The dashboard has been iterated on for multiple quarters and covers a wide slice of SHBR operations. `/gsd-map-codebase` has produced `.planning/codebase/*.md` with architecture, stack, structure, conventions, testing, integrations, and concerns.

**Prime API surface.** The app currently consumes 7 Prime resources (jobs, users, statuses, perils, AP invoices, AR invoices, single-job). The full Prime v2 catalogue exposes ~55 resources including writes, reserves, contents schedules, estimates, timesheets, schedules, site forms, attachments, and more — almost entirely untapped. A capability briefing has been prepared as input for future milestones.

**Identity today.** Every dashboard user is authenticated via Prime OAuth, so Prime is already the source of truth for identity. The gap: we've been treating Prime as an auth server only and maintaining a parallel email list in `lib/page-visibility.ts`. This milestone closes that gap for the admin/visibility system without reworking the visibility model itself.

**Rate limits are real.** Prime enforces 60 req/rolling-minute, **5,000 req/rolling-24h**, and 5 concurrent connections. A naive implementation that re-fetches `/users` on every session check would burn the daily budget fast. Caching strategy is architecturally load-bearing.

**No webhooks from Prime.** Any Prime data we mirror is poll-only. User directory changes in Prime surface on the next sync.

## Constraints

- **Tech stack**: Next.js 14 App Router + React 18 + TypeScript 5 + Tailwind CSS 3 + Vercel deployment — keep for continuity with existing codebase
- **Data source**: Prime API v2 via OAuth password grant — the only backend for operational data
- **Rate limit**: 5,000 Prime API calls per rolling 24 hours shared across the entire app — any new Prime integration must plan cache strategy explicitly
- **Storage**: Vercel Blob for config + audit + analytics caches; `@vercel/blob` free tier is 2,000 ops/month
- **Session**: iron-session cookie, 8-hour TTL, driven by `SESSION_SECRET` env var; session shape changes require care because cookies are deployed/encrypted
- **Brand**: dark theme (bg-gray-950), red accents (#DC2626), SHBR logo; admin UI follows existing hub-with-tabs pattern
- **Compatibility**: do not break existing `VisibilityConfig` blob schema — the config may already have non-trivial content in production
- **No tests**: repo has ESLint but no Jest/Vitest setup. Test strategy for this milestone should be decided during planning

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Prime as user directory, not attribute-driven rule groups | Explicit membership is more predictable and matches current mental model; rule-based sync adds a class of bugs (stale rules, drift) we don't want yet | — Pending |
| Group membership stays email-keyed at storage layer | Zero-migration path; existing blob configs keep working; Prime email is already the join key | — Pending |
| Scope kept to identity integration only; hardening/enforcement deferred | Ship a visible improvement quickly; avoid mixing two milestones that need different test strategies | — Pending |
| Searchable Prime-backed user picker replaces paste-emails textarea | Main UX benefit the user directory unlocks; discoverability improves markedly | — Pending |
| Cache `/users` list rather than call per session | 5,000/day Prime rate limit makes per-request calls unsafe at scale | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-24 after initialization*
