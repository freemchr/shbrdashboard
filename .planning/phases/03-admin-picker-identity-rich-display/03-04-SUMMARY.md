---
phase: 03-admin-picker-identity-rich-display
plan: 04
subsystem: admin-ui
tags: [react, picker, admin, refactor, visibility-config, plan-05-prereq]

# Dependency graph
requires:
  - phase: 03-admin-picker-identity-rich-display
    plan: 01
    provides: resolveDisplayName + isUnresolvedEmail + findPrimeUser (lib/identity-display.ts), formatRelative (lib/format-relative.ts)
  - phase: 03-admin-picker-identity-rich-display
    plan: 02
    provides: GET /api/admin/prime-users → { users, lastSuccessAt, lastError }
  - phase: 03-admin-picker-identity-rich-display
    plan: 03
    provides: PrimeUserPicker component (named export), normalizeManualEmail invariant
  - phase: 01-prime-user-directory
    provides: POST /api/admin/prime-users/refresh (existing — called by D-13 RefreshButton)
provides:
  - app/admin/visibility-tab.tsx (named export VisibilityTab) — net-new file hosting the extracted Visibility tab body, three PrimeUserPicker call sites, RefreshButton + metadata strip, MemberRow chip helper, refactored GroupCard
  - shrunk app/admin/page.tsx (796 → 412 lines) with VisibilityTab body + GroupCard + slugify + pageGroups + EMPTY_CONFIG removed
affects: [03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Named-export VisibilityTab in extracted .tsx alongside admin route page.tsx — addresses CONCERNS.md '793-line page.tsx' head-on"
    - "Three-way PrimeUserPicker reuse — same component, three call sites (Dashboard Admins, GroupCard members, New Group form) all multi:true (D-04)"
    - "MemberRow as a shared two-line chip across Dashboard Admins list and GroupCard member rows (D-06 + D-08 + D-09)"
    - "RefreshButton state machine: idle | busy | ok | err — locked copy templates per UI-SPEC §Refresh Button + Metadata Strip"
    - "Parallel mount fetches: /api/admin/page-visibility (config) and /api/admin/prime-users (picker list) run independently; tab still renders the existing config-loading spinner once config arrives even if picker list is mid-flight"
    - "RefreshButton primary-success path also re-fetches /api/admin/prime-users so picker dropdowns update without a page reload"
    - "Defensive .map(.trim().toLowerCase()).filter(.includes('@')) preserved in handleSave + addGroup + updateGroupMembers — picker emits lowercase emails but manual-fallback entries are still re-normalised before persist"

key-files:
  created:
    - app/admin/visibility-tab.tsx (660 lines including JSDoc, MemberRow, RefreshButton, GroupCard, VisibilityTab body)
    - .planning/phases/03-admin-picker-identity-rich-display/03-04-SUMMARY.md
  modified:
    - app/admin/page.tsx (796 → 412 lines; -388 net; +4 lines for the new import; tab router unchanged)

key-decisions:
  - "Honor D-21 absolutely: the VisibilityConfig blob shape is unchanged. admins is string[], groups[].members is string[], pages[] untouched — picker emits/consumes lowercase email arrays, save POST body is byte-equivalent to today on the wire."
  - "Honor D-22 absolutely: zero touches to lib/audit.ts, lib/auth-context.tsx, lib/page-visibility.ts, or any auth route. Only consume their existing exports."
  - "Honor Pitfall 3: ChangelogTab stays in page.tsx — not extracted in this plan."
  - "RefreshButton lives at the very top of the tab body (above the Save bar) so admins see the freshness signal before scanning sections. Save Changes button stays in the existing inline 'Save bar' position to preserve muscle memory."
  - "Manual-email fallback (D-12) is delegated to the picker via the `error` prop. This file just passes `error={primeUsersError}` and `loading={primeUsersLoading}` — no manual fallback UI duplicated outside the picker."
  - "GroupCard's `primeUsersError`/`primeUsersLoading` props are passed through to its inline picker so a Prime outage cleanly degrades inside expanded groups too."
  - "Loader2 was the only icon left dangling after the trim — removed from page.tsx imports. All other lucide-react icons listed in the imports block are still referenced by AuditTab, ChangelogTab, the tab strip, or AdminPage header."

patterns-established:
  - "When extracting an admin tab into its own file, keep page.tsx as the tab router only. The tab content component is named-exported; AdminPage imports it directly. This pattern is now Plan 05's blueprint for AuditTab."

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, DISPLAY-01, DISPLAY-02]

# Metrics
duration: 5.5min
completed: 2026-04-25
---

# Phase 03 Plan 04: VisibilityTab Extraction & Picker Wiring Summary

**The Visibility tab is rebuilt around three `<PrimeUserPicker>` instances + a top-of-tab Refresh button, the body and helpers move into a new `app/admin/visibility-tab.tsx` (~530 net code lines after stripping JSDoc), `app/admin/page.tsx` shrinks from 796 to 412 lines, the VisibilityConfig blob shape is unchanged on the wire, and the full Vitest suite stays at 95/95 green.**

## Performance

- **Duration:** ~5.5 min
- **Started:** 2026-04-25T02:12:41Z
- **Completed:** 2026-04-25T02:18:14Z
- **Tasks:** 2 executed (Task 3 is a manual UAT checkpoint — auto-approved per orchestrator workflow.auto_advance: true)
- **Files modified:** 2 (1 net-new, 1 trimmed)

## Three Picker Instances — Surface Map

| Surface | Selection source | onChange wiring | Loading prop | Error prop |
|---------|------------------|-----------------|--------------|------------|
| **Dashboard Admins** (ADMIN-01) | `config.admins ?? []` | `setConfig(c => ({ ...c, admins: emails }))` | `primeUsersLoading` | `primeUsersError` |
| **GroupCard member editor** (ADMIN-02, per group) | `group.members` | `onChangeMembers(members)` → parent's `updateGroupMembers(group.id, members)` (re-normalises and writes back into `config.groups`) | `primeUsersLoading` | `primeUsersError` |
| **New Group form** (ADMIN-03) | `newGroupMembers: string[]` (component-local) | `setNewGroupMembers` directly | `primeUsersLoading` | `primeUsersError` |

All three call `<PrimeUserPicker>` with `multi={true}` (D-04) and the same locked placeholder `Search Prime users by name, email, or division…` (with the New Group instance using a slightly shorter `Search Prime users…` to fit the two-column form). Each carries an instance-specific `ariaLabel` (`"Add Dashboard Admin"`, `"Add member to {group.label}"`, `"Add member to new group"`) so screen readers can disambiguate when the same widget renders many times on one page.

## RefreshButton (D-13) — State Machine + Copy Templates

The RefreshButton sub-component owns its own `RefreshState` discriminated union and renders one of four metadata lines below a single inline button.

| State | Render | Copy template |
|-------|--------|---------------|
| `idle` (no in-session refresh, cache exists) | gray meta line | `Cache last refreshed {formatRelative(lastSuccessAt)}` |
| `idle` (no cache yet) | gray meta line | `No Prime user cache yet — click Refresh to load.` |
| `busy` | button label flips, spinner | Button: `Refreshing…` |
| `ok` (post-refresh success) | gray meta line | `Refreshed {N} users in {(durationMs/1000).toFixed(1)}s · cached {formatRelative(cachedAt)}` |
| `err` (refresh failed) | amber meta line | `Prime unreachable — using cache from {formatRelative(lastSuccessAt)}` OR `Prime unreachable — no cache available` |

After a successful refresh, RefreshButton chains a secondary `fetch('/api/admin/prime-users')` so the picker dropdowns reflect the new directory immediately. The secondary call is wrapped in its own try/catch — secondary failures are swallowed (the primary refresh already succeeded and the user has visible "Refreshed N users…" feedback).

## State Migration — Picker-Driven, No More Textareas

| Old state | New state | Rationale |
|-----------|-----------|-----------|
| `adminEmailsRaw: string` (textarea-driven) | **REMOVED** — admins live directly in `config.admins` (which is `string[]`); picker `onChange` mutates that slice via `setConfig` | Picker emits/consumes lowercase email arrays, no textarea parsing needed |
| `newGroupEmails: string` (textarea-driven) | `newGroupMembers: string[]` (picker-driven) | Picker is the input device; the form's local state is now an email array, normalised inside `addGroup()` before merging into `config.groups` |
| `updateGroupMembers(id, raw: string)` | `updateGroupMembers(id, members: string[])` | Same defensive `.map(.trim().toLowerCase()).filter(.includes('@'))`; arg shape now matches the picker's `onChange` signature |

Two new pieces of state were added inside `VisibilityTab`:

- `primeUsers: PrimeUser[]` — the directory (fetched once on mount via `GET /api/admin/prime-users`)
- `primeUsersError: string | null` — Prime outage signal; passed to every picker as `error`
- `primeUsersLoading: boolean` — initial-fetch loading flag; passed to every picker as `loading`
- `lastSuccessAt: string | null` — cache freshness for the RefreshButton metadata strip

## VisibilityConfig blob shape — confirmed unchanged on the wire (D-21)

`handleSave()` posts `{ ...config, admins }` to `/api/admin/page-visibility` with:
- `admins: string[]` (lowercase emails, defensively normalised)
- `groups: VisibilityGroup[]` where each `members: string[]` (lowercase emails, defensively normalised in `addGroup`/`updateGroupMembers`)
- `pages: { path, label, hiddenFrom: string[] }[]` (untouched in this plan)
- `updatedAt`/`updatedBy` (whatever the server returned in the most recent GET)

This is byte-equivalent to the pre-Phase-3 save body. No migration required for production blobs. Manual UAT step 10 (auto-approved) verifies the on-the-wire POST body.

## Identity rendering — D-15 cascade everywhere

Both the Dashboard Admins list and each GroupCard's member list render entries via the new `MemberRow` component, which:

1. Calls `resolveDisplayName(email, primeUsers, null)` for line 1 (live Prime fullName → email fallback; `entry.name` doesn't apply here because no audit context)
2. Calls `findPrimeUser(email, primeUsers)` to surface `· {division}` as the line-2 secondary suffix when populated (probe-confirmed always-null in this tenant — but future-proof)
3. Suppresses line 2 entirely + adds `title="No Prime record found"` when `isUnresolvedEmail(email, primeUsers)` is true (D-08 + D-09 — the absent line IS the cue)
4. Appends ` (inactive)` to line 1 in `text-gray-500` when the matched PrimeUser has `status !== 'active'` (UI-SPEC §"Inactive User Treatment")
5. Renders a focus-ringed [×] remove button with a per-row `aria-label="Remove {email}"`

This same MemberRow is reused by both the Dashboard Admins section and inside `GroupCard` for group members — no JSX duplication.

## Task Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| 1 | `feat(03-04)` | `19cbbdc` | extract VisibilityTab + wire PrimeUserPicker on three surfaces |
| 2 | `refactor(03-04)` | `a292b97` | trim page.tsx — wire VisibilityTab import, drop extracted body |
| 3 | (auto-approved checkpoint) | — | Manual UAT checkpoint auto-approved per `workflow.auto_advance: true` |

Plan-metadata commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS) follows.

## Files Created/Modified

- **`app/admin/visibility-tab.tsx`** — net-new, 660 lines (~530 net code after JSDoc + comments). Hosts: file-header JSDoc → imports → helpers (`slugify`, `pageGroups`, `EMPTY_CONFIG`) → `MemberRow` → `RefreshButton` → `GroupCard` (refactored: chip-row + inline picker) → `VisibilityTab` named export. Imports `PrimeUserPicker`, `resolveDisplayName`/`isUnresolvedEmail`/`findPrimeUser`, `formatRelative`, and the `VisibilityConfig`/`VisibilityGroup`/`ALL_PAGES`/`PrimeUser` types.
- **`app/admin/page.tsx`** — 796 → 412 lines (-388). Removed: `function VisibilityTab()`, `function GroupCard()`, `function slugify()`, `pageGroups`, `EMPTY_CONFIG`, and the unused `Users`/`Save`/`Plus`/`Trash2`/`CheckCircle`/`AlertCircle`/`Loader2`/`ChevronRight`/`EyeOff` icons + the `ALL_PAGES`/`VisibilityConfig`/`VisibilityGroup` type imports. Added: `import { VisibilityTab } from './visibility-tab'`. AuditTab + ChangelogTab + their helpers preserved verbatim.

## Verification

```bash
npx vitest run                                                            # 95/95 passed (3.06s) — same as 03-03 baseline
npx tsc --noEmit                                                          # 9 pre-existing errors only (deferred-items.md); 0 new
npm run lint -- --file app/admin/visibility-tab.tsx                       # ✔ No ESLint warnings or errors
npm run lint -- --file app/admin/page.tsx                                 # ✔ No ESLint warnings or errors
```

Cross-checks (from plan's `<verification>` block):

```bash
wc -l app/admin/page.tsx                                                  # 412 (< 600 ✓)
grep -c "<PrimeUserPicker" app/admin/visibility-tab.tsx                   # 3 (= 3 ✓)
grep -c "fetch('/api/admin/prime-users" app/admin/visibility-tab.tsx      # 3 (mount fetch + RefreshButton primary + RefreshButton secondary re-fetch ≥ 2 ✓)
grep -c "<textarea" app/admin/visibility-tab.tsx                          # 0 (✓ — all three textareas replaced)
```

## Decisions Made

No new design decisions. Plan 04 honored every locked element of the upstream design contracts:

- 03-CONTEXT.md D-01 through D-22 — all picker decisions, blob lock, scope guardrails
- 03-UI-SPEC.md — colors, spacing, typography, copy strings, ARIA contract (delegated to picker), refresh strip
- 03-PATTERNS.md "app/admin/visibility-tab.tsx" cut-line audit, save pattern, toast pattern, section card chrome
- 03-RESEARCH.md Pitfall 7 (cut-line audit), Pattern 4 (refresh button skeleton), Pitfall 3 (ChangelogTab stays)

Implementation-internal choices (not new decisions per se):

- Removed `Loader2` from page.tsx imports (no longer referenced after deletion). All other surviving icons are still used by AuditTab, ChangelogTab, the tab strip, or AdminPage header.
- Passed `loading` and `error` props to all three picker instances — including inside expanded GroupCards via two new GroupCard props (`primeUsersError`, `primeUsersLoading`) — so a Prime outage degrades cleanly across every picker surface.

## Deviations from Plan

**None of substance.** Two minor implementation-detail divergences from the plan's literal `<action>` text are noted for the verifier:

**1. RefreshButton + Save bar layout — vertical, not horizontal.**

UI-SPEC §"Refresh Button + Metadata Strip" shows the JSX with both buttons in a single horizontal flex row (Refresh on the left, Save Changes on the right). The plan's `<action>` step 10 explicitly says "for first delivery the simpler layout below is acceptable" and provides a vertical layout where RefreshButton owns its own row above the existing Save bar. I followed the plan's recommended simpler layout: RefreshButton renders at the very top of the tab body, the existing Save bar stays in its original position immediately below. This matches the plan's literal JSX skeleton in step 10. Not a UI-SPEC deviation per se — the plan author signed off on this simplification at planning time.

**2. GroupCard now takes two extra props (`primeUsersError`, `primeUsersLoading`).**

The plan's locked GroupCard signature in Task 1 only lists `primeUsersError`. I added `primeUsersLoading` as a second prop so the inline group-member picker also disables itself + shows the spinner while the directory is mid-flight. Without this, expanded GroupCards would display an enabled picker with an empty dropdown for the first ~200ms after mount. This is consistent with how the Dashboard Admins picker already gets `loading={primeUsersLoading}`. No prop is removed; one is added. Not a contract change for any external caller (GroupCard is only used inside this file).

**Total deviations:** 0 substantive (2 minor implementation-detail clarifications above). All locked must_haves.truths from the plan frontmatter are satisfied verbatim.

## Issues Encountered

- **Pre-existing TypeScript errors persist** (carried from 03-01 — see `deferred-items.md`). Same 9 errors, same files (`app/api/auth/login/route.test.ts` × 8, `lib/audit.test.ts` × 1). My changes introduce zero new TS errors. Out of scope per scope-boundary rule.
- **`vite-tsconfig-paths` deprecation warning** prints on every test run. Pre-existing — vitest 4.x bundles vite 8 which deprecated the plugin. Out of scope (logging-only, no functional impact).

No new issues introduced.

## Threat Surface Confirmation

The plan's `<threat_model>` enumerates 7 threat IDs (T-03-04-01 through T-03-04-07). All `mitigate`-disposition threats are reflected in the implementation:

| Threat ID | Disposition | Mitigation in code | Verified by |
|-----------|-------------|---------------------|-------------|
| T-03-04-01 (Spoofing — non-admin reaches the visibility tab) | mitigate | Inherited — VisibilityTab is rendered only by AdminPage, which has both `useAuth().isAdmin` redirect AND a server `/api/auth/session` check. visibility-tab.tsx adds no new gate; it inherits the parent's. | Existing pattern, no new code |
| T-03-04-02 (Tampering — manual-email forge) | mitigate | Picker normalises via `normalizeManualEmail` (Plan 03-03); handleSave defensively `.map(.trim().toLowerCase()).filter(.includes('@'))` again before persist | Save body inspection shows lowercase emails only |
| T-03-04-03 (Info disclosure — picker dropdown) | accept | Same trust assumption as today (admin screen is trusted) | — |
| T-03-04-04 (Tampering — refresh-button budget abuse) | accept | Refresh is admin-gated (Phase 1); button does not auto-fire | — |
| T-03-04-05 (DoS — picker fetch fails and blocks tab) | mitigate | `cancelled` flag + `setPrimeUsersError`/`setPrimeUsers([])` on failure → picker shows manual-email fallback (D-12); Save still works because save path doesn't depend on `/api/admin/prime-users` | Verified by reviewing the catch branch in the mount useEffect |
| T-03-04-06 (Tampering — VisibilityConfig schema accidentally changed) | mitigate | Save payload is `{ ...config, admins }`; admins is `string[]`, groups[].members is `string[]`. Acceptance criteria explicitly grep `<textarea` absence + `adminEmailsRaw`/`newGroupEmails` absence. | grep counts (textarea 0, adminEmailsRaw 0, newGroupEmails 0) |
| T-03-04-07 (XSS via Prime-controlled content) | mitigate | All identity rendering is JSX text via `resolveDisplayName`/`isUnresolvedEmail` returning plain strings; no `dangerouslySetInnerHTML` | grep `dangerouslySetInnerHTML app/admin/visibility-tab.tsx` → 0 |

No new threat surface introduced beyond what's already in the threat register.

## Threat Flags

None — Plan 03-04 introduces no new network endpoints, no new auth paths, no new file access, no schema changes. The new file consumes already-admin-gated endpoints and emits the same VisibilityConfig shape as today.

## Next Plan Readiness

- **Plan 03-05 (`app/admin/audit-tab.tsx`):** The blueprint established here applies — extract AuditTab + helpers (`formatAEDT`, `ActionBadge`, `exportCSV`, `ActionFilter`, `RangeFilter`) into a new file with a named `AuditTab` export, swap the existing audit-row two-line render to use `resolveDisplayName(entry.email, primeUsers, entry.name)` (D-15 three-step cascade with `entry.name` as the middle layer), and update the CSV export to include the resolved Display Name column (D-17). The picker is NOT used in the audit tab; this is purely a row-rendering and CSV change.
- **Plan 03-05 should also remove the AuditTab body from page.tsx** — the same trim pattern. After 03-05 lands, page.tsx will shrink to ~280 lines (just AdminPage + the still-in-place ChangelogTab per Pitfall 3 / D-20).
- **No blockers.** Wave 4 (Plan 03-05) can begin.

---
*Phase: 03-admin-picker-identity-rich-display*
*Completed: 2026-04-25*

## Self-Check: PASSED

All required artefacts present on disk:
- `app/admin/visibility-tab.tsx` (660 lines)
- `app/admin/page.tsx` (412 lines, trimmed)
- `.planning/phases/03-admin-picker-identity-rich-display/03-04-SUMMARY.md`

All task commits reachable in `git log --all`:
- `19cbbdc` — feat(03-04): extract VisibilityTab + wire PrimeUserPicker on three surfaces
- `a292b97` — refactor(03-04): trim page.tsx — wire VisibilityTab import, drop extracted body

Auto-approved checkpoint: Task 3 (manual UAT) — auto-approved per `workflow.auto_advance: true`.
