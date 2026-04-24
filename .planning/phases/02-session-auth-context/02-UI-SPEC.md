---
phase: 2
slug: session-auth-context
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-24
---

# Phase 2 — UI Design Contract

> Visual and interaction contract for the TopBar user-identity label — the single new UI surface introduced by Phase 2. Scope is deliberately narrow per CONTEXT.md D-11/D-12/D-13. All other Phase 2 work (login route, session route, AuthContext plumbing) is non-visual and governed by CONTEXT.md alone.

---

## Scope & Anti-Scope

**In scope (this spec governs):**
- TopBar identity label — the single text surface added left of the existing weather widget in `components/ui/TopBar.tsx`.

**Out of scope (do NOT specify — deferred to Phase 3):**
- Admin picker surfaces (ADMIN-01..05)
- Group/admin list identity rendering (DISPLAY-01..02)
- Audit-log actor display (DISPLAY-03)
- Division / region / role / trade labels anywhere (D-13: always null in tenant)
- Avatars, admin badges, status indicators

This is a one-label surface. The contract covers all six checker dimensions but only one rendered element.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (no shadcn; project uses hand-rolled Tailwind components in `components/ui/`) |
| Preset | not applicable |
| Component library | none (Tailwind utility classes only) |
| Icon library | `lucide-react` (existing project standard; Phase 2 does NOT add an icon to the identity label) |
| Font | Inter (via `tailwind.config.ts` `fontFamily.sans`; system-ui, sans-serif fallbacks) |

Source: `tailwind.config.ts`, CLAUDE.md tech-stack section.

---

## Spacing Scale

Declared values (Tailwind default 4px-base scale — consistent with existing TopBar `gap-4` / `gap-2` / `gap-1.5`):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline gaps (n/a for this surface) |
| sm | 8px | Compact element spacing (n/a) |
| md | 16px | Slot separation in TopBar flex row (existing `gap-4`) |
| lg | 24px | Section padding (n/a for this surface) |

**Phase 2 spacing rules:**

- Identity label sits in the existing `flex items-center gap-4` row at `components/ui/TopBar.tsx:94`. No new spacing token required — it inherits the row's 16px gap.
- Inside the label, no internal padding or gap (single `<span>` / `<div>`).
- The existing vertical divider pattern (`w-px h-4 bg-gray-700`) is NOT required before the label — label is the leftmost slot; weather divider already exists between label-group and clock.

**Exceptions:** none.

---

## Typography

The identity label is rendered as **body text** inside the TopBar row. It inherits the TopBar's existing `text-sm` size (14px).

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body (identity label — name) | 14px (`text-sm`) | 400 (default) | 1.5 (Tailwind default for `text-sm`) | Prime `fullName` or email fallback — the single rendered string |
| Body (email fallback — identical styling) | 14px (`text-sm`) | 400 | 1.5 | When `primeUser?.fullName?.trim()` is empty, render `session.userEmail` with identical styling (no visual differentiation — per D-10 the fallback is invisible to the user) |

**Declared rules:**

- **One size, one weight** — the identity surface is a single string; no hierarchy needed. 14px regular matches every other TopBar text slot (weather `text-sm`, clock `text-sm`).
- **No bold / semibold.** Weight consistency with the rest of the TopBar row keeps the label visually peer with clock + weather rather than promoting it to a header.
- **Tabular nums NOT applied** (unlike the clock which uses `tabular-nums` — names aren't numeric).
- **No italic, no underline, no letter-spacing adjustments.**
- **`truncate` required** — long full names (>200px) must truncate with ellipsis via Tailwind `truncate` (CSS `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`). Container sets `max-w-[200px]` per RESEARCH.md Q3 guidance.

**Font family:** inherits `font-sans` (Inter) from body default — no override.

---

## Color

The dashboard's color contract is already established at the app level (dark theme, brand red `#DC2626` accent). Phase 2 does NOT introduce new colors — it consumes the existing TopBar palette.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#030712` (body bg — `rgb(3, 7, 18)` from `app/globals.css:7`) | Page background; behind TopBar |
| Secondary (30%) | `#111111` (`brand.black` / sidebar bg) and `#1F2937` (`gray-800` card bg) | Sidebar, cards, nav surfaces — NOT the TopBar label itself |
| Accent (10%) | `#DC2626` (`brand.red`) | Reserved for: active sidebar nav item background, alert dots, brand logo mark, primary CTAs. **NOT used by the identity label.** |
| Destructive | `#EF4444` (`red-500`) / `#DC2626` | Reserved for: destructive CTAs (Phase 2 has none). **NOT used by the identity label.** |

**Phase 2 identity label colors (Tailwind classes, no raw hex):**

| Element | Tailwind class | Resolved value | Rationale |
|---------|---------------|----------------|-----------|
| Identity label text (name or email fallback) | `text-gray-300` | `#D1D5DB` | Slightly brighter than TopBar's `text-gray-400` (`#9CA3AF`) secondary/meta text — signals "this is who you are" (primary human-oriented info) while staying neutral against the dark background. Consistent peer with existing `text-white` clock time and `text-gray-400` weather description — reads as content, not chrome. |

**Accent reserved for** (explicit list — the identity label is NOT on this list):

1. Active sidebar nav item background (`bg-red-600`)
2. Alert dots on nav items (`bg-red-500`)
3. Active-group icon tint in collapsible nav (`text-red-400`)
4. Brand logo mark
5. Active/highlighted admin support link

**Why the identity label is neutral (not branded):**

- The TopBar is a utility strip (clock/weather/identity) — nothing there is interactive or promotional.
- Using brand red on a name would compete with the active-page indicator in the sidebar for visual priority.
- Fallback case (email shown when Prime has no record) must not visually "announce" the degraded state — per D-10, the cascade is silent.

**Contrast check:** `text-gray-300` (`#D1D5DB`) on body `#030712` ≈ 13.3:1 contrast ratio — well above WCAG AAA 7:1 for normal text.

---

## Copywriting Contract

The identity label renders **a single string with no prefix, label, or chrome text**. No "Signed in as", no "Welcome back", no "Hello,".

| Element | Copy | Notes |
|---------|------|-------|
| Identity label (primary) | `{primeUser.fullName}` | Rendered verbatim from Prime when present and non-blank after `.trim()` (e.g. `"Chris Freeman"`) |
| Identity label (fallback) | `{session.userEmail}` | Rendered verbatim when Prime `fullName` is missing or whitespace-only (e.g. `"chris.freeman@techgurus.com.au"`) |
| Primary CTA | n/a | Phase 2 introduces no CTA |
| Empty state | n/a — the identity label is never empty | A logged-in user always has at minimum `session.userEmail`; if AuthGuard reaches TopBar, identity is never blank. If both were somehow missing, the `<div>` wrapper renders nothing (no placeholder copy, no skeleton text — label is a pure data reflection) |
| Loading state | n/a — no spinner, no skeleton | The identity value arrives in the same `/api/auth/session` payload that already hydrates `isAdmin` / `hiddenPaths`; by the time TopBar renders, AuthContext is populated |
| Error state | n/a — silent fallback | Per D-10 and D-18: if `primeUser` is null (match-miss or cache-down), the email fallback is shown with no error message, no icon, no tooltip. The user cannot distinguish "Prime miss" from "Prime cache empty" from "full name populated as email-like string" — by design |
| Destructive actions | none | Phase 2 has no destructive UI |
| Tooltip / hover | none | Do NOT add a `title` attribute or tooltip explaining "Prime display name" — the label speaks for itself |

**Copywriting rules:**

- **No prefix text.** The label reads as a standalone name (e.g. `Chris Freeman`), not a sentence (e.g. "Signed in as Chris Freeman"). Matches the rest of the TopBar's label-less convention (the clock shows `10:23:45 AM`, not "Current time: 10:23:45 AM").
- **No truncation indicator copy.** When `truncate` activates on a long name, CSS ellipsis (`…`) is the only visual — no "read more", no tooltip with the full string (see Accessibility section for screen-reader handling).
- **Verbatim Prime data.** If Prime stores a name with unusual capitalization, punctuation, or whitespace inside (not leading/trailing), render it unchanged. Only leading/trailing whitespace is stripped by D-10's `.trim()`.

---

## Interaction Contract

| Interaction | Behavior |
|-------------|----------|
| Hover | No hover state. The label is not a link, button, or trigger. No color change, no cursor change. |
| Click | No click handler. Plain text. |
| Focus | Not focusable. Not in the tab order. |
| Keyboard | No keyboard interaction. |
| Responsive — narrow viewport | Label remains visible at all breakpoints (unlike the weather `description` which is `hidden sm:inline`). Truncation (`max-w-[200px] truncate`) handles overflow gracefully on narrow widths without hiding the identity entirely. |
| Responsive — very narrow (<400px) | Label may still display but with aggressive ellipsis. Acceptable; the user's email / name is more valuable than the weather description on mobile. |
| Loading transition | None — value is populated synchronously from AuthContext. No fade-in, no skeleton shimmer (unlike weather which uses conditional render `{weather && ...}` because it's a network fetch). The identity label renders on first paint. |

---

## Accessibility

| Concern | Treatment |
|---------|-----------|
| Semantic element | `<span>` inside an outer `<div>` — matches existing TopBar weather/clock pattern. No `<h1>`/`<h2>` — this is not a heading. |
| Screen reader — name visible | Screen reader announces the rendered string verbatim (name or email). No ARIA override. |
| Screen reader — truncated name | When CSS `truncate` visually clips a long name, the **full string remains in the DOM**. Screen readers read the full name, not the ellipsis. No additional `aria-label` needed. |
| Landmark | TopBar is not wrapped in a new landmark for Phase 2. (The parent layout's existing landmark structure is unchanged.) |
| Contrast | `text-gray-300` on `#030712` = ~13.3:1. Passes WCAG AAA for normal text. |
| Reduced motion | No motion introduced. `prefers-reduced-motion` is irrelevant. |
| `aria-live` / announcement | No. Identity doesn't update during session; if Phase 1 admin refresh updates the display name mid-session, the page re-fetches naturally — no live-region announcement. |
| `title` attribute | NOT required. Do not add a tooltip with the full name when truncated — sighted users can widen the viewport; screen reader users hear the full string regardless. |

---

## Brand Alignment

| Dimension | Alignment |
|-----------|-----------|
| Dark theme | Identity label uses `text-gray-300` — sits on the existing dark body background, peer with other TopBar text |
| Brand red | NOT used on the identity label (accent reserved for active nav + alerts only) |
| Typography | Inherits Inter via `font-sans`; 14px matches the TopBar row's `text-sm` |
| Density | Matches TopBar density: single row, horizontal, text-first, no icons/avatars (consistent with D-11 "minimal text label, no avatar, no admin badge") |
| Consistency with Sidebar | Sidebar uses `text-gray-400` for inactive nav items and `text-white` for active; TopBar identity sits between at `text-gray-300` — intentionally prominent enough to be the user's anchor but not an interactive surface |

---

## Component Inventory

| Component | Status | Location | Changes |
|-----------|--------|----------|---------|
| `components/ui/TopBar.tsx` | Existing | `components/ui/TopBar.tsx` | **Modified** — import `useAuth` from `@/lib/auth-context`; derive `displayName = primeUser?.fullName?.trim() || userEmail`; render identity `<div>` as the leftmost slot inside the existing `flex items-center gap-4` row at line 94, before the weather widget |
| `lib/auth-context.tsx` | Existing | `lib/auth-context.tsx` | **Modified** — adds `primeUser: PrimeUser \| null` field (per D-08). Non-visual change governed by CONTEXT.md, not this UI-SPEC; mentioned here only because TopBar reads from it |

**No new components, no new files in `components/ui/`, no design-system additions.**

---

## Implementation Reference (JSX skeleton)

Non-normative — shows how the contract materializes in code. Exact placement/labels are the binding part; the JSX below is illustrative.

```tsx
// components/ui/TopBar.tsx — inside the existing flex row
import { useAuth } from '@/lib/auth-context';

// ...inside TopBar()
const { userEmail, primeUser } = useAuth();
const displayName = primeUser?.fullName?.trim() || userEmail;

return (
  <div className="flex items-center gap-4 text-sm overflow-hidden">
    {/* Identity label — leftmost slot, added in Phase 2 */}
    {displayName && (
      <div className="max-w-[200px] truncate text-gray-300">
        {displayName}
      </div>
    )}

    {/* Existing divider pattern (optional — only if visual testing shows crowding) */}
    {displayName && weather && (
      <div className="w-px h-4 bg-gray-700 hidden sm:block" />
    )}

    {/* Existing weather slot */}
    {weather && (
      <div className="flex items-center gap-1.5 text-gray-400">
        {/* ...unchanged... */}
      </div>
    )}

    {/* ...rest of existing TopBar unchanged... */}
  </div>
);
```

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (project does not use shadcn) | not applicable — no shadcn in this project |
| third-party | none | not applicable |

Phase 2 introduces no registry components, no third-party UI blocks, no external copy-paste patterns. The identity label is a `<span>` inside a `<div>` with Tailwind classes already in the project's vocabulary.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS — single verbatim string, no prefix, fallback rule explicit, no loading/error copy needed
- [ ] Dimension 2 Visuals: PASS — one text element, no novel visuals, reuses existing TopBar flex-row pattern
- [ ] Dimension 3 Color: PASS — `text-gray-300` neutral; accent red NOT applied to identity; contrast 13.3:1 AAA
- [ ] Dimension 4 Typography: PASS — one size (`text-sm` 14px), one weight (400), inherits Inter, matches TopBar siblings
- [ ] Dimension 5 Spacing: PASS — inherits existing `gap-4` row spacing; `max-w-[200px]` truncation cap declared
- [ ] Dimension 6 Registry Safety: PASS — no registry used; not applicable

**Approval:** pending — checker will upgrade this file to `status: approved` after validation.
