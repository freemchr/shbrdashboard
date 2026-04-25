# Roadmap: SHBR Dashboard — v1.0 Prime-Aligned Admin & Access Control

## Overview

This milestone replaces the dashboard's local email-list identity model with a Prime-sourced user directory. Work flows server-outward: first stand up a cached Prime `/users` directory (Phase 1), then thread Prime attributes through the session and auth context so the logged-in user carries them everywhere (Phase 2), then rebuild the admin UI around a searchable picker and render Prime name + division wherever a bare email appears today (Phase 3). The existing `VisibilityConfig` blob schema and email-keyed group membership stay unchanged — only the identity layer is replaced.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Prime User Directory** — Cached server-side fetcher for Prime `/users` with admin refresh and resilient failure behaviour
- [ ] **Phase 2: Session & Auth Context Integration** — Login resolves Prime attributes, session + `/api/auth/session` + AuthContext + TopBar carry them end-to-end
- [ ] **Phase 3: Admin Picker & Identity-Rich Display** — Searchable Prime user picker replaces email textareas; admin lists, group lists, and audit log show name + division

## Phase Details

### Phase 1: Prime User Directory
**Goal**: A cached, authoritative Prime user directory is available server-side for every downstream consumer, without putting the 5,000/day Prime budget at risk.
**Depends on**: Nothing (first phase)
**Requirements**: DIR-01, DIR-02, DIR-03, DIR-04
**Success Criteria** (what must be TRUE):
  1. A server-side lookup can resolve an email to a Prime user record (name, division, region, role/trade) without performing a live Prime call on the hot path.
  2. A logged-in admin can trigger an explicit cache refresh from an authenticated endpoint and observe updated directory data afterwards.
  3. When Prime is unreachable, rate-limited, or returns an auth error, the most recent cached directory continues to serve lookups — no dependent request crashes, and the failure is logged for admin visibility.
  4. Observed Prime `/users` call volume from normal dashboard traffic stays well under the 5,000/day shared budget (per-request lookups are not hitting Prime).
**Plans**: 3 plans
  - [x] 01-01-PLAN.md — Wave 0: Vitest harness + Prime /users probe (DIR-01,02,04)
  - [x] 01-02-PLAN.md — Wave 1: lib/prime-users.ts module + ≥12 Vitest cases (DIR-01,02,04)
  - [x] 01-03-PLAN.md — Wave 2: admin force-refresh endpoint + manual smoke (DIR-03)

### Phase 2: Session & Auth Context Integration
**Goal**: The authenticated user's Prime identity (display name, division, region, role/trade) is carried on the session and surfaced through `/api/auth/session`, AuthContext, and the TopBar — no client ever has to re-derive identity from an email.
**Depends on**: Phase 1
**Requirements**: SESSION-01, SESSION-02, SESSION-03, SESSION-04, DISPLAY-04
**Success Criteria** (what must be TRUE):
  1. After logging in, `/api/auth/session` returns Prime-sourced attributes (display name, division, region, role/trade) alongside the existing `userEmail` / `isAdmin` fields. Attributes are derived per request from the Phase 1 directory cache via `resolveByEmail()` rather than stored in the iron-session cookie (amended by Phase 2 CONTEXT D-02).
  2. A user whose email is not resolvable in the Prime directory can still log in successfully; their Prime attributes are null and an admin-reviewable log entry records the miss.
  3. `/api/auth/session` returns the Prime attributes to the client, and `AuthContext` exposes them to client components without any additional fetches.
  4. The TopBar shows the logged-in user's Prime display name (falling back to email when no Prime record exists), matching today's fallback behaviour.
**Plans**: 4 plans
  - [x] 02-01-PLAN.md — Wave 0: vitest glob + audit type extension + 3 contract test scaffolds (SESSION-02 type)
  - [x] 02-02-PLAN.md — Wave 1: session route live-read primeUser + [session] log prefix (SESSION-01, SESSION-03)
  - [x] 02-03-PLAN.md — Wave 1: login route prime_user_miss audit with cache-state detail (SESSION-02)
  - [x] 02-04-PLAN.md — Wave 2: AuthContext + AuthGuard + TopBar identity label + ActionBadge fix (SESSION-04, DISPLAY-04)
**UI hint**: yes

### Phase 3: Admin Picker & Identity-Rich Display
**Goal**: Admins manage access by picking real Prime users from a searchable directory instead of pasting emails, and every place the UI shows a user — admin list, group lists, audit log — renders Prime name + division with a graceful email fallback for historical entries.
**Depends on**: Phase 1, Phase 2
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, DISPLAY-01, DISPLAY-02, DISPLAY-03
**Success Criteria** (what must be TRUE):
  1. The Visibility tab's "Dashboard Admins" input, the group member editor, and the "New Group" form all use the same searchable Prime user picker; typing in the search field filters Prime users by name, email, and division simultaneously.
  2. Picker result rows each display Prime display name, email, and division so an admin can confidently distinguish between users.
  3. Group and admin lists in the admin UI render each member as "Name — Division" with email as secondary detail; entries for emails no longer present in the Prime directory still render (falling back to email) and can be removed.
  4. The audit log renders every event's actor as Prime display name (with email fallback), readable at a glance without needing to look up who an email belongs to.
  5. The existing `VisibilityConfig` blob schema is unchanged — stored group memberships remain email-keyed and pre-existing production blobs load and save without migration.
**Plans**: 5 plans
  - [x] 03-01-PLAN.md — Wave 1: utilities (identity-display cascade + format-relative + getDirectoryMetadata) + Vitest (ADMIN-04, ADMIN-05, DISPLAY-01, DISPLAY-02, DISPLAY-03)
  - [x] 03-02-PLAN.md — Wave 2: GET /api/admin/prime-users route handler + 401/403/200/500 tests (ADMIN-01..04)
  - [ ] 03-03-PLAN.md — Wave 2: shared <PrimeUserPicker> combobox component + filter/normalize tests (ADMIN-01..05)
  - [ ] 03-04-PLAN.md — Wave 3: extract VisibilityTab; wire picker on Dashboard Admins / GroupCard / New Group + refresh button + cascade rows (ADMIN-01..05, DISPLAY-01, DISPLAY-02)
  - [ ] 03-05-PLAN.md — Wave 4: extract AuditTab; wire D-15 cascade + prime_user_miss tooltip + CSV column rename via downloadCSV (DISPLAY-03)
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Prime User Directory | 0/TBD | Not started | - |
| 2. Session & Auth Context Integration | 0/TBD | Not started | - |
| 3. Admin Picker & Identity-Rich Display | 2/5 | In progress | - |
