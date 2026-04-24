# Phase 3: Admin Picker & Identity-Rich Display - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 03-admin-picker-identity-rich-display
**Areas discussed:** Picker UI pattern, Secondary-info display, Stale-email treatment (ADMIN-05), Audit log identity resolution (DISPLAY-03)

---

## Picker UI pattern

### What's the picker's surface pattern?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline combobox | Search input where the textarea is today; floating result list; click-to-add chip. Matches existing inline-everything admin UI. | ✓ |
| Modal dialog | Click 'Add members' → modal with search + checkbox list; bulk-select; commit on close. | |
| Popover/dropdown | Compact button-anchored picker (Notion/Linear style). | |

**User's choice:** Inline combobox

### How should the picker be packaged?

| Option | Description | Selected |
|--------|-------------|----------|
| Single shared component | One `<PrimeUserPicker>` used by all 3 surfaces with multi-select prop. | ✓ |
| Two variants (single/multi) | `<SinglePrimeUserPicker>` for admins, `<MultiPrimeUserPicker>` for groups. | |
| Three call-site components | Each surface gets its own picker. | |

**User's choice:** Single shared component

### What fields does the typeahead match against?

| Option | Description | Selected |
|--------|-------------|----------|
| Name + email + division (per ADMIN-04) | Spec-conformant; null-safe; future-proof if division becomes populated. | ✓ |
| Name + email only | Pragmatic given division is null today. | |
| Name + email + roleOrTrade | Match what's actually populated; would amend ADMIN-04. | |

**User's choice:** Name + email + division (per ADMIN-04)

### How does the Dashboard Admins picker behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-select like groups | Same combobox + chip pattern; multiple admins added in one save. | ✓ |
| Single-select (one admin at a time) | Picker resolves one user at a time. | |
| Inline search + add-on-click only | Clicking adds directly to persisted list (no pending state). | |

**User's choice:** Multi-select like groups

### When does adding/removing a member persist?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep existing 'Save Changes' button | Picker mutates local state; existing Save button POSTs whole config. | ✓ |
| Auto-save per change | Each add/remove fires a save; risks half-saved states. | |

**User's choice:** Keep existing 'Save Changes' button

---

## Secondary-info display

### What does each picker result row show?

| Option | Description | Selected |
|--------|-------------|----------|
| Two-line: Name / Email — division if present | Name primary; email + ' · {division}' when non-null. Future-proof. | ✓ |
| Two-line: Name / Email + roleOrTrade | Use the field that's populated today. | |
| Two-line: Name / Email only | Strictest minimum; loses discriminator when role/division exist. | |

**User's choice:** Two-line: Name / Email — division if present

### What does each row in group/admin lists show (DISPLAY-01/02)?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror picker rows | Same two-line layout in picker, group lists, admin lists. | ✓ |
| Compact one-line: 'Name (email)' | Tighter; can't easily show division/role inline. | |
| Chip-style with hover detail | Just name on chip; tooltip shows email + role. | |

**User's choice:** Mirror picker rows

### How are members rendered when their Prime record can't be resolved?

| Option | Description | Selected |
|--------|-------------|----------|
| Email-only row, neutral styling | Renders bare email; admin can spot it; no visual noise. | ✓ |
| Email + 'Not in Prime' tag | Small amber badge; unmissable. | |
| Email + grayed | Dimmed via text-gray-500 (vs default text-gray-300). | |

**User's choice:** Email-only row, neutral styling

### Where do client components fetch the Prime user list for picker + display?

| Option | Description | Selected |
|--------|-------------|----------|
| New GET /api/admin/prime-users (admin-only) | Single net-new endpoint, admin session-gated; returns PrimeUser[]. | ✓ |
| Extend /api/auth/session | Add primeUsers field to session response. Admin data leaks to all users. | |
| Per-row /api/auth/session-style live resolution | N+1 fetch storm. | |

**User's choice:** New GET /api/admin/prime-users (admin-only)

---

## Stale-email treatment (ADMIN-05)

### How are group/admin entries flagged when their email isn't in the Prime directory?

| Option | Description | Selected |
|--------|-------------|----------|
| Tooltip-only; rely on email-only render | Email-only row is the cue; hover shows 'No Prime record found'. Minimal noise. | ✓ |
| Inline 'Not in Prime' badge | Small amber tag; unmissable. | |
| Dimmed text only | text-gray-500 (vs text-gray-300); risk of being missed. | |

**User's choice:** Tooltip-only; rely on email-only render

### Should the admin UI surface stale entries beyond the per-row visual?

| Option | Description | Selected |
|--------|-------------|----------|
| No | Per-row removal is enough; bulk tooling is scope creep. | ✓ |
| Show count per group | GroupCard header shows '5 members · 1 not in Prime'. | |
| Top-of-tab 'Clean up' summary panel | Lists all stale entries across all groups + admins. | |

**User's choice:** No

### If /api/admin/prime-users fails or returns empty, what happens in the picker?

| Option | Description | Selected |
|--------|-------------|----------|
| Disable picker, show error + manual-add fallback | Reveal single email-input field for manual entry during outage. | ✓ |
| Disable picker, show error only | 'Prime directory unavailable'; admin can't add anyone. | |
| Show empty list, no message | Confusing; can't distinguish 'no users' from 'failure'. | |

**User's choice:** Disable picker, show error + manual-add fallback

### Where does the 'Refresh Prime users' button live?

| Option | Description | Selected |
|--------|-------------|----------|
| Top of Visibility tab, near Save Changes | Single button; uses Phase 1 D-13 metadata response. | ✓ |
| Inside each picker (per-instance) | 3 buttons calling same endpoint; redundant. | |
| Defer to a future Admin > Directory subtab | No refresh UI in v1. | |

**User's choice:** Top of Visibility tab, near Save Changes

---

## Audit log identity resolution (DISPLAY-03)

### Where does email → Prime name resolution happen for the audit log?

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side, using the picker's loaded user list | Reuse the already-loaded user list; zero new endpoints. | ✓ |
| Server-side join in /api/audit/entries | Audit endpoint calls resolveByEmail per row. | |
| Trust the existing entry.name field | Don't re-resolve; risk stale name. | |

**User's choice:** Client-side, using the picker's loaded user list

### What's the rendering cascade for each audit row's actor?

| Option | Description | Selected |
|--------|-------------|----------|
| Live Prime name → entry.name → email | Three-layer cascade; one extra layer for legacy entries vs Phase 2 D-10. | ✓ |
| Live Prime name → email | Skip cookie-snapshot field. | |
| Live Prime name → entry.name | Never show bare email; risk blank rows. | |

**User's choice:** Live Prime name → entry.name → email

### How are 'prime_user_miss' audit rows rendered?

| Option | Description | Selected |
|--------|-------------|----------|
| Same cascade, show email + amber 'Miss' badge | Reuse existing ActionBadge; detail field as tooltip. | ✓ |
| Special render: 'Unknown user (…)' label | Strong call-out but breaks unified cascade. | |
| Render identical to login/logout | Simplest; relies only on action badge. | |

**User's choice:** Same cascade, show email + amber 'Miss' badge

### What does the CSV export include for the actor column?

| Option | Description | Selected |
|--------|-------------|----------|
| Add a 'Display Name' column populated from the cascade | Rename Name → Display Name; populate from cascade. | ✓ |
| Keep CSV exactly as today (entry.name field) | Visual change is UI-only; export stays. | |

**User's choice:** Add a 'Display Name' column populated from the cascade

---

## Claude's Discretion

User did not defer any specific decisions to Claude during interactive Q&A — every option chosen had a clear "Recommended" preference accepted. CONTEXT.md `Claude's Discretion` section enumerates implementation details (Tailwind tokens, exact keyboard handlers, debounce shape, tooltip mechanism, inactive-user visual treatment) that the planner / UI-SPEC step is expected to resolve.

## Deferred Ideas

See CONTEXT.md `<deferred>` section. No new deferrals beyond what was already in roadmap/PROJECT.md scope guards.
