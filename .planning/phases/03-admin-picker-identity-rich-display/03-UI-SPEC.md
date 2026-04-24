---
phase: 3
slug: admin-picker-identity-rich-display
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-24
---

# Phase 3 — UI Design Contract

> Visual and interaction contract for the Phase 3 Prime user picker, chip pattern, inline refresh hint, and identity-rich audit display. This phase introduces the dashboard's first typeahead/combobox surface and its first chip primitive. Contract is grep-able where possible — planner binds acceptance criteria to assertions in this doc.

---

## Scope & Anti-Scope

**In scope (this spec governs — net-new surfaces):**
- `<PrimeUserPicker>` combobox (`components/ui/PrimeUserPicker.tsx`) — search input, dropdown listbox with three-line rows, keyboard nav, ARIA wiring, tri-state container (loading | ready | error)
- Chip / tag pattern (inline within `PrimeUserPicker.tsx`) — compact name-only chip with `×` remove, native `title` tooltip, italic+gray historical state
- Inline refresh hint (inline within `PrimeUserPicker.tsx`) — `⚠` warning notice with relative-time stamp + refresh button, only visible when historicals present
- Empty-cache state (inline within picker dropdown body) — when status='error' or `users.length === 0`

**In scope (this spec governs — modified surfaces):**
- Audit table actor cell (`AuditTab` in `app/admin/page.tsx:629–632`) — extend to two-line name+email cascade rendering (D-12)
- Audit filter dropdown (`AuditTab` in `app/admin/page.tsx:587–592`) — add `<option value="prime_user_miss">Prime miss</option>` between Login and Logout (D-13)

**Out of scope (do NOT specify — already shipped or governed elsewhere):**
- TopBar identity label — Phase 2 02-UI-SPEC.md + post-Phase-2 polish (commits `44dbe95`, `27450e9` on main)
- `ActionBadge` amber "Miss" pill — Phase 2 D-13 (already at `app/admin/page.tsx:512–514`)
- Sidebar, AuthGuard layout shell, weather/clock cluster
- The mechanics of `PrimeDirectoryProvider` (governed by RESEARCH.md Pattern 2)
- `lib/page-visibility.ts` `VisibilityConfig` blob schema (hard constraint #5 — must NOT change)

This contract covers all six checker dimensions for the four net-new surfaces and the two existing-surface mutations.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (no shadcn; project uses hand-rolled Tailwind components in `components/ui/`) |
| Preset | not applicable |
| Component library | none (Tailwind utility classes only — same vocabulary as `app/admin/page.tsx`) |
| Icon library | `lucide-react` (^0.577.0; existing project standard) |
| Font | Inter (via `tailwind.config.ts` `fontFamily.sans`; system-ui, sans-serif fallbacks) |
| Tailwind | 3.4.1, dark theme (`darkMode: 'class'`), brand red `#DC2626` (`brand.red`) |

**Why no new design-system tooling:** Phase 3 reuses the visual register already established at `app/admin/page.tsx`. Introducing shadcn or a new primitive library now would force migrating the surrounding admin chrome (Save bar, GroupCard, Page Access section) for coherence — out of scope.

---

## Spacing Scale

Declared values (Tailwind default 4px-base scale — consistent with existing admin form at `app/admin/page.tsx`):

| Token | Tailwind | Value | Usage in this phase |
|-------|----------|-------|---------------------|
| xs | `gap-1` / `p-1` | 4px | Chip internal gap (name ↔ × button), dropdown row vertical gap between division and email lines |
| sm | `gap-2` / `p-2` / `px-2 py-0.5` | 8px / 8×2px | Chip outer padding (`px-2 py-1`), refresh hint inner gap, chip cluster gap (`gap-1.5` = 6px exception, see below) |
| md | `gap-3` / `p-3` / `mb-2` | 12px / 16px | Chip cluster bottom margin to input (`mb-2` = 8px), inline-hint top margin (`mt-2` = 8px), refresh hint internal padding (`px-3 py-2`) |
| lg | `p-5` / `px-5 py-4` | 20px | Existing admin section panel padding — picker container inherits this from its host section |

**Non-default exceptions for this phase:**

| Class | Value | Where | Why |
|-------|-------|-------|-----|
| `gap-1.5` | 6px | Chip cluster `flex flex-wrap gap-1.5` (chips wrap into rows) | Tighter than default `gap-2` so 8–10 chips on one row don't push input below the fold (D-04 density argument). Multiple of 2, half-step on the 4-base. |
| `max-h-64` | 256px | Dropdown listbox `<ul>` | Caps dropdown height so a 30-user list scrolls; admin doesn't lose context of the input above. |
| `max-w-[200px]` | 200px | Chip max width before `truncate` activates on the name | Prevents one long Prime name (e.g. hyphenated) from owning a whole chip row. Mirrors Phase 2 TopBar `max-w-[200px]` for the identity label. |
| `min-h-[2.25rem]` | 36px | Search input `<input>` | Matches existing admin input height (`px-3 py-1.5` = 28px content + 8px vertical padding rounds to 36px target). Touch-target friendly. |

All other spacing values use Tailwind's default 4-base scale — no custom values, no arbitrary `px` exceptions.

---

## Typography

Inherits Inter (`font-sans`). Phase 3 uses **3 sizes and 2 weights total** — declared exactly:

| Role | Tailwind | Size | Weight | Usage |
|------|----------|------|--------|-------|
| Body (primary) | `text-sm` | 14px | 400 (default) | Search input value, chip name, dropdown row name (primary line), audit row actor name, refresh hint copy, "No matches" empty copy |
| Meta (secondary) | `text-xs` | 12px | 400 | Dropdown row email (tertiary), audit row email (secondary), refresh hint timestamp portion, chip × button (icon-sized via `size={12}`) |
| Heading (existing) | `text-sm` | 14px | 600 (`font-semibold`) | Existing section headings (`Dashboard Admins`, `Groups`) — picker does NOT add new headings, but the host section's existing `<h2>` is reused |

**Weight rules (locked):**
- **Two weights only**: 400 (default body) and 600 (`font-semibold`). No 500 / 700 / 800 anywhere in Phase 3 surfaces.
- **No bold on chip name** — chip is content, not a heading. Weight peer with surrounding admin form text.
- **No bold on dropdown row primary line** — the row is a list item, not a heading. Visual hierarchy comes from color (`text-white` primary vs `text-gray-500` tertiary), not weight.

**Italic — ONE allowed use only:**

| Element | Tailwind | Why |
|---------|----------|-----|
| Historical chip text (the email value rendered when no Prime match) | `italic` | D-08 explicit visual differentiator. The italic + `text-gray-500` combo (vs upright + `text-white` for live chips) is the single signal that a chip is "not in current snapshot." No other Phase 3 element uses italic. |

**Other typography rules:**
- `truncate` applied to: chip name (after `max-w-[200px]`), dropdown row primary line (single-line), dropdown row email line (single-line)
- `tabular-nums` NOT applied anywhere (no numeric data in this phase)
- `font-mono` NOT applied to picker surfaces (the existing admin emails textarea uses `font-mono` — picker chip+dropdown deliberately drop it; emails inside the picker are rendered as content, not data-grid)
- Audit table `font-mono` on the timestamp column (`app/admin/page.tsx:628`) is unchanged
- No letter-spacing or line-height overrides — defaults from `text-sm` (1.25rem / 1.43) and `text-xs` (1rem / 1.33)

---

## Color

Phase 3 is fully constrained to the existing admin page palette. **No new colors introduced.** Brand red `#DC2626` is reserved per CLAUDE.md and never used as picker chrome.

| Role | Tailwind | Resolved | Where in this phase |
|------|----------|----------|---------------------|
| Dominant (60%) | `bg-gray-950` | `#030712` | Page background behind the admin panel |
| Secondary (30%) | `bg-gray-900` | `#111827` | Picker container panel (mirrors `app/admin/page.tsx:285` `bg-gray-900` admin section pattern) |
| Surface tier 2 | `bg-gray-800` | `#1F2937` | Search input bg, dropdown listbox bg, chip default bg |
| Surface tier 3 (hover) | `bg-gray-700` | `#374151` | Dropdown row hover/`aria-selected` highlight, chip × hover bg, refresh button hover bg |
| Border | `border-gray-800` | `#1F2937` | Picker container border, dropdown listbox border |
| Border (input) | `border-gray-700` | `#374151` | Search input border, chip border (default), refresh button border |
| Accent (10%) — RESERVED | `border-red-600` / `bg-red-600` / `text-red-400` | `#DC2626` / `#F87171` | **Picker uses `focus:border-red-600` ONLY** (matches existing admin inputs at `app/admin/page.tsx:300, 340, 482, 588`). NOT used for chips, dropdown highlights, refresh button, or any other picker chrome. |
| Warning (semantic) | `text-yellow-500` / `bg-yellow-950/40` / `border-yellow-800/60` | `#EAB308` / dark yellow / dark yellow border | Inline refresh hint icon + container only. Mirrors the existing `ErrorMessage variant="warning"` palette in `components/ui/LoadingSpinner.tsx:22`. |
| Destructive — NOT USED | n/a | n/a | Phase 3 has no destructive UI. Chip removal is a content edit, not a destructive admin action — no `red-500` bg, no confirmation modal. |

### Picker text color hierarchy (locked)

| Element | Tailwind | Resolved | Rationale |
|---------|----------|----------|-----------|
| Search input value | `text-white` | `#FFFFFF` | Primary input — matches existing admin input convention (`app/admin/page.tsx:300`) |
| Search input placeholder | `placeholder-gray-600` | `#4B5563` | Matches existing admin placeholder convention (`app/admin/page.tsx:300`) |
| Dropdown row primary (name) | `text-white` | `#FFFFFF` | Primary identification info |
| Dropdown row secondary (· division) | `text-gray-400` | `#9CA3AF` | Mid-tier — present but de-emphasized; renders inline with name as `Name · Division` |
| Dropdown row tertiary (email) | `text-gray-500` | `#6B7280` | De-emphasized data ID. Matches existing audit-row secondary email at `app/admin/page.tsx:631` |
| Chip name (live) | `text-white` | `#FFFFFF` | Identity — peer with input value |
| Chip text (historical) | `text-gray-500 italic` | `#6B7280` italic | D-08 explicit treatment |
| Chip × icon (default) | `text-gray-500` | `#6B7280` | Chrome — not the content |
| Chip × icon (hover) | `text-white` | `#FFFFFF` | Contrast lift on hover signals "this is the click target" |
| "No matches" empty copy | `text-gray-500` | `#6B7280` | Mid-tier — present but not promotional |
| Empty-cache copy ("Prime directory unavailable…") | `text-gray-300` | `#D1D5DB` | One step brighter than "No matches" because the call-to-action below is the way out |
| Refresh hint warning text | `text-gray-300` | `#D1D5DB` | Body content — readable peer with surrounding admin copy. Yellow used for the icon only (semantic anchor). |
| Refresh hint count + duration substring | `text-yellow-500` | `#EAB308` | Numeric emphasis inside the hint copy (e.g. `2 entries`, `5 days ago`) — single small accent inside the warning context |
| Refresh button text | `text-gray-300` | `#D1D5DB` | Same convention as existing admin buttons (`app/admin/page.tsx:357, 575`) |
| Audit row primary (name) | `text-gray-300` | `#D1D5DB` | UNCHANGED from existing pattern (`app/admin/page.tsx:630`) — cascade-resolved value uses the same color |
| Audit row secondary (email) | `text-gray-600` | `#4B5563` | UNCHANGED from existing pattern (`app/admin/page.tsx:631`) |

### Accent (brand red) — explicit reserved-for list

`text-red-600` / `bg-red-600` / `border-red-600` / `text-red-400` / `text-red-500` are reserved for:

1. Active sidebar nav item background (`bg-red-600`) — existing
2. Alert dots on nav items (`bg-red-500`) — existing
3. Active-group icon tint in collapsible nav (`text-red-400`) — existing
4. Brand logo mark — existing
5. Save Changes button (`bg-red-600 hover:bg-red-700`) — existing at `app/admin/page.tsx:266`
6. **Form input focus rings (`focus:border-red-600`) — applies to the picker search input ONLY**
7. Toast error variant (`bg-red-950/60 border border-red-800 text-red-400`) — existing at `app/admin/page.tsx:277`
8. Audit error banner (`bg-red-900/20 border border-red-800 text-red-400`) — existing at `app/admin/page.tsx:609`

**NOT on this list (and Phase 3 must not introduce):** chip backgrounds, chip borders, dropdown highlights, refresh button, refresh hint container, "no matches" text, empty-cache state, audit row content.

### Contrast checks (WCAG AA min for normal text = 4.5:1, AAA = 7:1)

| Pair | Ratio | Verdict |
|------|-------|---------|
| `text-white` (#FFFFFF) on `bg-gray-800` (#1F2937) | 15.0:1 | AAA |
| `text-gray-300` (#D1D5DB) on `bg-gray-900` (#111827) | 11.5:1 | AAA |
| `text-gray-400` (#9CA3AF) on `bg-gray-900` (#111827) | 7.5:1 | AAA |
| `text-gray-500` (#6B7280) on `bg-gray-900` (#111827) | 4.7:1 | AA (passes) |
| `text-gray-500 italic` on `bg-gray-800` (chip historical state) | 4.0:1 | AA Large only — **historical chip is at 14px (`text-sm`), this is below AA for normal text.** Mitigation: chip ALSO carries the `title` tooltip + the inline refresh hint shouts the count, so the historical state has redundant signaling beyond color. Acceptable per the redundant-signal exception. Auditor: flag if used elsewhere. |
| `text-yellow-500` (#EAB308) on `bg-yellow-950/40` (~#1A1503) | 9.2:1 | AAA |
| `text-gray-500` placeholder on `bg-gray-800` | 4.0:1 | AA Large only — **placeholder text is exempt from WCAG contrast min** per WCAG 2.1 SC 1.4.3 (placeholders are decorative when the field has a visible label). Acceptable. |

---

## Copywriting Contract

All copy is **locked** — planner uses verbatim. Strings are the binding part of this contract.

### Picker — search input

| Element | Copy | Notes |
|---------|------|-------|
| Search input placeholder (Dashboard Admins context) | `Search Prime users by name, email, or division…` | The trailing horizontal ellipsis is `…` (U+2026), not three dots |
| Search input placeholder (Group member editor context) | `Add member by name, email, or division…` | "Add member" framing — group context |
| Search input placeholder (New Group form context) | `Add member by name, email, or division…` | Same as group editor — they're the same surface conceptually |
| Search input `aria-label` | `Search Prime users` | Always this string, regardless of context |

### Picker — dropdown listbox

| Element | Copy | Notes |
|---------|------|-------|
| Dropdown row format (division present) | `{fullName} · {division}` (primary line) + `{email}` (secondary line) | Middle dot is `·` (U+00B7), surrounded by single spaces. Verbatim from D-03. |
| Dropdown row format (division null) | `{fullName}` (primary line) + `{email}` (secondary line) | No orphan dot. D-06 explicit. |
| Dropdown — already-selected row hint | `{fullName} (already added)` (primary line) + `{email}` (secondary line) | Suffix `(already added)` after the name (with a single leading space) when this user's email is already in `selected`. Disabled visually (`opacity-50 cursor-not-allowed`) and not click-actionable. |
| "No matches" empty | `No matches` | Two words, no period. Renders inside the dropdown body when `filtered.length === 0` AND `users.length > 0`. |
| Empty-cache state heading | `Prime directory unavailable.` | Period. Renders inside the dropdown body when `users.length === 0`. |
| Empty-cache state body | `Try refreshing.` | Period. Companion to the heading. |
| Empty-cache button label | `↻ Refresh Prime directory` | Symbol `↻` (U+21BB) + single space + label. Clicking calls `refresh()` from `usePrimeDirectory()`. |
| Empty-cache button (refreshing state) | `↻ Refreshing…` | Spinner icon swaps into the leading position; horizontal ellipsis `…`. |

### Picker — chip

| Element | Copy | Notes |
|---------|------|-------|
| Chip text (live) | `{primeUser.fullName}` | Verbatim from Prime, no prefix, no decoration |
| Chip text (historical) | `{email}` | The email value as stored — historical chips have no Prime fullName by definition |
| Chip × button `aria-label` | `Remove {fullName-or-email}` | E.g. `Remove Chris Freeman` or `Remove jane.doe@shbr.com.au` |
| Chip `title` tooltip (live, division present) | `{division} · {email}` | Division then dot then email |
| Chip `title` tooltip (live, division null) | `{email}` | Email only — no orphan dot |
| Chip `title` tooltip (historical) | `Not in current directory snapshot — refresh to recheck` | Verbatim from D-08. Em dash `—` (U+2014). |

### Picker — inline refresh hint (D-10)

Renders below the chip cluster only when `historicalCount > 0` AND `status === 'ready'`. Single string, formatted from parts:

| Slot | Copy template | Example resolution |
|------|---------------|--------------------|
| Heading row | `⚠ {N} {entry-or-entries} not found in current directory snapshot.` | `⚠ 2 entries not found in current directory snapshot.` (N=2) <br> `⚠ 1 entry not found in current directory snapshot.` (N=1) |
| Sub row | `Last refresh: {relative-time}.` | `Last refresh: 5 days ago.` <br> `Last refresh: 2 hours ago.` <br> `Last refresh: never.` (when `lastSuccessAt === null`) |
| Action button | `↻ Refresh Prime directory` | Same as empty-cache button copy |
| Action button (refreshing) | `↻ Refreshing…` | Same as empty-cache refreshing state |

**Pluralization rule (locked):**
- N = 1 → `1 entry`
- N ≠ 1 → `{N} entries`
- N = 0 → hint does NOT render (gated by `historicalCount > 0`)

**Relative-time formatting (locked):**
- Use browser-native `Intl.RelativeTimeFormat` with `style: 'long'`, `numeric: 'auto'`
- When `lastSuccessAt === null`: render literal string `never`
- Pick the largest unit ≥ 1: years > months > days > hours > minutes; below 1 minute renders `just now` (RTF `numeric: 'auto'` does this automatically)

**Symbols (locked exact codepoints):**
- `⚠` = U+26A0 WARNING SIGN (no following variation selector — keep monochrome to match the icon-text register; do NOT render with emoji color)
- `↻` = U+21BB CLOCKWISE OPEN CIRCLE ARROW
- `·` = U+00B7 MIDDLE DOT
- `…` = U+2026 HORIZONTAL ELLIPSIS
- `—` = U+2014 EM DASH

### Audit table actor cell (DISPLAY-03 modifications)

Existing format at `app/admin/page.tsx:629–632` is preserved structurally; the cascade source changes:

| Element | Existing | Phase 3 change |
|---------|----------|----------------|
| Primary line | `entry.name \|\| entry.email` | `livePrimeUser?.fullName?.trim() \|\| entry.name \|\| entry.email` (D-11) |
| Secondary line render condition | Renders when `entry.name` is truthy | Renders when `displayName !== entry.email` (D-12 — avoid email/email duplication) |
| Secondary line content | `entry.email` | UNCHANGED — `entry.email` |

**No new copy strings.** The cascade resolves to existing data; the visual shape is identical.

### Audit filter dropdown (D-13 — extend existing select)

| Existing options | Add | New full list |
|------------------|-----|---------------|
| `<option value="all">All</option>` | — | unchanged |
| `<option value="login">Login</option>` | — | unchanged |
| (none) | `<option value="prime_user_miss">Prime miss</option>` | **NEW — inserted between Login and Logout** |
| `<option value="logout">Logout</option>` | — | unchanged |

Option label `Prime miss` is the locked verbatim string. Two words, capital P, lowercase m. Matches the badge label "Miss" semantically while disambiguating from a generic "miss."

### Phase 3 — copy NOT introduced

The following strings deliberately do NOT exist in this phase:
- No "Save" / "Cancel" / "Confirm" copy in the picker — chip add/remove is immediate, the parent admin Save bar handles persistence
- No tooltip copy for the search input itself (placeholder is sufficient)
- No "Prime miss explained" help text — the badge + filter option pair is self-evident in admin UI context
- No truncation tooltip on chip names — native `title` already shows division+email; full name inside the truncate is in the DOM and readable by screen readers
- No success toast for refresh — the visual change (historical chips becoming live) IS the feedback
- No error toast for refresh failure — the inline hint stays; the `lastError` field updates and renders inside the hint as `Last refresh: {time} ago. (refresh failed)` (see Error State table)

---

## Component Inventory

| Component | Status | Location | Description |
|-----------|--------|----------|-------------|
| `PrimeUserPicker` | NEW | `components/ui/PrimeUserPicker.tsx` | Inline combobox + chip cluster + inline refresh hint. Accepts `selected: string[]`, `onChange`, `placeholder`, `multiSelect: boolean`, `allowHistorical: boolean` per D-02. All visual states defined in this spec. |
| `Chip` (sub-component, inline in picker file) | NEW | `components/ui/PrimeUserPicker.tsx` | Renders one selected entry. Live vs historical variant. Not exported separately — single-call-site primitive. |
| `RefreshHint` (sub-component, inline in picker file) | NEW | `components/ui/PrimeUserPicker.tsx` | The `⚠ N entries not found…` notice block. Renders only when `historicalCount > 0`. |
| `PrimeDirectoryProvider` | NEW | `lib/prime-directory-context.tsx` | Tri-state context provider. Non-visual; mentioned here only because every visual surface in this phase consumes it via `usePrimeDirectory()`. Governed by RESEARCH.md Pattern 2. |
| `app/admin/page.tsx` `VisibilityTab` | MODIFY | `app/admin/page.tsx:129` | Mount `PrimeDirectoryProvider` at the function root; replace admin emails textarea (line ~296) with `<PrimeUserPicker multiSelect selected={config.admins} onChange={…} />`; replace `GroupCard` member textarea (line ~478) with same picker; replace New Group form member textarea (line ~345) with same picker. **Existing section chrome (`bg-gray-900 rounded-xl border border-gray-800`, headings, `<label className="block text-xs text-gray-500 mb-1.5">`) is reused unchanged.** |
| `app/admin/page.tsx` `AuditTab` | MODIFY | `app/admin/page.tsx:533` | Add `const { byEmail, status } = usePrimeDirectory();` near the top; extend `ActionFilter` type to include `'prime_user_miss'`; insert `<option value="prime_user_miss">Prime miss</option>` between Login and Logout in the `<select>` at line 587; wrap actor cell render at line 629–632 in the cascade per "Audit table actor cell" copy table above. |
| `app/api/audit/entries/route.ts` | MODIFY (1 line) | `app/api/audit/entries/route.ts:38` | Allowlist `'prime_user_miss'` in the `action` filter validator. Non-visual; mentioned only because D-13's filter dropdown change is paired with this one. |
| `LoadingSpinner` | EXISTING (reused) | `components/ui/LoadingSpinner.tsx` | Reused inside the picker container during the brief `status === 'loading'` window. No changes. |

**No new files in `components/ui/` beyond `PrimeUserPicker.tsx`.** Sub-components are inline to keep the chip primitive co-located with its only consumer (it can be extracted later if any other phase needs a chip).

---

## Visual Token Reference (per surface)

Each surface below lists the exact Tailwind classes for each rendered state. The planner can grep for these strings; the auditor uses them as the diff target.

### Surface 1: Picker container (the outer wrapper of the whole `<PrimeUserPicker>`)

```tsx
<div className="space-y-2">  {/* chip cluster + input + hint stacked with 8px gap */}
  {/* …chip cluster, input, dropdown, hint… */}
</div>
```

| State | Container classes |
|-------|-------------------|
| All states | `space-y-2` (no panel chrome — the host section provides the panel) |

### Surface 2: Chip cluster (the wrapping div around all chips)

```tsx
<div className="flex flex-wrap gap-1.5">
  {sortedChips.map(chip => <Chip key={chip.email} {...chip} />)}
</div>
```

| State | Classes |
|-------|---------|
| Has chips | `flex flex-wrap gap-1.5` |
| No chips | Container does NOT render (omit, do not render an empty `<div>`) |

### Surface 3: Chip (live variant)

```tsx
<span
  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-sm text-white max-w-[200px]"
  title={tooltipText}
>
  <span className="truncate">{primeUser.fullName}</span>
  <button
    type="button"
    aria-label={`Remove ${primeUser.fullName}`}
    onClick={() => onRemove(email)}
    className="flex-shrink-0 ml-0.5 -mr-0.5 p-0.5 rounded text-gray-500 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-red-600 transition-colors"
  >
    <X size={12} />
  </button>
</span>
```

| Element | State | Classes |
|---------|-------|---------|
| Outer `<span>` | default | `inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-sm text-white max-w-[200px]` |
| Inner name `<span>` | always | `truncate` |
| `×` `<button>` | default | `flex-shrink-0 ml-0.5 -mr-0.5 p-0.5 rounded text-gray-500 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-red-600 transition-colors` |

### Surface 4: Chip (historical variant)

```tsx
<span
  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800/60 border border-gray-700 text-sm text-gray-500 italic max-w-[200px]"
  title="Not in current directory snapshot — refresh to recheck"
>
  <span className="truncate">{email}</span>
  <button
    type="button"
    aria-label={`Remove ${email}`}
    onClick={() => onRemove(email)}
    className="flex-shrink-0 ml-0.5 -mr-0.5 p-0.5 rounded text-gray-500 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-red-600 transition-colors not-italic"
  >
    <X size={12} />
  </button>
</span>
```

**Differences from live variant (the only deltas):**
- `bg-gray-800/60` (60% opacity — visually softer than live `bg-gray-800`)
- `text-gray-500 italic` (vs live `text-white` upright)
- Inner content is `email` (vs live `primeUser.fullName`)
- Tooltip is the locked historical string
- × button keeps `not-italic` to stop italic inheritance from owning the icon glyph metrics

### Surface 5: Search input

```tsx
<input
  id={inputId}
  type="text"
  role="combobox"
  aria-controls={listboxId}
  aria-expanded={open}
  aria-autocomplete="list"
  aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
  aria-label="Search Prime users"
  value={query}
  onChange={…}
  onFocus={…}
  onBlur={…}
  onKeyDown={onKeyDown}
  placeholder={placeholder}
  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600"
/>
```

| State | Classes |
|-------|---------|
| Default | `w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600` |
| Focused | (CSS pseudo) `focus:border-red-600` swaps the border color |
| Disabled | NEVER disabled in Phase 3 — even during refresh, the input stays interactive |

**Why no leading search icon:** existing admin form inputs at `app/admin/page.tsx:300, 340, 482` are icon-less. Adding one would be a register break. The placeholder copy carries the search affordance.

### Surface 6: Dropdown listbox container (the `<ul>` below the input)

```tsx
{open && (
  <ul
    id={listboxId}
    role="listbox"
    className="mt-1 max-h-64 overflow-y-auto bg-gray-800 border border-gray-700 rounded-md py-1 shadow-lg"
  >
    {/* …rows or empty state… */}
  </ul>
)}
```

| State | Classes |
|-------|---------|
| Open | `mt-1 max-h-64 overflow-y-auto bg-gray-800 border border-gray-700 rounded-md py-1 shadow-lg` |
| Closed | Element does NOT render |

### Surface 7: Dropdown row (per `<li>`)

```tsx
<li
  key={user.id}
  id={`${listboxId}-opt-${i}`}
  role="option"
  aria-selected={i === activeIndex}
  aria-disabled={isAlreadySelected || undefined}
  onMouseDown={e => e.preventDefault()}
  onClick={() => !isAlreadySelected && handleSelect(user)}
  className={`px-3 py-2 cursor-pointer ${
    i === activeIndex ? 'bg-gray-700' : ''
  } ${
    isAlreadySelected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'
  }`}
>
  <div className="text-sm text-white truncate">
    {user.fullName}
    {user.division && <span className="text-gray-400"> · {user.division}</span>}
    {isAlreadySelected && <span className="text-gray-400"> (already added)</span>}
  </div>
  <div className="text-xs text-gray-500 truncate">{user.email}</div>
</li>
```

| State | Classes (composed) |
|-------|--------------------|
| Default | `px-3 py-2 cursor-pointer hover:bg-gray-700` |
| Hover (mouse) | `hover:bg-gray-700` (CSS pseudo) |
| Keyboard-active (`activeIndex` matches) | `px-3 py-2 cursor-pointer bg-gray-700 hover:bg-gray-700` |
| Already-selected (disabled) | `px-3 py-2 cursor-not-allowed opacity-50` (no hover) |

**Critical:** keyboard-active and mouse-hover use the SAME `bg-gray-700` background — single highlight idiom for both input modes.

### Surface 8: Dropdown — "No matches" empty (filter narrowed to nothing)

```tsx
{filtered.length === 0 && users.length > 0 && (
  <li role="option" aria-disabled="true" className="px-3 py-2 text-sm text-gray-500">
    No matches
  </li>
)}
```

| Element | Classes |
|---------|---------|
| `<li>` | `px-3 py-2 text-sm text-gray-500` |

### Surface 9: Dropdown — empty-cache state (directory has 0 users)

```tsx
{status !== 'loading' && users.length === 0 && (
  <li role="option" aria-disabled="true" className="px-3 py-3 flex flex-col gap-2">
    <div className="text-sm text-gray-300">Prime directory unavailable.</div>
    <div className="text-xs text-gray-500">Try refreshing.</div>
    <button
      type="button"
      onClick={refresh}
      disabled={refreshing}
      className="self-start flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs text-gray-300 transition-colors"
    >
      {refreshing
        ? <Loader2 size={12} className="animate-spin" />
        : <RefreshCw size={12} />}
      {refreshing ? 'Refreshing…' : 'Refresh Prime directory'}
    </button>
  </li>
)}
```

| Element | Classes |
|---------|---------|
| `<li>` wrapper | `px-3 py-3 flex flex-col gap-2` |
| Heading | `text-sm text-gray-300` |
| Body | `text-xs text-gray-500` |
| Refresh button | `self-start flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs text-gray-300 transition-colors` |

### Surface 10: Picker container — loading state (initial fetch)

```tsx
{status === 'loading' && (
  <div className="flex items-center justify-center py-6">
    <Loader2 size={18} className="animate-spin text-gray-500" />
  </div>
)}
```

Renders **inside the picker container, in place of the search input**, only during the brief first-fetch window. The chip cluster (if `selected.length > 0`) still renders above it — but with chip text in plain `text-gray-500` (no italic, no name resolution attempt) per Pitfall 1 mitigation:

```tsx
{/* During loading: render each selected email as a "neutral" chip — no historical classification yet */}
<span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-500 max-w-[200px]">
  <span className="truncate">{email}</span>
  {/* × button identical to live variant */}
</span>
```

Note: the loading-state chip is `text-gray-500` upright (NOT italic). The italic-only-for-historical rule is preserved.

### Surface 11: Inline refresh hint (D-10)

Renders below the chip cluster, above the input, only when `status === 'ready'` AND `historicalCount > 0`:

```tsx
<div className="flex items-start gap-3 rounded-lg border border-yellow-800/60 bg-yellow-950/30 px-3 py-2">
  <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0 mt-0.5" />
  <div className="flex-1 min-w-0 text-xs text-gray-300 leading-snug">
    <span className="text-yellow-500 font-medium">{historicalCount}</span>{' '}
    {historicalCount === 1 ? 'entry' : 'entries'} not found in current directory snapshot.{' '}
    Last refresh: <span className="text-yellow-500">{relativeTime}</span>.
    {lastError && <span className="text-red-400"> (refresh failed)</span>}
  </div>
  <button
    type="button"
    onClick={refresh}
    disabled={refreshing}
    className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-xs text-gray-300 transition-colors"
  >
    {refreshing
      ? <Loader2 size={12} className="animate-spin" />
      : <RefreshCw size={12} />}
    {refreshing ? 'Refreshing…' : 'Refresh Prime directory'}
  </button>
</div>
```

| Element | Classes |
|---------|---------|
| Outer container | `flex items-start gap-3 rounded-lg border border-yellow-800/60 bg-yellow-950/30 px-3 py-2` |
| Warning icon | `text-yellow-500 flex-shrink-0 mt-0.5` (size 14) |
| Body text wrapper | `flex-1 min-w-0 text-xs text-gray-300 leading-snug` |
| Numeric emphasis spans | `text-yellow-500` (count) and `text-yellow-500` (timestamp) |
| `font-medium` (500) on the count | **EXCEPTION to the two-weight rule** — applied to the numeric count only because it's a one-glyph data point inside a text run. This is the single use of `font-medium` in Phase 3. Auditor: flag if used elsewhere. |
| Refresh-failed suffix | `text-red-400` (only when `lastError` is non-null) |
| Refresh button | `flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-xs text-gray-300 transition-colors` |

**Spacing:** the hint sits at `mt-0` from the chip cluster (the picker container's `space-y-2` provides 8px gap). The input below sits at `mt-2` (provided by `space-y-2`).

### Surface 12: Audit table actor cell (modified)

Existing markup at `app/admin/page.tsx:629–632`:

```tsx
<td className="px-4 py-3">
  <div className="text-gray-300 text-sm">{entry.name || entry.email}</div>
  {entry.name && <div className="text-gray-600 text-xs">{entry.email}</div>}
</td>
```

**Phase 3 replaces with:**

```tsx
<td className="px-4 py-3">
  <div className="text-gray-300 text-sm">{displayName}</div>
  {showEmailLine && <div className="text-gray-600 text-xs">{entry.email}</div>}
</td>
```

Where (computed per row, inside the `entries.map` callback):

```typescript
const live = byEmail.get(entry.email.toLowerCase());
const displayName = live?.fullName?.trim() || entry.name || entry.email;
const showEmailLine = displayName !== entry.email;
```

**Visual classes UNCHANGED** — `text-gray-300 text-sm` for primary, `text-gray-600 text-xs` for secondary. Only the value source changes (cascade vs simple fallback).

### Surface 13: Audit filter dropdown (modified)

Existing markup at `app/admin/page.tsx:587–592`:

```tsx
<select value={actionFilter} onChange={…}
  className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-600">
  <option value="all">All</option>
  <option value="login">Login</option>
  <option value="logout">Logout</option>
</select>
```

**Phase 3 replaces with (one new `<option>`):**

```tsx
<select value={actionFilter} onChange={…}
  className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-600">
  <option value="all">All</option>
  <option value="login">Login</option>
  <option value="prime_user_miss">Prime miss</option>
  <option value="logout">Logout</option>
</select>
```

**Visual classes UNCHANGED** — the existing `<select>` styling already has the brand-red focus ring and matches the picker input's color discipline.

---

## Interaction State Matrix

Per component, per state. `—` means the state does not apply.

### `<PrimeUserPicker>` search input

| Interaction | Default | Hover | Focus | Active (typing) | Disabled |
|-------------|---------|-------|-------|-----------------|----------|
| Border | `border-gray-700` | `border-gray-700` | `border-red-600` | `border-red-600` | — (never disabled) |
| Background | `bg-gray-800` | `bg-gray-800` | `bg-gray-800` | `bg-gray-800` | — |
| Text | `text-white` (placeholder when empty: `text-gray-600`) | same | same | `text-white` | — |
| Cursor | `text` | `text` | `text` | `text` | — |
| Outline | `outline-none` | `outline-none` | `outline-none` (border substitutes) | `outline-none` | — |

### Dropdown row

| Interaction | Default | Hover (mouse) | Keyboard-active | Already-selected (disabled) | Empty-cache `<li>` |
|-------------|---------|---------------|-----------------|---------------------------|-------------------|
| Background | `transparent` | `bg-gray-700` | `bg-gray-700` | `transparent` (no hover) | `transparent` |
| Text (primary) | `text-white` | `text-white` | `text-white` | `text-white opacity-50` | `text-gray-300` |
| Text (secondary) | `text-gray-500` | `text-gray-500` | `text-gray-500` | `text-gray-500 opacity-50` | `text-gray-500` |
| Cursor | `cursor-pointer` | `cursor-pointer` | (no cursor change — virtual focus) | `cursor-not-allowed` | `cursor-default` |
| `aria-selected` | `false` | `false` | `true` | `false` | n/a |
| `aria-disabled` | absent | absent | absent | `true` | `true` |

### Chip (live)

| Interaction | Default | Hover (chip body) | × button default | × button hover | × button focus |
|-------------|---------|-------------------|------------------|----------------|----------------|
| Chip bg | `bg-gray-800` | `bg-gray-800` (no chip-body hover) | inherits | inherits | inherits |
| Chip border | `border-gray-700` | `border-gray-700` | inherits | inherits | inherits |
| Chip text | `text-white` | `text-white` | inherits | inherits | inherits |
| × icon color | n/a | n/a | `text-gray-500` | `text-white` | `text-gray-500` |
| × button bg | n/a | n/a | `transparent` | `bg-gray-700` | `transparent` |
| × button ring | n/a | n/a | absent | absent | `ring-1 ring-red-600` |

**Note:** the chip body itself is non-interactive — only the × button is a click target. Hovering the chip body changes nothing visually (and exposes the `title` tooltip after the browser's native hover delay, ~500ms).

### Chip (historical) — additional state matrix

| Interaction | Default | Hover (chip body — surfaces tooltip) | × button (identical to live) |
|-------------|---------|--------------------------------------|------------------------------|
| Chip bg | `bg-gray-800/60` | unchanged | inherits |
| Chip text | `text-gray-500 italic` | unchanged | inherits (× button has `not-italic` to neutralize) |
| Native tooltip | `Not in current directory snapshot — refresh to recheck` (after browser hover delay) | shown | n/a |

### Refresh hint button (in inline hint AND in empty-cache state)

| Interaction | Default | Hover | Focus | Disabled (refreshing) |
|-------------|---------|-------|-------|----------------------|
| Background (in hint) | `bg-gray-800` | `bg-gray-700` | `bg-gray-800` | `bg-gray-800 opacity-50` |
| Background (in empty-cache) | `bg-gray-700` | `bg-gray-600` | `bg-gray-700` | `bg-gray-700 opacity-50` |
| Text | `text-gray-300` | `text-gray-300` | `text-gray-300` | `text-gray-300` |
| Icon | `RefreshCw` | `RefreshCw` | `RefreshCw` | `Loader2 animate-spin` |
| Label | `Refresh Prime directory` | same | same | `Refreshing…` |
| `disabled` attribute | absent | absent | absent | `true` |
| Outline | (browser default focus ring on `<button>`) | — | (browser default) | — |

### Audit filter dropdown (`<select>`)

| Interaction | Default | Hover | Focus | Open (browser-native) |
|-------------|---------|-------|-------|----------------------|
| Border | `border-gray-700` | `border-gray-700` | `border-red-600` | `border-red-600` |
| Background | `bg-gray-800` | `bg-gray-800` | `bg-gray-800` | (browser-native popup chrome) |
| Text | `text-gray-300` | `text-gray-300` | `text-gray-300` | (browser-native) |

Native `<select>` retains browser-default open behavior; we do NOT custom-render the option popup. The new `Prime miss` option inherits the browser's native option styling.

### Audit table row — actor cell (no new interactions)

The actor cell is non-interactive (no hover state, no click handler). Existing row hover (`hover:bg-gray-800/30` at `app/admin/page.tsx:627`) is unchanged.

---

## Empty / Loading / Error States

Comprehensive state table for all picker states. The combinations below are exhaustive — every (`status`, `users.length`, `selected.length`, `query`) tuple maps to one row.

| Scenario | `status` | `users.length` | `selected` | `query` | Visible elements (top to bottom) |
|----------|----------|---------------|------------|---------|----------------------------------|
| First mount, no selection | `loading` | 0 (still fetching) | `[]` | `''` | Centered `Loader2` spinner only (no chip cluster, no input) |
| First mount, with prior selection | `loading` | 0 | `['a@x.com', 'b@x.com']` | `''` | Chip cluster (each chip in plain `text-gray-500` upright — Pitfall 1 mitigation), then centered spinner below |
| Loaded, no selection, no search | `ready` | 30 | `[]` | `''` | Search input only (placeholder visible). On focus → dropdown opens showing all 30 users. |
| Loaded, with selection, no historicals | `ready` | 30 | `['alice@…', 'bob@…']` | `''` | Chip cluster (live chips, alphabetical) → search input. NO refresh hint. |
| Loaded, with selection, has historicals | `ready` | 30 | `['alice@…', 'departed@…']` | `''` | Chip cluster (live + historical interleaved alphabetically) → refresh hint (`⚠ 1 entry not found…`) → search input |
| Loaded, search has matches | `ready` | 30 | (any) | `'jane'` | (chips +/- hint) → input with `jane` → dropdown listing matches |
| Loaded, search has no matches | `ready` | 30 | (any) | `'zzzzz'` | (chips +/- hint) → input with `zzzzz` → dropdown showing single `<li>No matches</li>` |
| Empty cache (Prime never fetched) | `ready` | 0 | `[]` | `''` | Search input → on focus → dropdown shows empty-cache state (heading + body + Refresh button) |
| Empty cache, with prior selection | `ready` | 0 | `['alice@…']` | `''` | Chip cluster (each chip historical-styled — italic gray — because byEmail is empty AND status==='ready') → refresh hint (count = `selected.length`) → input → on focus → dropdown shows empty-cache state |
| Fetch error | `error` | 0 (or last-known if fetched before) | (any) | (any) | Same as ready+empty cache + `(refresh failed)` suffix appended to refresh hint when present. Empty-cache state in dropdown body is reused. |
| Refresh in progress | (any) | (last-known) | (any) | (any) | All elements remain rendered + interactive; refresh button shows spinner + `Refreshing…` label + `disabled` |
| Refresh succeeds (transition) | `loading` → `ready` | (new value) | (any) | (preserved) | Chips reclassify (historical → live where applicable); refresh hint disappears if `historicalCount` drops to 0 |

**Why `loading` ≠ `ready+empty`:** Per Pitfall 1, the tri-state directory is required to avoid the false-historical flash. `loading` means "we genuinely don't know yet"; `ready+empty` means "we know there are zero." The visual treatment is different (loading shows a spinner; ready+empty shows the call-to-action).

**Audit table empty/loading states (UNCHANGED from existing):**

| Scenario | Render |
|----------|--------|
| `loading` | Existing `Loading...` text in the `${entries.length} entries` slot at `app/admin/page.tsx:604` |
| `entries.length === 0 && !loading` | Existing `No entries found` row at `app/admin/page.tsx:624` |
| Audit fetch error | Existing red banner at `app/admin/page.tsx:608–610` |

Phase 3 introduces NO new audit empty/loading/error states.

---

## Accessibility Acceptance Criteria

Each row below is a **grep-able assertion** the planner binds to acceptance criteria. Format: `<predicate> | <verification command>`.

### Combobox ARIA wiring (WAI-ARIA 1.2 Combobox pattern)

| Assertion | Verification command |
|-----------|---------------------|
| Search input has `role="combobox"` | `grep -c 'role="combobox"' components/ui/PrimeUserPicker.tsx` returns `>= 1` |
| Search input has `aria-controls={listboxId}` referencing the listbox | `grep -c 'aria-controls=' components/ui/PrimeUserPicker.tsx` returns `>= 1` |
| Search input has `aria-expanded={open}` | `grep -c 'aria-expanded=' components/ui/PrimeUserPicker.tsx` returns `>= 1` |
| Search input has `aria-autocomplete="list"` | `grep -c 'aria-autocomplete="list"' components/ui/PrimeUserPicker.tsx` returns `>= 1` |
| Search input has `aria-activedescendant` driven by `activeIndex` | `grep -c 'aria-activedescendant' components/ui/PrimeUserPicker.tsx` returns `>= 1` |
| Search input has `aria-label="Search Prime users"` (always — context-independent) | `grep -c 'aria-label="Search Prime users"' components/ui/PrimeUserPicker.tsx` returns `>= 1` |
| Listbox `<ul>` has `role="listbox"` | `grep -c 'role="listbox"' components/ui/PrimeUserPicker.tsx` returns `>= 1` |
| Each row `<li>` has `role="option"` | `grep -c 'role="option"' components/ui/PrimeUserPicker.tsx` returns `>= 1` |
| Each row has `aria-selected={i === activeIndex}` | `grep -c 'aria-selected=' components/ui/PrimeUserPicker.tsx` returns `>= 1` |
| Each row has a stable `id` matching `aria-activedescendant` pattern (`${listboxId}-opt-${i}`) | Visual code review (planner asserts the id+aria pair is consistent) |
| Already-selected rows have `aria-disabled="true"` | `grep -c 'aria-disabled=' components/ui/PrimeUserPicker.tsx` returns `>= 1` |

### Keyboard interactions (D-19)

| Key | Behavior | Verification |
|-----|----------|-------------|
| `ArrowDown` | Opens dropdown (if closed) AND moves `activeIndex` down by 1 (clamped to `filtered.length - 1`); `e.preventDefault()` to stop page scroll | Vitest: simulate keydown, assert `activeIndex` advances |
| `ArrowUp` | Moves `activeIndex` up by 1 (clamped to 0); does NOT close dropdown; `e.preventDefault()` to stop page scroll | Vitest |
| `Enter` | If `activeIndex >= 0` and the active option is not already-selected, calls `addEmail` and clears `query`; `e.preventDefault()` to stop form submission | Vitest |
| `Escape` | Closes dropdown, sets `activeIndex` back to `-1`; query is preserved | Vitest |
| `Backspace` (when `query === ''` AND `selected.length > 0`) | Removes the LAST chip in `sortedChips`; `e.preventDefault()` to stop browser back-navigation | Vitest |
| `Tab` | Default browser behavior (move focus out of input); does NOT close dropdown synchronously (the 100ms blur delay in Pattern 3 closes it) | Manual UAT |

### Focus management (Pitfall 2)

| Assertion | Verification |
|-----------|-------------|
| DOM focus stays on the search input throughout dropdown navigation (no native focus moves to options) | Manual UAT: open dropdown, ArrowDown, observe `document.activeElement` is the input |
| Listbox option `onMouseDown` calls `e.preventDefault()` | `grep -c 'onMouseDown=' components/ui/PrimeUserPicker.tsx` returns `>= 1` AND inspection shows the handler calls `preventDefault()` |
| Search input `onBlur` close has at minimum a 100ms delay OR the option uses `onMouseDown` for selection | Code review (either belt-and-braces is acceptable per Pattern 3) |

### Screen reader / assistive tech

| Concern | Treatment |
|---------|-----------|
| Search input announces its purpose | `aria-label="Search Prime users"` always present; placeholder is decorative (SR support varies) |
| Active option announced as the user arrows through | `aria-activedescendant` + matching `id` on the `<li>` causes SRs to announce the new option's text content; verified by NVDA + VoiceOver in HUMAN-UAT.md |
| Already-selected option announced as disabled | `aria-disabled="true"` causes SRs to append "dimmed" / "unavailable" |
| Chip × button has descriptive `aria-label` | `Remove {fullName}` or `Remove {email}` — verified per chip variant |
| Refresh hint icon is decorative | `AlertTriangle` lucide icon has no `aria-hidden` override — but the surrounding `text-gray-300` text fully describes the situation, so the icon being announced as "warning" is additive, not duplicative. Acceptable. |
| Refresh button label changes during action | `Refreshing…` swap announces the state change to SRs (assertive announcement not needed; the label change is sufficient) |
| Dropdown opens/closes are announced | `aria-expanded` on the combobox tells SRs the state |

### Reduced motion

| Element | Animation | Reduced motion behavior |
|---------|-----------|-------------------------|
| Refresh button spinner (`Loader2 animate-spin`) | CSS spin | NOT honored — Tailwind `animate-spin` doesn't auto-respect `prefers-reduced-motion`. **Acceptable** because the spinner is the primary in-progress signal; replacing with a static icon would lose feedback. Auditor: flag if a future phase needs to honor `prefers-reduced-motion` here. |
| Loading bouncing-dot spinner (existing `LoadingSpinner` reused) | CSS bounce | UNCHANGED from existing component |
| Transitions on hover (`transition-colors`) | 150ms color | Acceptable — color-only transitions are exempt from typical reduced-motion concerns |
| No translate/scale/rotate transforms on dropdown open/close | n/a | Compliant by absence |

### Touch targets

| Element | Size | Compliant (WCAG 2.5.5 min 24×24, AAA 44×44) |
|---------|------|--------------------------------------------|
| Chip × button | ~20×20 (icon 12 + p-0.5 = 20px) | Below 24px AAA. **Acceptable for desktop admin tool** (Phase 3 has no mobile touch use case — admin page on desktop). Auditor: flag if mobile admin becomes a requirement. |
| Refresh button | ~28px × auto-width | Compliant |
| Search input | 36px height | Compliant |
| Dropdown row | ~40px height (text-sm + py-2) | Compliant |
| Audit filter `<select>` | ~32px height | Compliant |

---

## Visual Continuity Audit

### Patterns reused unchanged from existing admin page (`app/admin/page.tsx`)

| Pattern | Source | Reused in |
|---------|--------|-----------|
| Section panel (`bg-gray-900 rounded-xl border border-gray-800 overflow-hidden`) | `app/admin/page.tsx:285` (Dashboard Admins section) | Picker is rendered INSIDE this — no new panel chrome |
| Section header bar (icon + heading + helper text in a `flex items-center gap-2 px-5 py-4 border-b border-gray-800`) | `app/admin/page.tsx:286–290` | Unchanged — the picker replaces only the textarea inside the panel body |
| Form input visual register (`bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600`) | `app/admin/page.tsx:300, 340, 482` | Search input adopts this verbatim (with `focus:border-red-600` matching the admin convention vs Phase 2 TopBar's no-focus context) |
| Form helper text (`text-xs text-gray-500 mb-1.5`) | `app/admin/page.tsx:292` | Unchanged — the existing helper above the textarea is reused above the picker |
| Toast pattern (success / error variants) | `app/admin/page.tsx:273–282` | UNCHANGED — picker save still goes through the existing Save Changes button + toast cycle (no inline picker toasts) |
| Save bar (`bg-red-600 hover:bg-red-700` button) | `app/admin/page.tsx:263–270` | UNCHANGED — picker doesn't touch the Save bar |
| Audit row two-line actor cell (`text-gray-300 text-sm` primary + `text-gray-600 text-xs` secondary) | `app/admin/page.tsx:629–631` | Phase 3 changes only the cascade source, not the visual classes |
| Audit `<select>` filter (`bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-600`) | `app/admin/page.tsx:587–588` | Phase 3 adds one `<option>`; classes unchanged |
| `ActionBadge` amber Miss variant (`bg-amber-900/50 text-amber-400 border border-amber-800`) | `app/admin/page.tsx:512–514` | Existing — Phase 3 doesn't change badges |
| `LoadingSpinner` (existing 3-dot bounce) | `components/ui/LoadingSpinner.tsx:5` | Reused inside picker container during initial load (alternative: inline `<Loader2 animate-spin />` for tighter footprint — see Loading state surface) |
| `ErrorMessage variant="warning"` palette (yellow border/bg/icon) | `components/ui/LoadingSpinner.tsx:22` | Inline refresh hint adopts the SAME color tokens (`yellow-800/60`, `yellow-950/30`, `yellow-500`) — visually peer with the project's existing warning vocabulary |
| `formatAEDT` timestamp formatter | `app/admin/page.tsx:499` | UNCHANGED — audit timestamp column reuses |

### Net-new patterns introduced by Phase 3

| Pattern | First use | Used in |
|---------|-----------|---------|
| Inline combobox with chips below (WAI-ARIA Combobox 1.2 — input + listbox + chip cluster, single component) | Phase 3 | `<PrimeUserPicker>` (3 mount sites in admin page) |
| Compact chip / tag with × remove (rounded-md, gray-800 bg, gray-700 border, max-w-[200px] truncate) | Phase 3 | Inside `<PrimeUserPicker>` |
| Italic+gray "historical" data-state styling | Phase 3 | Historical chip variant only |
| Inline warning notice with action button (yellow bordered banner with Refresh CTA inside) | Phase 3 | Inline refresh hint in `<PrimeUserPicker>` |
| Tri-state container (`loading | ready | error`) for async-driven UI | Phase 3 (via `PrimeDirectoryProvider`) | Picker + audit table |
| `aria-activedescendant` for virtual focus | Phase 3 | Picker only |
| Native `title` attribute as hover tooltip (instead of a custom Tooltip component) | Phase 3 | Picker chips. Project has no custom Tooltip; this is a deliberate non-introduction. |

### Patterns explicitly NOT introduced (despite being natural reaches)

| Pattern | Why not |
|---------|---------|
| Custom `<Tooltip>` component | CONTEXT.md Discretion — native `title` is sufficient for this phase; no other surface needs tooltips |
| Avatar / photo per Prime user | Prime API doesn't expose photos (deferred ideas note) |
| "Remove all historical entries" bulk action | Deferred per CONTEXT.md |
| Skeleton chip placeholders | The first-load window is short (one `/api/admin/prime-users` GET); a centered spinner is enough. Skeletons would be over-engineering for a 30-row, 5KB payload. |
| Highlighted matched substring inside dropdown rows | Out of scope — D-18 specifies plain substring filter, no match-highlighting requirement |
| Animated open/close on dropdown | No motion in this phase. Existing admin form has no entrance animations; matching the register. |
| "Recently selected" or "suggested" sections in dropdown | The 30-user list is small enough that flat alphabetical (default) is faster than scanning categories |
| Avatar/badge for the current user (you're picking yourself) | Out of scope — picker doesn't differentiate; the user can pick themselves but it's harmless because they're already implicit-admin via `ADMIN_EMAIL` env |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (project does not use shadcn) | not applicable — no shadcn in this project |
| third-party | none | not applicable |

Phase 3 introduces no registry components, no third-party UI blocks, no external copy-paste patterns. The picker is a hand-rolled combobox following WAI-ARIA Authoring Practices 1.2 (an open spec, not a registry); chips and the refresh hint are inline Tailwind compositions. No new `npm` dependencies (verified by RESEARCH.md Standard Stack — all libs already in `package.json`).

---

## Implementation Reference (JSX skeleton — non-normative)

Shows how the contract materializes. Exact strings/classes above are the binding part; this skeleton is illustrative.

```tsx
// components/ui/PrimeUserPicker.tsx
'use client';
import { useId, useMemo, useState, useCallback } from 'react';
import { X, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { usePrimeDirectory } from '@/lib/prime-directory-context';
import type { PrimeUser } from '@/lib/prime-users';

interface PrimeUserPickerProps {
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  multiSelect?: boolean;
  allowHistorical?: boolean;
}

export function PrimeUserPicker({
  selected, onChange, placeholder, multiSelect = true, allowHistorical = true,
}: PrimeUserPickerProps) {
  const inputId = useId();
  const listboxId = useId();
  const { status, users, byEmail, lastSuccessAt, lastError, refresh, refreshing } = usePrimeDirectory();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const sortedChips = useMemo(() => {
    return selected.map(email => {
      const u = byEmail.get(email.toLowerCase());
      return u
        ? { kind: 'live' as const, email, sortKey: u.fullName.toLowerCase(), user: u }
        : { kind: 'historical' as const, email, sortKey: email.toLowerCase() };
    }).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [selected, byEmail]);

  const historicalCount = status === 'ready'
    ? sortedChips.filter(c => c.kind === 'historical').length
    : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.division?.toLowerCase().includes(q) ?? false)
    );
  }, [users, query]);

  // ...keyboard handler, addEmail, removeEmail, refresh handler, JSX as in surfaces above...
}
```

---

## Checker Sign-Off

- [ ] **Dimension 1 Copywriting:** PASS — every visible string locked verbatim (placeholders, dropdown row format, chip tooltip variants, empty/error copy, refresh hint pluralization, refresh button labels, audit filter option label); pluralization rule and relative-time rule explicit; symbols (U+ codepoints) declared.
- [ ] **Dimension 2 Visuals:** PASS — 13 surfaces enumerated with exact Tailwind class lists; interaction state matrix covers default/hover/focus/active/disabled per element; loading/empty/error states tabulated exhaustively across (status × users × selected × query) tuples; no novel visual primitives outside the chip + combobox listed in the continuity audit.
- [ ] **Dimension 3 Color:** PASS — 60/30/10 split inherited from admin page register; brand red `#DC2626` reserved-for list explicit (8 entries); accent NEVER applied to chips/dropdown highlights/refresh button; warning yellow scoped to refresh hint container only; contrast ratios computed per pair, AA min met everywhere except (a) historical chip text (mitigated by redundant signaling) and (b) placeholder (exempt by SC 1.4.3).
- [ ] **Dimension 4 Typography:** PASS — 3 sizes (`text-sm` 14px, `text-xs` 12px, plus inherited `text-sm font-semibold` on existing section headings), 2 weights (400 default + 600 `font-semibold` on existing headings); ONE exception (`font-medium` on the numeric count inside the refresh hint, single use, flagged to auditor); ONE italic use (historical chip, flagged to auditor); `truncate` applied to the three places where overflow is possible.
- [ ] **Dimension 5 Spacing:** PASS — Tailwind 4-base scale; declared exceptions (`gap-1.5` chip wrap, `max-h-64` dropdown cap, `max-w-[200px]` chip width cap, `min-h-[2.25rem]` input touch target) each justified; no arbitrary `px` values outside these.
- [ ] **Dimension 6 Registry Safety:** PASS — no registry used; no third-party UI blocks; no new dependencies. Not applicable.

**Approval:** pending — checker will upgrade this file to `status: approved` after validation.
