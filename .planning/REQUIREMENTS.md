# Requirements: SHBR Dashboard — v1.0 Prime-Aligned Admin & Access Control

**Defined:** 2026-04-24
**Core Value:** Reliable, role-appropriate access to Prime ERP data for SHBR team members — the right people see the right dashboards, backed by the identity Prime already knows about them.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Prime User Directory (DIR)

- [ ] **DIR-01**: Server-side fetcher retrieves the Prime users list from `/users` via the existing Prime auth client, including paginated results across all pages
- [ ] **DIR-02**: Prime user directory is cached server-side with an explicit TTL that keeps daily Prime API calls well under the 5,000/day budget
- [ ] **DIR-03**: An admin-only endpoint can force-refresh the Prime user cache on demand (for onboarding / offboarding events)
- [ ] **DIR-04**: Cache failures (network, auth, rate limit) do not corrupt cached data or crash dependent requests — stale cache is preferred to a hard failure

### Session & Auth Context (SESSION)

- [ ] **SESSION-01**: On successful login, the authenticated user's Prime record is resolved by email and their attributes (display name, division, region, role/trade) are stored in the iron-session cookie
- [ ] **SESSION-02**: Login still succeeds if the authenticated email cannot be resolved to a Prime user; Prime attributes are null and a log entry is written for admin review
- [ ] **SESSION-03**: `/api/auth/session` returns Prime-sourced attributes in addition to existing fields (`userEmail`, `isAdmin`, `hiddenPaths`)
- [ ] **SESSION-04**: `AuthContext` exposes Prime user attributes to client components so they can render without re-fetching

### Admin UI — User Picker (ADMIN)

- [ ] **ADMIN-01**: "Dashboard Admins" input in the Visibility tab is replaced with a searchable Prime user picker
- [ ] **ADMIN-02**: Existing group member editing UI is replaced with a multi-select Prime user picker
- [ ] **ADMIN-03**: "New Group" creation form uses the same multi-select Prime user picker for initial members
- [ ] **ADMIN-04**: Picker result rows display each user's Prime display name, email, and division; typeahead filters across all three fields
- [ ] **ADMIN-05**: Admin UI preserves and can remove group/admin entries for emails that are no longer present in the Prime directory (historical accounts)

### UI Display (DISPLAY)

- [ ] **DISPLAY-01**: Group member lists in the admin UI render each entry as name + division (with email secondary); missing Prime record falls back to email
- [ ] **DISPLAY-02**: Dashboard Admins list renders the same way (name + division primary, email secondary)
- [ ] **DISPLAY-03**: Audit log entries show Prime display name (falling back to email) for each event
- [ ] **DISPLAY-04**: TopBar shows the logged-in user's Prime display name (falling back to email, matching current behaviour as the fallback)

## v2 Requirements

Deferred to future milestone(s). Tracked but not in current roadmap.

### Enforcement (ENFORCE)

- **ENFORCE-01**: Server-side middleware enforces page visibility (page HTML is not rendered for hidden pages)
- **ENFORCE-02**: API route handlers enforce page-scoped access (e.g. `/api/prime/jobs/aging` rejects requests from users hidden from `/stalled`)
- **ENFORCE-03**: Direct-URL access to a hidden page returns a 403 or redirect, not a brief flash of content

### Admin Config Audit (ADMIN-AUDIT)

- **ADMIN-AUDIT-01**: Every visibility config change (group add/edit/delete, admin add/remove, page restriction change) is appended to an audit log
- **ADMIN-AUDIT-02**: Admin UI exposes a history view of config changes
- **ADMIN-AUDIT-03**: Audit history export (CSV) includes config change events alongside login/logout

### Bootstrap / Admin Fallback (BOOTSTRAP)

- **BOOTSTRAP-01**: Remove hardcoded developer email fallback in `lib/page-visibility.ts`; first-admin bootstrap is env-var-only
- **BOOTSTRAP-02**: Document the env-var bootstrap procedure for new deployments

### Rule-Based Groups (RULE-GROUP)

- **RULE-GROUP-01**: Groups can be defined as rules over Prime attributes (e.g., "all users with division=Estimators")
- **RULE-GROUP-02**: Rule-based groups auto-sync membership as the Prime directory changes

### Nav Drift Cleanup (NAV-DRIFT)

- **NAV-DRIFT-01**: `ALL_PAGES` and Sidebar nav are derived from a single source of truth
- **NAV-DRIFT-02**: Adding a new page registers it automatically in both visibility and navigation

## Out of Scope

Explicitly excluded from this project. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Changing the `VisibilityConfig` blob schema (e.g. ID-keyed groups) | Zero-migration goal; existing production blobs keep working without conversion |
| Replacing the email-keyed group membership model with roles/permissions | Deliberately rejected in favour of explicit predictable membership; user preference is not attribute-driven |
| Replacing Prime OAuth with a different identity provider | Prime is the source of truth; every user is a Prime account — changing this is a different project |
| Pulling non-identity data from Prime (jobs, estimates, reserves, etc.) for this milestone | Focus kept on identity; data-side improvements belong to separate milestones already scoped in the Prime-API capability briefing |
| Updating the existing public-facing login page UX | Not in scope; login already works against Prime OAuth |
| Migration of historical group membership emails to Prime IDs | Emails remain the storage key; lookups happen at display time — no migration |
| Real-time updates to the Prime user directory (websockets/streaming) | Prime does not offer webhooks; poll-based cache is the only option |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIR-01 | TBD | Pending |
| DIR-02 | TBD | Pending |
| DIR-03 | TBD | Pending |
| DIR-04 | TBD | Pending |
| SESSION-01 | TBD | Pending |
| SESSION-02 | TBD | Pending |
| SESSION-03 | TBD | Pending |
| SESSION-04 | TBD | Pending |
| ADMIN-01 | TBD | Pending |
| ADMIN-02 | TBD | Pending |
| ADMIN-03 | TBD | Pending |
| ADMIN-04 | TBD | Pending |
| ADMIN-05 | TBD | Pending |
| DISPLAY-01 | TBD | Pending |
| DISPLAY-02 | TBD | Pending |
| DISPLAY-03 | TBD | Pending |
| DISPLAY-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 0 (roadmap not yet created)
- Unmapped: 17 ⚠️ (resolved when roadmap lands)

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-04-24 after initial definition*
