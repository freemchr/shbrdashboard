# Phase 3: Admin Picker & Identity-Rich Display - Research

**Researched:** 2026-04-24
**Domain:** Accessible inline combobox + identity-rich display layer over the cached Prime directory (Phases 1-2 backend)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Picker UI shape**
- **D-01:** **Inline combobox.** All three picker sites (Dashboard Admins, group member editor, New Group form) replace their current free-text input with an always-visible search field. Click a result to add. Replaces the existing `adminEmailsRaw` textarea at `app/admin/page.tsx:296` and the equivalent surfaces in the Groups section. No modal, no popover.
- **D-02:** **Single reusable `<PrimeUserPicker>` component.** All three sites consume one component with props for `multiSelect: boolean`, `selected: string[]` (emails), `onChange`, `placeholder`, `allowHistorical: boolean`. Lives in `components/ui/PrimeUserPicker.tsx`.
- **D-03:** **Picker dropdown row content:** Prime display name (primary), `division` if present (secondary, dot-separated, hidden when null), email (tertiary, smaller, gray). Three lines per row in the dropdown.

**Selected-state display**
- **D-04:** **Compact name-only chips.** Selected admins / group members render as tight chips with just the name and an `×` to remove. Hover shows division + email tooltip.
- **D-05:** **Alphabetical order by display name.** Re-sorts on add/remove.
- **D-06:** **Identity-rich list rendering** (DISPLAY-01, DISPLAY-02): Group member lists and the Dashboard Admins list render as "Name — Division" with email secondary. When `division` is null, render "Name" with email secondary (no orphan dash). Falls back to email-only for historical entries.

**Historical entries (no Prime match)**
- **D-07:** "Historical" means "not in the current directory snapshot."
- **D-08:** **Visual treatment:** historical chips render the email value in italic, muted gray (`text-gray-500`), with tooltip on hover: **"Not in current directory snapshot — refresh to recheck"**. Removable like any other chip.
- **D-09:** **Position:** historical chips sort alphabetically by their email value into the same list as live name chips.
- **D-10:** **Inline refresh hint.** When the selected list contains any historical entries: `"⚠ {N} entr{y/ies} not found in current directory snapshot. Last refresh: {N} {time-unit} ago. [↻ Refresh Prime directory]"`. Clicking calls Phase 1's existing `/api/admin/prime-users/refresh` (POST). Last-refresh timestamp comes from Phase 1 D-19's `lastSuccessAt`.

**Audit log actor display (DISPLAY-03)**
- **D-11:** **Live-resolve cascade with saved-name fallback.** Audit row actor renders via cascade: `livePrimeUser?.fullName?.trim() → entry.name → entry.email`. Live-resolve uses Phase 1's directory cache via the `PrimeDirectoryContext` (D-17). Applies to all rows: 'login', 'logout', 'prime_user_miss'.
- **D-12:** **Email shown as secondary line under the actor name.** When the cascade resolves to email-only (no name match), only one line renders.

**Audit filter dropdown (Phase 2 follow-up)**
- **D-13:** **Audit filter dropdown gets a 'Prime miss' option.** Three small changes:
  1. `ActionFilter` type → add `'prime_user_miss'`
  2. `<select>` markup at `app/admin/page.tsx:587` → add `<option value="prime_user_miss">Prime miss</option>`
  3. `/api/audit/entries` allowlist at line 38 → include `'prime_user_miss'`

**TopBar identity polish (NOT Phase 3 scope)**
- **D-14:** **Already shipped (commits `44dbe95`, `27450e9` on main).** No further TopBar changes planned.

**Picker plumbing & data flow**
- **D-15:** **New endpoint: `GET /api/admin/prime-users`.** Returns `{ users: PrimeUser[], lastSuccessAt: string, lastError: string | null }`. Auth-gated by `getSession()` + `isAdminEmail()`. Lives in `app/api/admin/prime-users/route.ts`.
- **D-16:** **One fetch per admin page mount.** All three pickers share via small `PrimeDirectoryContext` mounted at the admin page root.
- **D-17:** **No live-resolution endpoint for the audit table.** Reads from the same fetched directory list (via the Context) and resolves in-memory.

**Picker behavior details**
- **D-18:** **Search filter:** case-insensitive substring match across `fullName`, `email`, `division` simultaneously.
- **D-19:** **Keyboard navigation:** arrow keys to move through dropdown, Enter to select, Esc to close, Backspace on empty input to remove the last chip. Use `aria-activedescendant` for accessibility.
- **D-20:** **Empty cache state in picker:** if `getAllPrimeUsers()` returns `[]`, dropdown shows "Prime directory unavailable. Try refreshing." with a refresh button.
- **D-21:** **Loading state:** while fetching `/api/admin/prime-users`, show a small skeleton (existing `LoadingSpinner`) inside the picker container.

**Migration from current state**
- **D-22:** **First-load migration is invisible.** Existing emails are matched against the cached directory: matches → live chips, non-matches → historical chips.
- **D-23:** **Save behavior unchanged.** Picker writes back to `VisibilityConfig.admins` (or group `members`) as before. Hard constraint: blob schema unchanged.

**Test strategy**
- **D-24:** **Continue Vitest harness.** Co-located test files: `components/ui/PrimeUserPicker.test.tsx`, `app/api/admin/prime-users/route.test.ts`. Test areas: filter logic, keyboard nav, chip add/remove, historical detection, empty cache; GET endpoint auth-gating + response shape + cache-empty; audit display live-resolve cascade.
- **D-25:** **No browser/RSC integration tests.** Visual smoke is manual via preview deploy. Expect a HUMAN-UAT.md with picker-specific items.

### Claude's Discretion

- Tailwind class composition for chips, dropdown, refresh button — follow existing admin page register (gray-900 panels, gray-700/800 borders, brand-red focus rings)
- Exact placement of the inline refresh hint within the form layout
- Animation/transition choices (or none)
- Empty-search-input dropdown behavior — recommend "show all" for a 30-user list
- Exact tooltip implementation (native `title` attribute vs custom Tooltip) — recommend native `title`; no custom tooltip exists in `components/ui/`

### Deferred Ideas (OUT OF SCOPE)

- Bulk operations on historical entries ("Remove all historical")
- Global "Prime directory: 5 days old" banner outside the picker context
- Auto-refresh on stale cache beyond Phase 1's 30-day safety net
- Avatar/photo per Prime user (Prime API doesn't expose photos)
- Search within audit log (full-text or per-actor)
- Group label/name editing UX
- Prime-backed admin badge in TopBar
- `/api/prime/jobs/trends` 500 error (separate triage)
- Cleaner BLOB_BASE_URL env value (operational follow-up)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIN-01 | Dashboard Admins input replaced with searchable Prime user picker | `<PrimeUserPicker>` component spec (Standard Stack + Architecture Patterns); existing `adminEmailsRaw` textarea at `app/admin/page.tsx:296` is the swap target |
| ADMIN-02 | Existing group member editing UI replaced with multi-select picker | Same `<PrimeUserPicker>` (`multiSelect=true`); GroupCard at `app/admin/page.tsx:457-490` is the swap target |
| ADMIN-03 | "New Group" form uses the same multi-select picker | Same component instance in the New Group form at `app/admin/page.tsx:329-362` |
| ADMIN-04 | Picker rows show name + email + division; typeahead filters across all three | D-03 dropdown row spec + D-18 substring-on-three-fields filter; "Filter logic" code example in this doc |
| ADMIN-05 | Admin UI preserves & can remove historical entries | D-07/D-08/D-09 historical chip spec + "First-load migration" pattern + Pitfall: ordering of fetch vs config-load |
| DISPLAY-01 | Group member lists render name + division (email secondary), email fallback | D-06 cascade + identity-rich list rendering pattern; reuse picker's name resolver |
| DISPLAY-02 | Dashboard Admins list renders the same way | Same as DISPLAY-01; chip render + read-only render share the resolver |
| DISPLAY-03 | Audit log entries show Prime display name, fall back to email | D-11 live-resolve cascade `livePrimeUser?.fullName?.trim() → entry.name → entry.email`; D-17 in-memory resolver; "Audit live-resolve" code example |

</phase_requirements>

## Summary

Phase 3 is a UI-and-display phase layered on top of two completed backend phases. All hard constraints (Phase 1 directory cache, Phase 2 AuthContext.primeUser, Phase 1 `getAllPrimeUsers()` API, VisibilityConfig blob schema unchanged) are locked. The only meaningful design choices left for the planner are: (1) build the inline combobox by hand vs adopt Headless UI's `<Combobox multiple>` primitive, (2) memoize the directory as a `Map<email, PrimeUser>` once at the Context provider so all 4 consumers (3 pickers + audit table) reuse a single O(1) lookup, and (3) initialize picker state defensively so historical chips never flash "all entries are historical" while the directory loads.

The research finds a strong recommendation for **building the picker by hand** in this case — the inline-combobox-with-chips-below pattern with multi-select + a single chip per persisted email is awkward to express through Headless UI's stock `<Combobox multiple>` (which uses the input as both the search field and the truncated rendering of selected values), the bundle adds a peer-dep that doesn't otherwise exist in the project, and the WAI-ARIA Combobox 1.2 pattern is small enough to implement directly with `aria-activedescendant` + a few well-known keyboard handlers. The custom path also keeps the `selected: string[]` of emails as the canonical state (matching D-23's storage contract) without forcing a `selected: PrimeUser[]` adapter.

Audit-table live-resolve at 200 rows × 60s refresh is trivially cheap with a memoized `Map`; the real risk is forgetting the memoization and re-allocating per render. Picker first-load is the second meaningful risk: between the page mount and the directory fetch resolving, any code that runs the historical-detection check will mis-classify every existing config email as historical. The fix is a tri-state directory (`null | 'loading' | PrimeUser[]`) where the historical chip + the inline refresh hint render only after the directory has resolved.

**Primary recommendation:** Hand-roll the picker against the WAI-ARIA Combobox 1.2 pattern (no new dependency); ship a `PrimeDirectoryContext` exposing `{ status: 'loading' | 'ready' | 'error', users: PrimeUser[], byEmail: Map<string, PrimeUser>, lastSuccessAt: string | null, refresh: () => Promise<void> }`; use it from all three pickers AND the audit table; rely on the existing one-Vitest-per-area harness for coverage; keep the existing `LoadingSpinner` for the brief loading state.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cached Prime directory storage | API (server) | — | Phase 1 already owns the blob via `lib/prime-users.ts`; Phase 3 consumes via `GET /api/admin/prime-users` |
| Directory delivery to admin page | API (server) → Browser (client fetch) | — | New `GET /api/admin/prime-users` returns the cached blob as JSON; admin page fetches once on mount |
| Combobox UI / chip rendering / keyboard nav | Browser (client) | — | All three picker sites are inside the existing `'use client'` admin page; no SSR involvement |
| Cross-component directory sharing | Browser (client, React Context) | — | `PrimeDirectoryContext` mounted at admin page root; consumed by 3 pickers + audit table |
| Email-to-PrimeUser lookup at audit-render time | Browser (client, in-memory `Map`) | — | D-17 explicitly forbids per-row server lookups; client-side `Map` resolution is the only allowed path |
| Picker save → blob write | Browser (client) → API (server) | Vercel Blob (storage) | Existing `POST /api/admin/page-visibility` handles the write — picker only changes the UI that produces the email arrays |
| Force-refresh of directory (refresh button) | Browser (client) → API (server, Phase 1) | Prime API (refresh source) | `POST /api/admin/prime-users/refresh` exists from Phase 1; Phase 3 only adds the click handler + re-fetch of `GET /api/admin/prime-users` after success |

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^18 | Component primitives, useState/useMemo/useContext for the picker + directory context | Already in use; project is React 18 [VERIFIED: package.json] |
| next | 14.2.35 | Client component model + the existing `app/api/admin/*` route surface | Already in use; the new GET endpoint slots into the same App Router pattern [VERIFIED: package.json] |
| typescript | ^5 | Strict typing for `PrimeUser`, picker props, `PrimeDirectoryContext` value | Already in use [VERIFIED: package.json] |
| tailwindcss | ^3.4.1 | Styling chips, dropdown, hint banner — match existing admin visual register | Already in use [VERIFIED: package.json] |
| lucide-react | ^0.577.0 | Icons: `User`, `X`, `RefreshCw`, `AlertTriangle`, `Search` | Already in use; matches existing TopBar/admin icon style [VERIFIED: package.json] |
| vitest | ^4.1.5 | Picker logic + GET endpoint contract tests | Already in use; harness wired in Phase 1 [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vercel/blob | ^2.3.1 | Indirect — picker save still goes via the existing `POST /api/admin/page-visibility` which uses `put()` | Already used by `lib/page-visibility.ts:saveVisibilityConfig`; picker doesn't touch this directly [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled combobox | `@headlessui/react` `<Combobox multiple>` | Adds a new top-level dep (~1MB unpacked, peer of react/react-dom — already satisfied) [VERIFIED: npm view]. Multi-select API uses the input both as search and as a stringified preview of selected items, which fights D-04 "compact chips below the input" — chips would need to live outside the `<Combobox>` and be wired via `value`/`onChange` anyway. The accessibility win is real (aria-activedescendant + keyboard handlers + virtual focus included) [CITED: headlessui.com/react/combobox] but the WAI-ARIA pattern is small enough to replicate. Recommend hand-roll. |
| Hand-rolled combobox | `cmdk` | Designed for command palettes (⌘K); single-select first-class, multi-select requires manual chip layer; brings `command-score` fuzzy ranking that we don't need (D-18 is plain substring) [CITED: github.com/dip/cmdk]. Reject. |
| Hand-rolled combobox | `downshift` | Mature, fully accessible, controlled API — but render-prop / hook-based API has a learning cliff and we'd still write all the chip + dropdown markup. Net win is small for a single picker. Reject. |
| In-memory `Map<email, PrimeUser>` for lookup | `Array.find` per call | At 30 users, both are sub-microsecond. The `Map` wins for the audit table's 200 rows × 60s auto-refresh path; the lookup count is `200 × 1` per render. The `Map` is built once in the Context provider with `useMemo([users])`. Reject `find` for that surface; use both: `Map` for resolution, `Array` for ordered iteration in the dropdown. |
| Native `<select>` | Hand-rolled combobox | A `<select multiple>` doesn't typeahead-filter and doesn't show three-line rich rows. Reject. |

**Installation:** No new packages. Phase 3 uses what's already in `package.json`.

**Version verification:** All listed versions verified against `package.json` [VERIFIED: 2026-04-24]. No registry calls needed.

## Architecture Patterns

### System Architecture Diagram

```
                   ┌──────────────────────────────────────────────┐
                   │  Vercel Blob: shbr-admin/prime-users.json    │
                   │  (Phase 1 cache — schemaVersion 1, indef TTL)│
                   └──────────────────────┬───────────────────────┘
                                          │ getAllPrimeUsers() / refreshPrimeUsers()
                                          ▼
                   ┌──────────────────────────────────────────────┐
                   │  lib/prime-users.ts   (Phase 1, server-only) │
                   │  -- getAllPrimeUsers(), resolveByEmail()     │
                   │  -- refreshPrimeUsers({ reason })            │
                   └────┬─────────────────┬────────────────────┬──┘
                        │                 │                    │
        (Phase 1 POST)  │  (NEW Phase 3)  │   (Phase 2 GET)    │
                        ▼                 ▼                    ▼
   /api/admin/prime-users/refresh   /api/admin/prime-users    /api/auth/session
   (POST, admin-gated)              (GET, admin-gated)        (returns primeUser too)
                        │                 │                    │
                        │       ┌─────────┘                    │
                        │       │                              │
                        │       │   (admin page mount)         │
                        │       ▼                              │
                        │  ┌──────────────────────────────────────────┐
                        │  │  PrimeDirectoryProvider (Context, NEW)   │
                        │  │  state: { status, users, byEmail,        │
                        │  │           lastSuccessAt, refresh }       │
                        │  └─┬─────────┬──────────┬─────────────┬─────┘
                        │    │         │          │             │
                        │    ▼         ▼          ▼             ▼
                        │  Picker    Picker    Picker       AuditTab
                        │ (Admins)  (Group     (New Group   (live-resolve
                        │           members)   members)      cascade)
                        │    │         │          │             │
                        │    └─────────┴──────────┘             │
                        │                │                      │
                        │       chips: live | historical       table rows: name/email
                        │                │                      │
                        │   [Refresh button on hint banner]    [filter: + prime_user_miss]
                        │                │
                        └────────────────┘  (refresh click → POST → re-fetch GET → context update)


   Existing surfaces unchanged:                          Existing surfaces touched:
   - VisibilityConfig blob schema  (HARD CONSTRAINT)    - app/admin/page.tsx VisibilityTab
   - POST /api/admin/page-visibility  (save flow)        - app/admin/page.tsx AuditTab
   - lib/page-visibility.ts                              - app/api/audit/entries/route.ts
   - lib/auth-context.tsx (Phase 2 AuthContext)            (allowlist += prime_user_miss)
```

**Component responsibilities:**

| File | Responsibility |
|------|----------------|
| `app/api/admin/prime-users/route.ts` (NEW) | GET handler — admin-gated read of cached directory + metadata |
| `lib/prime-directory-context.tsx` (NEW) | Client-side `PrimeDirectoryProvider`, `usePrimeDirectory()` hook |
| `components/ui/PrimeUserPicker.tsx` (NEW) | Reusable inline combobox with chips, multi/single mode, historical handling |
| `app/admin/page.tsx` (MODIFY) | Mount `PrimeDirectoryProvider`; replace 3 textareas with picker; extend audit filter dropdown; thread live-resolve through audit row render |
| `app/api/audit/entries/route.ts` (MODIFY, 1 line) | Allowlist `'prime_user_miss'` in the action filter |

### Recommended Project Structure
```
app/
├── admin/
│   └── page.tsx                                    # MODIFY: mount provider, replace 3 inputs, extend audit
├── api/
│   ├── admin/
│   │   └── prime-users/
│   │       ├── route.ts                            # NEW: GET cached directory
│   │       ├── route.test.ts                       # NEW: auth gating + response shape + cache-empty
│   │       └── refresh/route.ts                    # EXISTS (Phase 1) — unchanged
│   └── audit/
│       └── entries/route.ts                        # MODIFY: 1-line allowlist add
components/
└── ui/
    ├── PrimeUserPicker.tsx                         # NEW: the inline combobox
    └── PrimeUserPicker.test.tsx                    # NEW: filter, kbd, chips, historical, empty
lib/
├── prime-directory-context.tsx                     # NEW: Provider + hook + Map memoization
└── prime-directory-context.test.tsx                # OPTIONAL: Map build invariants (small surface)
```

### Pattern 1: Admin-gated GET endpoint (mirror Phase 1)

The new `GET /api/admin/prime-users` mirrors Phase 1's POST refresh route exactly. **Read `app/api/admin/prime-users/refresh/route.ts` first** — the auth gate shape, runtime declaration, and response convention transfer wholesale.

**What:** Two-gate auth (`getSession()` → 401, then `isAdminEmail()` → 403/404), then return the cached blob via Phase 1's existing public read path.

**When to use:** Any new admin-only data endpoint. Already used by `/api/admin/page-visibility` (403) and `/api/admin/prime-users/refresh` (403) — both follow the pattern.

**Example:**
```typescript
// Source: app/api/admin/prime-users/refresh/route.ts (verbatim auth pattern)
// Source: app/api/admin/page-visibility/route.ts (uses 403 — same family)
// Source: app/api/audit/entries/route.ts (uses 404 instead of 403 — see Open Question 1)
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';
import { getCached } from '@/lib/blob-cache';
import type { PrimeUserDirectoryBlob } from '@/lib/prime-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session.userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const config = await getVisibilityConfig();
  if (!isAdminEmail(session.userEmail, config)) {
    // OPEN QUESTION 1: 403 (Phase 1 refresh route) or 404 (audit/entries)?
    // Recommend 403 to match the immediate sibling (refresh route).
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Read the cached blob directly; do NOT call getAllPrimeUsers() because
  // its first-miss bootstrap branch can call Prime, and this GET endpoint
  // must be cheap. If the blob is empty, return [] + lastError so the
  // picker can render D-20's "Prime directory unavailable" state.
  const blob = await getCached<PrimeUserDirectoryBlob>('shbr-admin/prime-users.json');
  return NextResponse.json({
    users: blob?.users ?? [],
    lastSuccessAt: blob?.lastSuccessAt ?? null,
    lastError: blob?.lastError ?? null,
  });
}
```

**Important:** The endpoint must NOT call `getAllPrimeUsers()` from `lib/prime-users.ts` — that function has a first-miss bootstrap branch (Phase 1 D-03) that fires a real Prime API call. The GET endpoint is a pure cache read; admin must explicitly press "Refresh" (which calls the existing POST refresh route) to populate. This preserves the `read = no Prime call, write = admin-driven Prime call` invariant Phase 1 established.

### Pattern 2: PrimeDirectoryContext (Provider + memoized Map + tri-state)

**What:** A small client-side React Context that fetches `GET /api/admin/prime-users` exactly once on mount, exposes the resulting users + a memoized `Map<email, PrimeUser>` for O(1) lookup, tracks loading/ready/error state explicitly, and provides a `refresh()` method that re-fetches after the user clicks the inline refresh hint.

**Why tri-state (`status: 'loading' | 'ready' | 'error'`):** Without it, the picker can't distinguish "directory is still loading, treat all existing emails as live until proven otherwise" from "directory loaded with 0 users, treat all existing emails as historical." This is the root of Pitfall 1 below.

**Example:**
```typescript
// Source: pattern derived from app/admin/page.tsx VisibilityTab.load() (existing fetch shape)
// + lib/auth-context.tsx (existing Provider pattern)

'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PrimeUser } from '@/lib/prime-users';

type DirectoryState =
  | { status: 'loading'; users: []; byEmail: Map<string, PrimeUser>; lastSuccessAt: null; lastError: null }
  | { status: 'ready';   users: PrimeUser[]; byEmail: Map<string, PrimeUser>; lastSuccessAt: string | null; lastError: string | null }
  | { status: 'error';   users: PrimeUser[]; byEmail: Map<string, PrimeUser>; lastSuccessAt: string | null; lastError: string };

interface PrimeDirectoryContextValue extends Omit<DirectoryState, 'users'> {
  users: PrimeUser[];          // always defined (empty array in loading/error)
  status: DirectoryState['status'];
  refresh: () => Promise<void>; // calls POST /api/admin/prime-users/refresh then re-fetches GET
  refreshing: boolean;          // disables the refresh button while in flight
}

const Ctx = createContext<PrimeDirectoryContextValue | null>(null);

export function PrimeDirectoryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DirectoryState>({
    status: 'loading',
    users: [],
    byEmail: new Map(),
    lastSuccessAt: null,
    lastError: null,
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/prime-users');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { users: PrimeUser[]; lastSuccessAt: string | null; lastError: string | null } = await res.json();
      const byEmail = new Map(data.users.map(u => [u.email, u]));
      setState({
        status: 'ready',
        users: data.users,
        byEmail,
        lastSuccessAt: data.lastSuccessAt,
        lastError: data.lastError,
      });
    } catch (err) {
      setState(prev => ({
        status: 'error',
        users: prev.users, // preserve last good list if any
        byEmail: prev.byEmail,
        lastSuccessAt: prev.lastSuccessAt,
        lastError: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch('/api/admin/prime-users/refresh', { method: 'POST' });
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // Memoize the value object so consumers using selectors (or not) don't churn unnecessarily.
  const value = useMemo<PrimeDirectoryContextValue>(() => ({
    ...state,
    refresh,
    refreshing,
  }), [state, refresh, refreshing]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrimeDirectory() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePrimeDirectory must be inside <PrimeDirectoryProvider>');
  return ctx;
}
```

**Key design notes:**
- The `byEmail` Map is built once per `users` change inside the state object — every consumer that calls `byEmail.get(email)` gets O(1).
- `useMemo` on the context value keeps the object reference stable across `refreshing` toggles when `state` hasn't changed (small win; cheap insurance).
- `refresh()` is `useCallback`-stable so the inline refresh button's `onClick={refresh}` doesn't churn its parent.

### Pattern 3: Inline combobox with `aria-activedescendant`

**What:** WAI-ARIA Combobox 1.2 pattern — text input + listbox below, where the input keeps DOM focus and `aria-activedescendant` on the input points to the currently-highlighted listbox option.

**When to use:** All three pickers in this phase.

**Example:**
```tsx
// Source: WAI-ARIA Authoring Practices 1.2 — combobox autocomplete-list pattern
// https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
// Implementation guide: keep DOM focus on the input; move "virtual" focus via aria-activedescendant.

const inputId = useId();
const listboxId = useId();
const [activeIndex, setActiveIndex] = useState<number>(-1);  // -1 = no virtual focus
const [open, setOpen] = useState(false);
const [query, setQuery] = useState('');

const filtered = useMemo(() => {
  const q = query.trim().toLowerCase();
  if (!q) return users; // D-20 / Discretion: show all on empty
  return users.filter(u =>
    u.fullName.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.division?.toLowerCase().includes(q) ?? false)
  );
}, [users, query]);

function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setOpen(true);
    setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActiveIndex(i => Math.max(i - 1, 0));
  } else if (e.key === 'Enter' && activeIndex >= 0 && filtered[activeIndex]) {
    e.preventDefault();
    addEmail(filtered[activeIndex].email);
    setQuery('');
    setActiveIndex(-1);
  } else if (e.key === 'Escape') {
    setOpen(false);
    setActiveIndex(-1);
  } else if (e.key === 'Backspace' && query === '' && selected.length > 0) {
    e.preventDefault();
    removeEmail(selected[selected.length - 1]);
  }
}

return (
  <div className="...">
    {/* Chips first (live + historical sorted alphabetically — D-05/D-09) */}
    <div className="flex flex-wrap gap-1 mb-2">
      {sortedSelected.map(s => <Chip key={s.email} {...s} onRemove={removeEmail} />)}
    </div>
    {/* Input + listbox */}
    <input
      id={inputId}
      role="combobox"
      aria-controls={listboxId}
      aria-expanded={open}
      aria-autocomplete="list"
      aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
      value={query}
      onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(0); }}
      onFocus={() => setOpen(true)}
      onBlur={() => setTimeout(() => setOpen(false), 100)}  // delay so click on option fires first
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className="..."
    />
    {open && (
      <ul id={listboxId} role="listbox" className="...">
        {filtered.length === 0 && <li className="...">No matches</li>}
        {filtered.map((u, i) => (
          <li
            key={u.id}
            id={`${listboxId}-opt-${i}`}
            role="option"
            aria-selected={i === activeIndex}
            onMouseDown={e => e.preventDefault()}      // keep input focus on click
            onClick={() => { addEmail(u.email); setQuery(''); }}
            className={i === activeIndex ? '... bg-gray-700' : '...'}
          >
            <div className="text-sm text-white">{u.fullName}{u.division ? ` · ${u.division}` : ''}</div>
            <div className="text-xs text-gray-500">{u.email}</div>
          </li>
        ))}
      </ul>
    )}
  </div>
);
```

**Critical implementation notes:**
- `onMouseDown={e => e.preventDefault()}` on the listbox option is the canonical fix for "click-on-option fires blur first → option vanishes before click registers." Without this the picker feels broken.
- `onBlur` close has a 100ms timeout for the same reason; alternative is to use `onMouseDown` to register the click instead of `onClick`.
- `aria-activedescendant` MUST point to a real DOM id (`${listboxId}-opt-${i}`); the option `id` MUST match.
- `aria-selected` indicates the *currently-virtual-focused* option, not the *committed/already-picked* state. For multi-select picker semantics, "already added to chips" is communicated visually (e.g., dim the row) and via `aria-disabled="true"` if you want to prevent re-add.

### Pattern 4: Audit live-resolve cascade

**What:** Per audit row, resolve the actor's display name via the cascade `livePrimeUser?.fullName?.trim() → entry.name → entry.email` using the in-memory `Map` from the directory context.

**When to use:** Inside `<AuditTab>` row render at `app/admin/page.tsx:626-635`.

**Example:**
```tsx
// Source: pattern derived from D-11 cascade + the existing audit row at app/admin/page.tsx:629-632
const { byEmail } = usePrimeDirectory();

// Build per-row resolution. byEmail.get is O(1); 200 rows × O(1) = trivial.
{entries.map(entry => {
  const live = byEmail.get(entry.email.toLowerCase());
  // D-11 cascade: live → saved → email
  const displayName = live?.fullName?.trim() || entry.name || entry.email;
  // D-12: only show secondary email line when name resolved (avoid email/email duplication)
  const showEmailLine = displayName !== entry.email;
  return (
    <tr key={entry.id} ...>
      <td ...>{formatAEDT(entry.timestamp)}</td>
      <td>
        <div className="text-gray-300 text-sm">{displayName}</div>
        {showEmailLine && <div className="text-gray-600 text-xs">{entry.email}</div>}
      </td>
      <td><ActionBadge action={entry.action} /></td>
    </tr>
  );
})}
```

**Performance note:** The audit table re-renders every 60s (existing interval at `app/admin/page.tsx:564`). With the `Map` built once in the Provider and a stable Provider value (memoized), each re-render is 200 × O(1) lookups + 200 × small JSX — well under 1ms total. No further memoization needed at the row level. Validated by D-11's "negligible" assertion.

### Anti-Patterns to Avoid

- **Calling `getAllPrimeUsers()` from the new GET endpoint:** triggers Phase 1's first-miss bootstrap on every cold deploy load → silent extra Prime call. Read the blob directly via `getCached()`. Phase 1 D-03 was scoped to login + admin refresh; the picker GET is a passive read.
- **Building the `byEmail` Map inside a child component:** every render rebuilds a 30-entry Map. Build it once in the Provider (`useMemo([users])`). Tiny per call but the principle (memoize derived state at the source) prevents accidental drift.
- **Letting `selected` be `PrimeUser[]` instead of `string[]` (emails):** D-23 mandates the saved blob shape stay as email arrays. If the picker holds objects internally, every save site needs to map back to emails — error-prone. Keep the canonical state as `string[]` and resolve to display objects at render time only.
- **Treating "directory not yet loaded" as "directory empty":** see Pitfall 1.
- **Forgetting `onMouseDown={e => e.preventDefault()}` on listbox options:** the picker will appear to ignore clicks because `onBlur` closes the listbox before the click handler fires. Classic combobox trap.
- **Reading `lastSuccessAt` as a `Date` and computing "X days ago" inside the render path on every tick:** the audit table re-renders every 60s; if the inline refresh hint depends on a fresh `Date.now()` calculation each render, it'll look fine but waste cycles. Cheap fix: the timestamp string is fine inside React; format with `Intl.RelativeTimeFormat` once per render and accept that it can be off by ≤60s.
- **Adding `prime_user_miss` to the audit filter `<select>` but forgetting the API allowlist (or vice versa):** the filter dropdown will silently drop the action filter param if the API rejects it. Both must change together — covered by D-13's three-step list and the test in D-24.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth + Prime token refresh | A new Prime client | `lib/prime-auth.ts:primeGet()` (already wraps token cache, 429 retry, 401 token refresh, 1.1s pagination throttle) | Phase 3 doesn't call Prime directly — refresh goes through Phase 1's POST route which already uses the wrapper |
| Email normalization | A normalize helper | `.trim().toLowerCase()` inline (matches `lib/page-visibility.ts:125`, `app/api/auth/login/route.ts:78`, `lib/prime-users.ts:218`) | Convention in the codebase; a wrapper would be one-liner indirection |
| Cached directory storage | A new blob layer | Phase 1's `lib/prime-users.ts` + `lib/blob-cache.ts` | Already done. Phase 3 only adds the GET endpoint that reads the blob |
| Iron-session admin gating | A custom auth check | `getSession()` + `isAdminEmail(session.userEmail, config)` (the established two-gate pattern) | Used by every admin endpoint already; consistency is the win |
| Tooltip for division/email on hover | A `<Tooltip>` component | Native `title` attribute on the chip element | No tooltip primitive in `components/ui/`; native tooltips are accessible by default and the picker doesn't justify introducing a new primitive (CONTEXT.md Discretion notes) |
| Time-ago formatting ("5 days ago") | A custom date diff helper | `Intl.RelativeTimeFormat` (browser built-in) | No date lib in deps; the existing audit timestamp uses `toLocaleString('en-AU')` directly. Prefer built-ins |
| Combobox accessibility | An ARIA-from-scratch combobox | Follow WAI-ARIA Authoring Practices 1.2 pattern verbatim (Pattern 3 above) | The pattern is well-defined; we follow it rather than invent. Headless UI is rejected on UX-fit grounds, not on accessibility grounds |

**Key insight:** Phase 1 + Phase 2 already built the heavy infrastructure (cache, refresh, admin gating, AuthContext). Phase 3 is a thin display layer. The only meaningfully novel thing being built is the inline combobox UI itself — and its primitive (`<input>` + `<ul>` + ARIA attributes) is well-understood vanilla React. There is no library that fits better than the hand-roll for this specific (a) state shape (`string[]` of emails, not objects) and (b) layout (chips below, not inside, the input).

## Runtime State Inventory

> Phase 3 is a UI/display phase, not a rename or migration. The runtime-state inventory still applies because we are introducing a new API endpoint and the storage shape is constrained.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `shbr-admin/prime-users.json` Vercel Blob (Phase 1) — read-only consumer in this phase. `shbr-admin/page-visibility.json` Vercel Blob (existing) — picker writes to it via existing `POST /api/admin/page-visibility`, schema unchanged (D-23). `audit/audit-log.json` Vercel Blob — read-only consumer; `prime_user_miss` rows already write here from Phase 2. | None — no data migration needed; D-22 explicitly verifies the existing email arrays already match the picker's input shape |
| Live service config | None — this phase doesn't change Vercel routes, env vars, or external service config | None |
| OS-registered state | None — Vercel hosting; no OS-level service registrations involve directory or audit state | None |
| Secrets/env vars | `BLOB_READ_WRITE_TOKEN` (existing) read by `lib/prime-users.ts` and `lib/page-visibility.ts`. `BLOB_BASE_URL` / `BLOB_CACHE_BASE_URL` (existing). `ADMIN_EMAIL` (existing) — referenced by `isAdminEmail()` for the env-admin path. | None — no new env vars; new GET endpoint reads via the same `getCached()` path that already uses these |
| Build artifacts/installed packages | None new — no dependencies added | None |

**Nothing found in category — verified by:** Read of `app/api/admin/prime-users/refresh/route.ts`, `lib/prime-users.ts`, `lib/page-visibility.ts`, `lib/audit.ts`, `vercel.json` (no new cron entries needed), `package.json` (no new deps).

## Common Pitfalls

### Pitfall 1: First-load false-historical flash
**What goes wrong:** On first mount of the Visibility tab, `config.admins` is loaded from `/api/admin/page-visibility` and the picker's `selected` is set to the existing email array. If the directory hasn't yet resolved (status='loading'), every existing email looks like a "no match" → all chips render as historical italic-gray, and the inline refresh hint shouts "8 entries not found." A second later the directory resolves and chips re-render correctly. Users see the flash; admins panic-click "Refresh."

**Why it happens:** The existing admin page initializes `adminEmailsRaw` from `config.admins` synchronously on the load callback (`app/admin/page.tsx:150`). The picker's historical-detection check runs against `usePrimeDirectory().byEmail` which starts as an empty Map. Empty Map → all emails are "missing" → all historical.

**How to avoid:** The Provider's `status: 'loading'` field gates the historical determination. While `status === 'loading'`, the picker treats every email as "indeterminate" and renders a generic chip (no name, no historical styling — just the email in normal-weight gray). Only when `status` transitions to `'ready'` does the picker classify each chip as live-or-historical and (if any are historical) show the refresh hint.

**Warning signs:** Visual flicker on first page load. UAT comment: "When I open the page, all admins look removed and then come back." If you see this in the preview deploy, the tri-state isn't wired through the picker.

### Pitfall 2: Combobox option click swallowed by input blur
**What goes wrong:** User clicks a row in the dropdown, nothing happens. The dropdown closes instead.
**Why it happens:** Default browser behavior — clicking outside an input fires `blur` first, which closes the dropdown via the `onBlur` handler, *then* the listbox option's `onClick` would fire — but the option is already unmounted, so nothing happens.
**How to avoid:** Either (a) use `onMouseDown={e => e.preventDefault()}` on the option (preserves input focus through the click — recommended), or (b) delay the `onBlur` close with `setTimeout(close, 100)` so the click registers first. Pattern 3 above shows both belt-and-braces.
**Warning signs:** First-attempt "I can't add anyone" UAT report.

### Pitfall 3: Audit re-render rebuilds the directory Map
**What goes wrong:** Audit table re-renders every 60s; if the `Map<email, PrimeUser>` is built inside `<AuditTab>` (via `useMemo` keyed on something that changes), it's rebuilt for nothing every minute. At 30 entries the cost is negligible, but the *pattern* is wrong and will hurt anywhere it's repeated.
**Why it happens:** Tempting to put the Map construction in the consumer for "locality." The right place is the Provider — one Map per directory load, shared by all consumers.
**How to avoid:** The Provider builds `byEmail` once per `users` change (Pattern 2 example above does this inside the `setState` call so the Map is part of state). Consumers consume; they never derive.
**Warning signs:** None visible; this is a code-review catch.

### Pitfall 4: Saving picker output that contains uppercase / whitespace emails
**What goes wrong:** Picker emits `selected: ['Jane.Doe@SHBR.COM']`; saved blob's `admins` array now has a mixed-case email. `isAdminEmail()` lowercases on compare, so functionality survives — but the audit log writes the lowercase email and the picker shows the mixed-case version, so historical-detection breaks (lowercase audit row email vs mixed-case picker email → no Map match → false historical).
**Why it happens:** The picker sources emails from the cached `PrimeUser.email` field, which Phase 1 already normalizes (`mapRawToPrimeUser` lowercases on store, `lib/prime-users.ts:105`). The risk is in two adjacent paths: (a) the existing `POST /api/admin/page-visibility` re-normalizes admin emails (`route.ts:53` lowercases). (b) The picker's "I'm typing a literal email and pressing enter" path — but D-01/D-18 don't allow free-text-entry; only click-to-add-from-dropdown.
**How to avoid:** Treat picker output as already-lowercase by construction (it sources from `PrimeUser.email` which Phase 1 guarantees normalized). Verify by adding a Vitest case: "picker `onChange` only emits lowercase emails." The `POST /api/admin/page-visibility` normalization stays as belt-and-braces.
**Warning signs:** Historical-detection is wrong for some users despite the directory being current.

### Pitfall 5: GET endpoint that calls Prime
**What goes wrong:** `GET /api/admin/prime-users` is implemented as `getAllPrimeUsers()` instead of a raw blob read. On a fresh deploy with no blob, the picker mount fires a Prime API call. With an admin browser, this happens once per admin per page load.
**Why it happens:** `getAllPrimeUsers()` is the obvious public API; using `getCached()` directly looks like reaching past it.
**How to avoid:** The GET endpoint reads the blob with `getCached<PrimeUserDirectoryBlob>('shbr-admin/prime-users.json')` and returns `users: blob?.users ?? []`. If empty, the picker shows D-20's empty state with a refresh button (which routes through the *POST* endpoint, where the Prime call is acceptable and admin-driven).
**Warning signs:** Spike in Prime API call count after deploy; admin sees a slow first picker mount.

### Pitfall 6: Audit filter dropdown change without API allowlist change
**What goes wrong:** User selects "Prime miss" in the filter, the dropdown sends `?action=prime_user_miss` to the API, the API's allowlist (`['login', 'logout']`) silently drops it, no rows are filtered → user sees all rows still and assumes the filter is broken.
**Why it happens:** D-13 calls out three changes; missing one is easy.
**How to avoid:** Vitest case for the API: "filters by `action=prime_user_miss` correctly." The test reads from a mocked audit log with mixed actions and asserts the filter narrows the result set.
**Warning signs:** Filter dropdown appears to do nothing.

### Pitfall 7: Multi-paste of emails into the picker (out-of-scope but worth flagging)
**What goes wrong:** Admin pastes "alice@x.com, bob@x.com, carol@x.com" into the picker input expecting all three to be added (matching the legacy textarea behavior). The picker treats it as a single search query, finds no match, shows "No matches" — admin loses three emails of typing.
**Why it happens:** The migration replaces a multi-paste-tolerant textarea with a single-add picker.
**How to avoid:** **Out of scope for Phase 3 per CONTEXT.md** — D-01/D-18 specify a single click-to-add interaction. But: (a) document this in the picker's HUMAN-UAT.md so the admin doesn't get confused, (b) optional follow-up: detect a comma/newline in the input and split-and-add — keep on a deferred-ideas list. Do not silently lose paste content; either no-op explicitly or explain via empty-state copy ("Paste detected — pick from the list one at a time.").
**Warning signs:** Admin reports "I pasted my list and nothing happened."

## Code Examples

### Detecting historical entries (D-22)
```typescript
// Source: pattern from D-07 + Pitfall 1 mitigation (tri-state directory)
const { status, byEmail } = usePrimeDirectory();

// During loading: don't classify anything as historical yet (Pitfall 1).
const isHistorical = (email: string): boolean => {
  if (status !== 'ready') return false;
  return !byEmail.has(email.toLowerCase());
};

// Once status === 'ready', historical = "we have a complete snapshot and this email isn't in it"
```

### Sorting selected entries alphabetically (D-05/D-09)
```typescript
// Source: D-05/D-09 — both live and historical chips sort alphabetically
// Live chips sort by Prime fullName; historical chips sort by email value (no name available)

const sortedChips = useMemo(() => {
  return selected
    .map(email => {
      const u = byEmail.get(email.toLowerCase());
      return u
        ? { kind: 'live' as const, email, sortKey: u.fullName.toLowerCase(), user: u }
        : { kind: 'historical' as const, email, sortKey: email.toLowerCase() };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}, [selected, byEmail]);
```

### Filter logic for picker (D-18 — substring across 3 fields)
```typescript
// Source: D-18 — case-insensitive substring across fullName, email, division
const filtered = useMemo(() => {
  const q = query.trim().toLowerCase();
  if (!q) return users; // Discretion: show all on empty input (30-user list)
  return users.filter(u =>
    u.fullName.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.division?.toLowerCase().includes(q) ?? false)
  );
}, [users, query]);
```

### Inline refresh hint (D-10)
```tsx
// Source: D-10 — pluralization rule, last-refresh timestamp, refresh button
const { lastSuccessAt, refresh, refreshing } = usePrimeDirectory();
const historicalCount = sortedChips.filter(c => c.kind === 'historical').length;

if (status === 'ready' && historicalCount > 0) {
  const ago = formatRelative(lastSuccessAt); // e.g. "5 days ago" via Intl.RelativeTimeFormat
  return (
    <div className="flex items-center gap-2 px-3 py-2 mt-2 rounded bg-amber-950/30 border border-amber-800/60 text-xs text-amber-300">
      <AlertTriangle size={13} className="flex-shrink-0" />
      <span>
        {historicalCount} entr{historicalCount === 1 ? 'y' : 'ies'} not found in current directory snapshot.
        {lastSuccessAt && <> Last refresh: {ago}.</>}
      </span>
      <button
        onClick={refresh}
        disabled={refreshing}
        className="ml-auto flex items-center gap-1 text-amber-400 hover:text-amber-300 disabled:opacity-50"
      >
        <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        Refresh Prime directory
      </button>
    </div>
  );
}
```

### Audit row resolver (D-11/D-12)
See Pattern 4 above — verbatim drop-in for `app/admin/page.tsx:626-635`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-text textarea for admin emails (`adminEmailsRaw` at `app/admin/page.tsx:296`) | Inline searchable combobox sourced from cached Prime directory | Phase 3 | Admins type names not emails; no typo risk; auto-discovery of new hires after refresh |
| Free-text textarea for group members (`GroupCard` at `app/admin/page.tsx:478-484`) | Same combobox in multi-select mode | Phase 3 | Same UX win for groups |
| Email-only audit row (`{entry.name || entry.email}` at `app/admin/page.tsx:630`) | Live-resolve cascade `live → saved → email` with secondary email line | Phase 3 | Names match the admins' mental model of who did what; stays correct as Prime updates |
| Audit filter on `login`/`logout` only | Filter includes `prime_user_miss` | Phase 3 (D-13) | Closes Phase 2 paper cut; admins can isolate Prime miss events |
| Per-page Prime API call for `/users` (in `team/route.ts`, `estimators/route.ts`, `ops/route.ts`) | These remain unchanged in Phase 3 (callout only) | Phase 1 deferred this cleanup | Backlog; not a Phase 3 task |

**Deprecated/outdated:**
- The textarea pattern for member-list editing is functionally deprecated by this phase but the code is removed (not gated) — there's no transition period.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The new GET endpoint should return 403 (matching Phase 1 refresh route) rather than 404 (matching `/api/audit/entries`). | Pattern 1 / Open Question 1 | Low — both work; 403 is more accurate ("forbidden") and matches the immediate sibling route. Planner can flip to 404 for symmetry with the audit route if preferred. [ASSUMED] |
| A2 | The directory will have ≤ 30 PrimeUser records at SHBR (per CONTEXT.md "SHBR has ~30 Prime users"). At larger scales (100s), client-side filter remains fine but the GET payload and the in-memory Map grow linearly. | Architecture (D-15 fetch-once-and-filter-client-side) | Low at current scale; medium if SHBR ever 10×s. [CITED: CONTEXT.md D-01 + Phase 1 D-01 "~30-person business"] |
| A3 | `Intl.RelativeTimeFormat` is available in all browsers the dashboard targets. (No browser-support matrix is documented in the codebase.) | Code Examples — `formatRelative()` | Very low — `Intl.RelativeTimeFormat` is supported in every browser >= 2020. [ASSUMED] |
| A4 | The picker does not need to support free-text entry of arbitrary emails (i.e., admins cannot add an email that isn't in the Prime directory). CONTEXT.md D-01 specifies "click a result to add" with no free-text path. | Pitfall 7 (multi-paste) and the behavior tree generally | Low — explicitly locked by D-01. If an admin needs to add a non-Prime email (e.g., a brand-new hire not yet in Prime), they must refresh first or fall back to JSON edit (out of scope). [CITED: CONTEXT.md D-01] |
| A5 | The picker initial-state derivation (existing email array → live/historical chips) happens on the client, not at SSR time. The admin page is `'use client'` already (`app/admin/page.tsx:1`). | Pattern 2 + Pitfall 1 | None — verified by reading the file. [VERIFIED: app/admin/page.tsx:1] |

**If this table is empty:** N/A — 4 of 5 assumptions are low/very-low risk; A1 is the only one the planner should explicitly confirm.

## Open Questions

1. **GET endpoint forbidden response: 403 or 404?**
   - What we know: `/api/admin/prime-users/refresh` returns 403 (Phase 1); `/api/audit/entries` returns 404 (existing code at `app/api/audit/entries/route.ts:18`); `/api/admin/page-visibility` returns 403.
   - What's unclear: which is the project's preference. Two of three admin endpoints use 403. The audit one was likely 404 to avoid leaking the existence of the endpoint to non-admins.
   - Recommendation: 403 — matches the immediate sibling endpoint (`/refresh`). The picker is admin-only by design and the URL is not a secret (it's referenced from admin-only client code).

2. **Where should `<PrimeDirectoryProvider>` mount — at `<AdminPage>` root or at `<VisibilityTab>` root?**
   - What we know: Three pickers live inside `<VisibilityTab>`; the audit table lives inside `<AuditTab>`. Both are siblings under `<AdminPage>`.
   - What's unclear: Audit tab also needs the directory (D-17), so mounting only at `<VisibilityTab>` would force a duplicate fetch when the user switches tabs.
   - Recommendation: Mount at `<AdminPage>` root (the whole tab container). Both tabs are sibling consumers; provider survives tab switches; one fetch on admin-page mount.

3. **Should the picker re-fetch the directory when the admin tab gains focus after being inactive?**
   - What we know: The existing audit table auto-refreshes every 60s; the directory does not auto-refresh.
   - What's unclear: If an admin opens the page, then switches tabs, comes back an hour later, should the directory re-fetch silently?
   - Recommendation: No. Phase 1 D-01 commits to "refresh is on-demand only." The page-mount fetch + the explicit refresh button are the only paths. If staleness becomes a UX problem, revisit in v2.

4. **Where does `formatRelative()` live (utility file location)?**
   - What we know: No date-formatting helper module exists in `lib/`; `formatAEDT` is inline in `app/admin/page.tsx:499`.
   - Recommendation: Inline in `components/ui/PrimeUserPicker.tsx` (or a tiny helper file `lib/format-relative.ts` if reused). 8 lines wrapping `Intl.RelativeTimeFormat`. Don't introduce a date library.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (Next.js runtime) | All routes | ✓ | per Vercel runtime | — |
| `@vercel/blob` | Indirect (existing storage) | ✓ | 2.3.1 | — |
| iron-session | Auth gate on new GET | ✓ | 8.0.4 | — |
| Vitest | Picker + endpoint tests | ✓ | 4.1.5 | — |
| `vite-tsconfig-paths` | Test path aliases | ✓ | 6.1.1 | — |
| Vercel Blob env vars (`BLOB_READ_WRITE_TOKEN`, `BLOB_BASE_URL`/`BLOB_CACHE_BASE_URL`) | Existing — read by `lib/page-visibility.ts` and `lib/blob-cache.ts` | ✓ (production deployed) | — | If absent locally → existing code returns DEFAULT_CONFIG; picker would show D-20 empty state |
| Prime API connectivity (only via refresh button) | Refresh path uses Phase 1 endpoint | ✓ (live) | — | If unreachable → refresh button shows error; picker continues with stale directory (Phase 1 D-17) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — all dependencies are already installed and verified by the Phase 1/Phase 2 work that landed before this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (Node environment) |
| Config file | `vitest.config.ts` (root) — `include: ['lib/**/*.test.ts', 'app/**/*.test.ts']` |
| Quick run command | `npm test -- {pattern}` (e.g. `npm test -- prime-users`) |
| Full suite command | `npm test` |

**⚠ Wave 0 finding:** The current `vitest.config.ts` `include` glob is `['lib/**/*.test.ts', 'app/**/*.test.ts']` — TypeScript only, not `.tsx`. The picker test file is `components/ui/PrimeUserPicker.test.tsx`. **Wave 0 must extend the include glob** to `['lib/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}']` and (because the picker test renders React) configure a JSDOM environment for that path or set the test environment to `'jsdom'` globally. See Wave 0 Gaps.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | Picker replaces admin textarea: renders, accepts onChange, emits selected emails | unit (component) | `npm test -- PrimeUserPicker` | ❌ Wave 0 |
| ADMIN-02 | Picker `multiSelect=true` mode: add/remove multiple chips | unit (component) | `npm test -- PrimeUserPicker -t 'multi-select'` | ❌ Wave 0 |
| ADMIN-03 | Picker reused in New Group form (instance shape) | manual (component is the same — instance reuse is composition) | preview deploy UAT | ❌ (manual) |
| ADMIN-04 | Filter substring across name/email/division | unit | `npm test -- PrimeUserPicker -t 'filter'` | ❌ Wave 0 |
| ADMIN-05 | Historical entries preserved + removable | unit | `npm test -- PrimeUserPicker -t 'historical'` | ❌ Wave 0 |
| DISPLAY-01 | Group member list renders name + division (email secondary) | unit (component) | `npm test -- PrimeUserPicker -t 'chip render'` | ❌ Wave 0 |
| DISPLAY-02 | Admin list renders the same | unit (same render path) | `npm test -- PrimeUserPicker -t 'chip render'` | ❌ Wave 0 |
| DISPLAY-03 | Audit row uses live → saved → email cascade | unit (audit row helper or AuditTab snapshot) | `npm test -- audit -t 'cascade'` | ❌ Wave 0 |
| (D-13) | `/api/audit/entries` allowlist accepts `prime_user_miss` | unit (route) | `npm test -- audit/entries` | ❌ Wave 0 |
| (D-15) | `GET /api/admin/prime-users` admin gating + response shape + cache-empty | unit (route) | `npm test -- admin/prime-users/route` | ❌ Wave 0 |
| (D-22) | Tri-state directory: status=loading masks historical detection | unit (component or hook) | `npm test -- PrimeUserPicker -t 'loading'` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- {file-under-edit}` (filter to the changed area, ≤ 30s)
- **Per wave merge:** `npm test` (full Vitest suite — currently ~2-3s, will grow modestly with picker tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`; manual UAT against the preview deploy (HUMAN-UAT.md per D-25) covers the visual layer

### Wave 0 Gaps
- [ ] `vitest.config.ts` — extend `include` to cover `.tsx` and add `components/**` pattern; switch test environment for picker tests to `'jsdom'` (either globally with `environment: 'jsdom'` or per-file via `// @vitest-environment jsdom`)
- [ ] Add dev dependency: `jsdom` (Vitest's documented JSDOM provider) — Vitest 4 includes JSDOM via `@vitest/web-worker`/`environment-jsdom`; check the dep is implicit, otherwise `npm install -D jsdom @testing-library/react @testing-library/user-event` for component testing ergonomics
- [ ] `components/ui/PrimeUserPicker.test.tsx` — covers ADMIN-01..05, DISPLAY-01..02, D-22 loading invariant
- [ ] `app/api/admin/prime-users/route.test.ts` — covers D-15 admin gating + cache-empty + response shape; mocks `@/lib/session`, `@/lib/page-visibility`, `@/lib/blob-cache` at the module boundary (matches the established Phase 1/2 pattern in `lib/prime-users.test.ts` and `app/api/auth/session/route.test.ts`)
- [ ] `app/api/audit/entries/route.test.ts` — new file OR extend the Phase 2 audit-related tests to cover the `prime_user_miss` allowlist add (D-13)
- [ ] `app/admin/audit-resolve.test.ts` (or co-located audit row helper test) — covers D-11 cascade resolution branches: live-hit, live-miss-saved-hit, live-miss-saved-miss-email-only, name=null, name=whitespace-only

**Why we can't reuse the existing `app/api/admin/prime-users/refresh` test:** Per directory listing, no `route.test.ts` exists for the refresh route; Phase 1 tested via `lib/prime-users.test.ts` (which mocks the inner module). The new GET route needs its own test file because its surface (auth gating + empty-cache pass-through) differs.

## Sources

### Primary (HIGH confidence)
- Codebase reads — exact line references throughout this doc:
  - `app/admin/page.tsx` (admin UI shape, audit tab, filter dropdown line 587, action types)
  - `lib/prime-users.ts` (Phase 1 API contract)
  - `lib/page-visibility.ts` (VisibilityConfig schema, isAdminEmail two-gate auth)
  - `lib/audit.ts` (AuditEntry shape, action union)
  - `lib/auth-context.tsx` (Phase 2 AuthContext + primeUser)
  - `app/api/admin/prime-users/refresh/route.ts` (auth pattern to mirror for GET)
  - `app/api/audit/entries/route.ts` (existing allowlist at line 35)
  - `app/api/admin/page-visibility/route.ts` (existing 403 admin pattern)
  - `components/ui/AuthGuard.tsx` (Provider mount + session-fetch shape)
  - `components/ui/TopBar.tsx` (Phase 2 cascade pattern reference)
  - `vitest.config.ts` (test include glob — Wave 0 gap)
  - `package.json` (no new deps needed)
- W3C WAI-ARIA Authoring Practices 1.2 — Combobox pattern (`aria-activedescendant`, virtual focus)

### Secondary (MEDIUM confidence)
- Headless UI React Combobox docs — multi-select API, "by" prop, keyboard interactions (verified for the rejection rationale)
- npm registry — verified versions of `@headlessui/react@2.2.10`, `cmdk@1.1.1`, `downshift@9.3.2`

### Tertiary (LOW confidence)
- General React Context performance discussion — no findings flagged LOW; the Map-vs-find decision is grounded in ordinary algorithmic reasoning at this scale

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against `package.json`; recommendation is "use what's installed"
- Architecture: HIGH — Pattern 1 mirrors existing Phase 1 code verbatim; Pattern 2 is a small Provider with documented React idioms; Patterns 3-4 are W3C-spec primitives
- Pitfalls: HIGH — most are derived from concrete code-level invariants (Pitfalls 1, 3, 5, 6) or widely documented combobox traps (Pitfall 2)
- Test strategy: HIGH — extends the established Phase 1/2 Vitest harness, with one Wave 0 config gap (TSX include + JSDOM env) clearly identified

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days; the Phase 1/2 contracts and admin page structure are stable)

---

Sources:
- [W3C WAI-ARIA APG — Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [Headless UI React Combobox](https://headlessui.com/react/combobox)
- [cmdk on GitHub](https://github.com/dip/cmdk)
- [React useMemo reference](https://react.dev/reference/react/useMemo)
