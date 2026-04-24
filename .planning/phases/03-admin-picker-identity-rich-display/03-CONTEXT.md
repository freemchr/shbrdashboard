# Phase 3: Admin Picker & Identity-Rich Display - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin UI swaps free-text email entry for a searchable Prime user picker in 3 places (Dashboard Admins input, group member editor, New Group form), and every place a user is shown — picker rows, group/admin lists, audit log — renders Prime name with email as secondary detail, falling back to email-only for entries no longer present in the current Prime directory snapshot. Storage stays email-keyed (VisibilityConfig blob schema unchanged — hard constraint, success criterion #5).

This is a UI-and-display phase. No changes to:
- The VisibilityConfig blob schema (hard constraint)
- The auth flow (Phase 2 already extended `/api/auth/session` and login)
- The Phase 1 directory cache mechanics (on-demand-only refresh per Phase 1 D-01)
- The Prime API surface (no new endpoints called)

Two small in-flight refinements to already-shipped Phase 2 work are folded in:
- Audit filter dropdown gets a `prime_user_miss` option (closes Phase 2 paper cut surfaced during UAT)
- TopBar identity polish (relocate to far-left + User icon prefix) was shipped to main during this discussion as commits 44dbe95 + 27450e9 — included here as post-Phase-2 polish, not Phase 3 scope-creep

</domain>

<decisions>
## Implementation Decisions

### Picker UI shape
- **D-01:** **Inline combobox.** All three picker sites (Dashboard Admins, group member editor, New Group form) replace their current free-text input with an always-visible search field. As the admin types, a dropdown shows matching Prime users filtered across name, email, and division simultaneously (per success criterion #1). Click a result to add. Replaces the existing `adminEmailsRaw` textarea at `app/admin/page.tsx:296` and the equivalent surfaces in the Groups section. Rationale: SHBR has ~30 Prime users — typeahead is faster than scrolling a checkbox list, and the inline form keeps the page density admins are used to. No modal, no popover.
- **D-02:** **Single reusable `<PrimeUserPicker>` component.** All three sites consume one component with props for `multiSelect: boolean`, `selected: string[]` (emails), `onChange`, `placeholder`, `allowHistorical: boolean`. One source of truth for picker behavior, one test surface, one file to evolve. Lives in `components/ui/PrimeUserPicker.tsx` per the kebab-PascalCase convention.
- **D-03:** **Picker dropdown row content:** Prime display name (primary), `division` if present (secondary, dot-separated, hidden when null), email (tertiary, smaller, gray). Matches success criterion #2. Three lines per row in the dropdown.

### Selected-state display
- **D-04:** **Compact name-only chips.** Selected admins / group members render as tight chips with just the name and an `×` to remove. Hover shows division + email tooltip. Compact vertically — fits the existing admin form density. Rationale: a 10-person admin list as detailed rows would push the search field below the fold; chips keep the scan-and-add flow tight.
- **D-05:** **Alphabetical order by display name.** Stable, predictable, easy to scan for a specific person. Re-sorts on add/remove. Insertion order was rejected as harder to scan as the list grows.
- **D-06:** **Identity-rich list rendering** (DISPLAY-01, DISPLAY-02): Group member lists and the Dashboard Admins list (when shown outside the picker context — e.g., on read-only views) render as "Name — Division" with email secondary. When `division` is null, render "Name" with email secondary (no orphan dash). Falls back to email-only for historical entries. The picker chip and the read-only list use the same naming cascade.

### Historical entries (no Prime match)
- **D-07:** **"Historical" really means "not in the current directory snapshot."** Phase 1's cache is on-demand-refresh only (D-01) — an entry can fail to resolve because (a) the user genuinely left and was removed from Prime, OR (b) the cache is stale and the user is actually still there. The picker UI must distinguish these scenarios for the admin.
- **D-08:** **Visual treatment:** historical chips render the email value in italic, muted gray (`text-gray-500`), with tooltip on hover: **"Not in current directory snapshot — refresh to recheck"**. Removable like any other chip. Same `<Chip>` component, just with the historical state styled differently.
- **D-09:** **Position:** historical chips sort alphabetically by their email value into the same list as live name chips. Single visual flow — admin sees them in context. The italic+gray style keeps them recognizable without a section break.
- **D-10:** **Inline refresh hint.** When the selected list contains any historical entries, render a small inline notice below the chip cluster: `"⚠ {N} entr{y/ies} not found in current directory snapshot. Last refresh: {N} {time-unit} ago. [↻ Refresh Prime directory]"`. Clicking the button calls Phase 1's existing `/api/admin/prime-users/refresh` (POST). On success, re-renders with fresh cache state — entries that were stale-misses become live chips. Last-refresh timestamp comes from Phase 1 D-19's `lastSuccessAt` field on the directory blob.

### Audit log actor display (DISPLAY-03)
- **D-11:** **Live-resolve cascade with saved-name fallback.** Audit row actor renders via cascade: `livePrimeUser?.fullName?.trim() → entry.name → entry.email`. Live-resolve uses Phase 1's `resolveByEmail` (synchronous after first cache warm; ~200 lookups per audit table render is negligible). Saved `entry.name` (captured at audit-write time) covers the cold-cache window. Email is the final fallback. This applies to all rows: 'login', 'logout', and 'prime_user_miss'.
- **D-12:** **Email shown as secondary line under the actor name** in the audit table — matches the picker dropdown row pattern (D-03) and gives admins both pieces of identifying info at a glance. When the cascade resolves to email-only (no name match), only one line renders (avoids "email / email" duplication).

### Audit filter dropdown (Phase 2 follow-up, folded in)
- **D-13:** **Audit filter dropdown gets a 'Prime miss' option.** Three small changes in `app/admin/page.tsx` and `app/api/audit/entries/route.ts`:
  1. `ActionFilter` type: `'all' | 'login' | 'logout'` → `'all' | 'login' | 'logout' | 'prime_user_miss'`
  2. `<select>` markup: add `<option value="prime_user_miss">Prime miss</option>` between Login and Logout
  3. `/api/audit/entries` allowlist at line 38: include `'prime_user_miss'` in the filter validation
  Closes a paper cut from Phase 2 (the badge rendered correctly under "All" but couldn't be filtered to). Tiny scope, in the same code we're already touching.

### TopBar identity polish (post-Phase-2, NOT Phase 3 scope)
- **D-14:** **TopBar identity label was relocated to the far-left of the bar and given a User icon prefix during this discussion** (commits `44dbe95`, `27450e9` on main, deployed to prod via Vercel auto-deploy). These were small UI iterations on Phase 2's already-shipped DISPLAY-04 work, not Phase 3 scope. Logged here so the audit trail is clean. No further TopBar changes planned for Phase 3.

### Picker plumbing & data flow
- **D-15:** **New endpoint: `GET /api/admin/prime-users`.** Returns the cached Prime directory as JSON: `{ users: PrimeUser[], lastSuccessAt: string, lastError: string | null }`. Auth-gated by `getSession()` + `isAdminEmail()` (same pattern as Phase 1's refresh endpoint). The picker fetches this once on form mount and filters client-side — at 30 users (~5KB JSON), there is no scenario where server-side per-keystroke filtering wins. Lives in `app/api/admin/prime-users/route.ts` (new file, alongside the existing `/api/admin/prime-users/refresh/route.ts`).
- **D-16:** **One fetch per admin page mount.** All three pickers on the Visibility tab share the same fetched directory list (no duplicate fetches). The picker component accepts the directory as a prop OR reads it from a small React Context provided at the admin page level. Decision: small Context (`PrimeDirectoryContext`) at the admin page root — keeps the component API clean and avoids prop-drilling through the group editor.
- **D-17:** **No live-resolution endpoint for the audit table.** The audit table renders client-side; Phase 1's `resolveByEmail` is server-only (it reads the blob cache). The audit table will read from the same fetched directory list (via the `PrimeDirectoryContext`) and resolve in-memory. This avoids ~200 server round-trips per audit page mount.

### Picker behavior details
- **D-18:** **Search filter:** case-insensitive substring match across `fullName`, `email`, `division` simultaneously. Single search input, single match logic. No advanced filters in this phase.
- **D-19:** **Keyboard navigation:** arrow keys to move through dropdown results, Enter to select, Esc to close, Backspace on empty input to remove the last chip. Standard combobox interactions. Use `aria-activedescendant` for accessibility (the picker is a high-traffic admin surface).
- **D-20:** **Empty cache state in picker:** if `getAllPrimeUsers()` returns `[]` (cache empty AND Prime unreachable), the picker dropdown shows: "Prime directory unavailable. Try refreshing." with a button to call the refresh endpoint. Per Phase 1 D-03, the next call after refresh auto-populates.
- **D-21:** **Loading state:** while fetching `/api/admin/prime-users` for the first time, show a small skeleton (existing `LoadingSpinner` from `components/ui/`) inside the picker container. Don't block the rest of the admin form.

### Migration from current state
- **D-22:** **First-load migration is invisible.** The existing `adminEmailsRaw` textarea state and group `members: string[]` are already email arrays. The new `<PrimeUserPicker>` accepts a `selected: string[]` prop of emails. On first load, each email is matched against the cached directory: matches render as live chips, non-matches render as historical chips. No data migration needed — the schema is already what we want.
- **D-23:** **Save behavior unchanged.** When the admin saves the visibility config, the picker's selected emails are written back to `VisibilityConfig.admins` (or group `members`) as before. The blob schema is identical to today; only the input UI changes. Hard constraint #5 honored.

### Test strategy
- **D-24:** **Continue Vitest harness.** Co-located test files: `components/ui/PrimeUserPicker.test.tsx`, `app/api/admin/prime-users/route.test.ts`. Test targets per area:
  - Picker: filter logic (substring across 3 fields), keyboard nav, chip add/remove, historical detection, empty cache state
  - GET endpoint: auth gating (401/404), response shape, cache-empty behavior
  - Audit display: live-resolve cascade with each fallback path
- **D-25:** **No browser/RSC integration tests in this milestone.** Same model as Phases 1+2 (D-21, D-15). Visual smoke is manual via the preview deploy URL. The picker is the highest-risk visual surface; expect a HUMAN-UAT.md with picker-specific items.

### Claude's Discretion
- Tailwind class composition for chips, dropdown, refresh button — follow the existing admin page visual register (gray-900 panels, gray-700/800 borders, brand-red focus rings)
- Exact placement of the inline refresh hint within the form layout
- Animation/transition choices (or none)
- Empty-search-input dropdown behavior (show all? show recent? show nothing?) — recommend "show all" for a 30-user list
- Exact tooltip implementation (native `title` attribute vs a custom Tooltip component) — recommend native `title` for compactness; no custom tooltip component exists in `components/ui/` yet

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 3 milestone scope
- `.planning/REQUIREMENTS.md` §"Admin UI — User Picker (ADMIN)" — ADMIN-01 through ADMIN-05
- `.planning/REQUIREMENTS.md` §"UI Display (DISPLAY)" — DISPLAY-01 through DISPLAY-03 (DISPLAY-04 was completed in Phase 2)
- `.planning/ROADMAP.md` §"Phase 3" — goal, depends-on, 5 success criteria

### Prior phase contracts (locked)
- `.planning/phases/01-prime-user-directory/01-CONTEXT.md` — Phase 1 directory cache decisions (D-01..D-22). Especially relevant: D-01 (on-demand-only refresh), D-03 (auto-populate on empty cache), D-07 (`getAllPrimeUsers` and `resolveByEmail` API), D-08 (PrimeUser shape), D-19 (cache metadata with `lastSuccessAt`)
- `.planning/phases/02-session-auth-context/02-CONTEXT.md` — Phase 2 session/auth decisions. Especially relevant: D-08 (AuthContext.primeUser shape), D-12 (Phase 2 explicitly does NOT build picker/group/audit display surfaces — that's Phase 3), D-13 (division/region/role policy)

### Hard architectural constraints
- `lib/page-visibility.ts` — VisibilityConfig blob schema (success criterion #5: must NOT change). Read shape at lines 29-38 before any picker save logic.
- `lib/prime-users.ts` — Phase 1 module. `PrimeUser` type at line 34, `getAllPrimeUsers` at line 193, `resolveByEmail` at line 217. No-throw contract per Phase 1 D-16.
- `app/admin/page.tsx` — current admin UI. Visibility tab function at line 129, admin emails textarea at line 296, ActionBadge at line 508, audit filter dropdown at line 587.

### Project-level guidelines
- `./CLAUDE.md` — Prime API budget (60/min, 5000/day), brownfield-aware editing, `lib/page-visibility.ts` admin-fallback known issue, kebab-case lib + PascalCase components, test strategy decided per milestone
- `.planning/PROJECT.md` — milestone goal, core value, current state

### No additional ADRs / external specs for this phase
The decisions in this CONTEXT.md are sufficient; no separate spec doc exists for the picker UI contract.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`components/ui/LoadingSpinner.tsx`** — for picker loading state (D-21)
- **`components/ui/EmptyState.tsx`** — already exists; pattern for the "Prime directory unavailable" state (D-20) — read it to confirm whether to reuse or build a smaller picker-specific empty UI
- **`lib/auth-context.tsx`** — `useAuth()` for the current-user `primeUser` if needed (Phase 2 D-08)
- **`lib/prime-users.ts` `getAllPrimeUsers()` / `resolveByEmail()`** — Phase 1 public API; the new GET endpoint and the audit table both consume these
- **`lib/page-visibility.ts` types** — `VisibilityConfig`, `VisibilityGroup`, `PageRestriction`, `isAdminEmail`

### Established Patterns
- **Admin route auth gating:** `getSession() + isAdminEmail()` returning 401/404. Used by Phase 1's `/api/admin/prime-users/refresh` and `/api/audit/entries`. The new GET endpoint follows the same pattern.
- **Toast feedback:** `app/admin/page.tsx` already has a toast pattern at the top of `VisibilityTab`. Picker save success/failure can hook into the same.
- **`'use client'` page components fetching via `/api/*` routes** (per CLAUDE.md). Picker is client-side; reads from `/api/admin/prime-users` once on mount.
- **Audit log entry shape:** `lib/audit.ts` `AuditEntry` (Phase 2 widened the action union). The Phase 3 display layer reads `entry.email`, `entry.name`, `entry.action` — no schema changes.

### Integration Points
- **`app/admin/page.tsx` `VisibilityTab`** — the function-component that hosts admin emails (line ~283), groups list, new-group form. Phase 3 swaps three sub-sections of this component without restructuring the tab.
- **`app/admin/page.tsx` `AuditTab`** (line 533) — the audit table. Phase 3 wraps actor rendering in a live-resolve cascade and extends the filter dropdown.
- **`PrimeDirectoryContext`** (NEW) — small React Context provider mounted at the admin page root, providing the cached directory + last-refresh state to all three pickers and the audit table.

### Notable
- **No existing typeahead/combobox component** in `components/ui/`. `<PrimeUserPicker>` is the first.
- **No existing chip/tag component**. The picker introduces one (kept inline for now; can be extracted if any other phase needs it).
- **No tooltip component**. Use native `title` attribute for D-08's hover tooltip — sufficient for this phase, accessible by default.

</code_context>

<specifics>
## Specific Ideas

- The mock previews in the AskUserQuestion answers are the visual contract for picker dropdown rows, chips, and the inline refresh hint. The UI researcher / planner can reference them as ASCII spec.
- The user asked specifically about the User icon prefix on the TopBar during this discussion — already shipped (commit 27450e9). Listed here so it doesn't get re-litigated.
- The user asked specifically about the "no Prime match" semantic during this discussion — answered with the directory-drift framing (new hire / stale cache / departed user). The tooltip text and inline refresh hint reflect that framing.

</specifics>

<deferred>
## Deferred Ideas

- **Bulk operations on historical entries** — "Remove all historical entries" button. Discussed implicitly but not chosen; admins remove individually for now. Could be a follow-up if many historicals accumulate.
- **Last-refresh timestamp display elsewhere** — e.g., a global "Prime directory: 5 days old" banner in the admin tab header. Folded into the picker's inline hint for now; a global surface is a follow-up.
- **Auto-refresh on stale cache** — beyond Phase 1's 30-day safety net. Could prompt or auto-refresh when accessing the picker if cache > N days old. Not in this phase.
- **Avatar/photo per Prime user** — Prime API doesn't expose photos; no plan to integrate.
- **Search within audit log** — full-text or per-actor. Audit currently filters by action + date range only. Out of scope for Phase 3.
- **Group "label / name" admin UX** — renaming groups, group descriptions. Existing `VisibilityGroup` shape supports `id` + `label`; no edit UI changes planned.
- **Prime-backed admin badge in TopBar** — Phase 2 D-11 noted "Sidebar implies admin via the Admin nav item." Could revisit in a future polish phase.
- **`/api/prime/jobs/trends` 500 error** — pre-existing endpoint unrelated to Phase 3 scope. Surfaced during Phase 2 UAT. Belongs in a separate triage.
- **Cleaner BLOB_BASE_URL env value** — Phase 2 UAT defensively fixed the trailing-newline issue in code. The env value itself should also be re-saved cleanly. Operational follow-up, not a phase.

</deferred>

---

*Phase: 03-admin-picker-identity-rich-display*
*Context gathered: 2026-04-24*
