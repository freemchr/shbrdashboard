# Phase 3: Admin Picker & Identity-Rich Display - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 03-admin-picker-identity-rich-display
**Areas discussed:** Picker UI shape, Selected-state display, Historical entries, Audit log actor display, Audit filter dropdown (folded), TopBar polish (folded as post-Phase-2 polish)

---

## Picker UI shape

| Option | Description | Selected |
|--------|-------------|----------|
| Inline combobox | Always-visible search input with dropdown of matching Prime users; click to add; selected as chips. Quick scan, no extra clicks. | ✓ |
| Button + modal | Selected list visible; '+ Add admin' opens a modal. More chrome, clearer adding moment. | |
| Searchable list with checkboxes | All Prime users as checkbox list with filter input. Awkward past ~100 users. | |

**User's choice:** Inline combobox
**Rationale:** Best fit for ~30-user directory; matches existing admin form density.

| Option | Description | Selected |
|--------|-------------|----------|
| Single reusable component | One `<PrimeUserPicker>` with props for single/multi-select; consistency across all 3 sites. | ✓ |
| Per-context variants | Three separate components; more flexibility, triple maintenance. | |

**User's choice:** Single reusable component

---

## Selected-state display

| Option | Description | Selected |
|--------|-------------|----------|
| Compact chips with name only | Tight chips (×Name), hover for division+email tooltip. Fits existing form density. | ✓ |
| Detailed rows | Each entry as a row with name + division + email + remove. ~24px per entry. | |
| Hybrid: chip with division | Chip including name AND division as suffix. Wider but more info upfront. | |

**User's choice:** Compact chips with name only

| Option | Description | Selected |
|--------|-------------|----------|
| Alphabetical by name | Stable, predictable, easy to scan; re-sorts on add/remove. | ✓ |
| Insertion order | Shows recent additions; harder to find specific names as list grows. | |

**User's choice:** Alphabetical by name

---

## Historical entries (no Prime match)

| Option | Description | Selected |
|--------|-------------|----------|
| Italic gray + tooltip | Email in italic muted gray, tooltip on hover. Compact signal. | ✓ |
| Explicit 'no Prime' badge | Email in normal style with inline 'no Prime' tag. More explicit, more visual noise. | |
| Same as live entries | No distinction. Simplest; risks admin not noticing stale entries. | |

**User's choice:** Italic gray + tooltip

| Option | Description | Selected |
|--------|-------------|----------|
| Mixed alphabetically with live entries | Single visual flow; italic style keeps them recognizable. | ✓ |
| Grouped at the end | Live first, then a 'Historical:' section. Easier to bulk-clean, adds a section break. | |

**User's choice:** Mixed alphabetically with live entries

### Refinement triggered by user question: "what is the purpose of no prime match?"

User correctly noted that Prime is the auth source — successful login means the user IS in Prime. Discussion clarified that 'no Prime match' really means 'not in the current Phase 1 directory snapshot' (cache is on-demand-refresh per Phase 1 D-01). Three causes: new hire (cache stale), departed user, or cache-empty state. This led to two refinement questions:

| Option | Description | Selected |
|--------|-------------|----------|
| Inline refresh hint when historicals present | Small notice + Refresh button + last-refresh timestamp. Helps distinguish stale cache from departed user. | ✓ |
| No inline hint — refresh in admin tooling only | Less clutter; risks deleting still-Prime users thinking they're departed. | |

**User's choice:** Inline refresh hint when historicals present

| Option | Description | Selected |
|--------|-------------|----------|
| 'Not in current directory snapshot — refresh to recheck' | Accurate to the mechanism; tells admin what to do. | ✓ |
| Keep 'No Prime record — historical entry' | Shorter but slightly misleading. | |

**User's choice:** Updated tooltip text to reflect accurate semantic

---

## Audit log actor display (DISPLAY-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Live-resolve at render with saved-name fallback | Cascade: livePrimeUser?.fullName → entry.name → entry.email. Always-fresh when cache warm; degrades gracefully. ~200 in-memory lookups per render = negligible. | ✓ |
| Saved name only (current behavior) | Use entry.name verbatim, fall back to email. Cheap; can be stale if user renamed. | |
| Live-resolve only, no fallback | Always current Prime name; loses information when user is no longer in Prime. | |

**User's choice:** Live-resolve with saved-name fallback

---

## Audit filter dropdown (Phase 2 follow-up, folded into Phase 3)

| Option | Description | Selected |
|--------|-------------|----------|
| Fold in | Tiny scope addition; closes Phase 2 paper cut while we're in the audit code anyway. | ✓ |
| Defer to a separate UI polish phase | Keep Phase 3 focused; backlog the filter gap. | |

**User's choice:** Fold in

---

## TopBar polish (shipped during this discussion as post-Phase-2 polish)

Two small UI iterations on Phase 2's already-shipped DISPLAY-04 work, requested by user during this discussion. NOT counted as Phase 3 scope:

1. **Relocate identity to far-left of TopBar** — `justify-between` layout, identity on left, weather/date/clock cluster pinned right. Commit `44dbe95` on main, deployed.

2. **User icon prefix** — small `User` icon (lucide-react, 14px, `text-gray-500`) before the name. Matches the existing TopBar visual register where weather has its own icon. Commit `27450e9` on main, deployed.

| User question | Resolution |
|---------------|------------|
| "I am thinking the user could be on the left of that bar rather than next to the weather." | Restructured TopBar with `justify-between`; identity now leftmost in the bar. |
| "Should we have a user next to the name? Like User: or an icon and the name?" | Picked User icon (recommended). 'User:' text prefix and 'name only' both rejected. |

---

## Done check

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context | Write CONTEXT.md with captured decisions + Claude-discretion defaults + canonical refs. | ✓ |
| Discuss more | Surface additional gray areas (New Group form scope, env-var admin emails, accessibility deeper dive, etc.) | |

**User's choice:** Ready for context

## Claude's Discretion

(See CONTEXT.md `<decisions>` § "Claude's Discretion" for the full list — Tailwind class composition, exact placement of inline refresh hint, animation choices, empty-search-input dropdown behavior, tooltip implementation choice.)

## Deferred Ideas

(See CONTEXT.md `<deferred>` for the full list — bulk historical operations, global last-refresh banner, auto-refresh on stale cache, avatar/photo, audit search, group rename UX, Prime-backed admin badge in TopBar, the `/api/prime/jobs/trends` 500 triage, BLOB_BASE_URL env cleanup.)
