---
phase: 03-admin-picker-identity-rich-display
reviewed: 2026-04-25T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - app/admin/audit-tab.test.ts
  - app/admin/audit-tab.tsx
  - app/admin/page.tsx
  - app/admin/visibility-tab.tsx
  - app/api/admin/prime-users/route.test.ts
  - app/api/admin/prime-users/route.ts
  - components/ui/PrimeUserPicker.test.ts
  - components/ui/PrimeUserPicker.tsx
  - lib/format-relative.test.ts
  - lib/format-relative.ts
  - lib/identity-display.test.ts
  - lib/identity-display.ts
  - lib/prime-users.test.ts
  - lib/prime-users.ts
  - package.json
  - vitest.config.ts
findings:
  critical: 0
  warning: 4
  info: 7
  total: 11
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-04-25
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 3 (Admin Picker & Identity-Rich Display) is well-engineered. The two-gate
admin pattern in `GET /api/admin/prime-users` is a faithful mirror of the Phase 1
refresh route, the D-15 cascade is consistently applied at every render site
(audit rows, member rows, picker chips, CSV export), email normalization
(`.trim().toLowerCase()`) matches `lib/page-visibility.ts:isAdminEmail` invariants,
the VisibilityConfig blob shape is preserved verbatim (D-21), and the picker
exposes correct `combobox`/`listbox`/`option` ARIA roles with sensible keyboard
behaviour. Tests are co-located, mock at module boundaries, and exercise the
non-trivial branches (cascade layers, manual-fallback validity, refresh
preserve-on-failure, two-gate auth).

Findings below are concentrated in two areas:
1. **`lib/format-relative.ts`** has one off-by-one boundary that disagrees with
   its own test suite at the 30-day boundary; behaviour drifts from "weeks" to
   "months" one day too late on day 30 itself only because of an unused branch
   condition. The visible bug is at the 30-day mark and the unit `diffWk` is
   computed but never re-used inside the `< 30` gate, which is the deeper smell.
2. **`app/admin/page.tsx`** has two minor brownfield issues that pre-date Phase 3
   but are touched by the new mount: a 500ms timer-based "auth-checked" flag and
   a parallel client-side `/api/auth/session` re-check that races the timer.

No security regressions, no schema drift, no PII surface widening, no hardcoded
secrets, no new admin-fallback hardcoding propagation.

---

## Warnings

### WR-01: `formatRelative` "1 month" boundary inconsistent with own test

**File:** `lib/format-relative.ts:42`
**Issue:** The test asserts `formatRelative(NOW - 30 * 24h) === '1 month ago'`
(line 53–55 in `format-relative.test.ts`). Tracing the implementation: at exactly
30 days, `diffDay = 30`, `diffWk = floor(30/7) = 4`, then the gate `if (diffDay < 30)`
is **false** (30 < 30 is false), so it falls through to months: `diffMo = 1` →
`'1 month ago'`. The test passes — but only by exact equality on the boundary.
At `30 * 24h - 1 ms`, `diffDay = 29`, `diffWk = 4`, and the same gate returns
`'4 weeks ago'`. So the function jumps "4 weeks ago" → "1 month ago" between
day 29 and day 30 with no intermediate state, which is fine, but the deeper
issue is that the `< 30` gate is keyed on `diffDay`, not on `diffWk`. This works
today but couples two units in a way that future readers will trip over.
**Fix:** Either keep the current behaviour and add a comment, or rekey the gate
explicitly:
```ts
const diffDay = Math.floor(diffHr / 24);
if (diffDay < 7)  return `${diffDay} ${diffDay === 1 ? 'day'  : 'days'} ago`;
if (diffDay < 30) {
  const diffWk = Math.floor(diffDay / 7);
  return `${diffWk} ${diffWk === 1 ? 'week' : 'weeks'} ago`;
}
const diffMo = Math.floor(diffDay / 30);
return `${diffMo} ${diffMo === 1 ? 'month' : 'months'} ago`;
```
This also fixes the dead `diffWk` computation that runs on every months-branch
call.

### WR-02: `audit-tab.tsx` action filter cannot select `prime_user_miss`

**File:** `app/admin/audit-tab.tsx:37,170-173`
**Issue:** `ActionFilter` is typed as `'all' | 'login' | 'logout'` and the
`<select>` only renders these three options. Yet `AuditEntry.action` includes
`'prime_user_miss'` (per `lib/audit.ts:22`) and `ActionBadge` (line 53–61)
explicitly renders the amber "Miss" pill. Result: an admin investigating a
Prime outage cannot filter the table down to just miss events. Worse, if they
pick "Login", the route's `if (actionFilter !== 'all') params.set('action', actionFilter)`
sends `action=login` to the API, which filters miss rows out — defeating the
whole point of having miss visible. This is a Phase-2 brownfield carry-over,
but it became user-facing the moment Phase 3 surfaced the Miss badge.
**Fix:**
```ts
type ActionFilter = 'all' | 'login' | 'logout' | 'prime_user_miss';
// …
<option value="prime_user_miss">Prime user miss</option>
```
The route at `app/api/audit/entries/route.ts:35` also needs `'prime_user_miss'`
added to its allowlist for the filter to actually pass through.

### WR-03: `app/admin/page.tsx` 500 ms timer races server-side admin check

**File:** `app/admin/page.tsx:46-60`
**Issue:** Two effects collide. (1) A `setTimeout(..., 500)` flips `authChecked`
to `true`, after which a stale `isAdmin === false` flips a redirect. (2) An
unconditional `fetch('/api/auth/session')` issues a redirect on its own clock.
On a slow `/api/auth/session` (>500ms), an admin user whose `useAuth()` context
hasn't populated yet could see a transient `router.replace('/')` from effect (1)
before effect (2) ever resolves — visible flash of homepage redirect. The
500ms delay is a magic number and the behaviour is timing-dependent. This
predates Phase 3, but Phase 3 is the first phase to put state-rich children
(VisibilityTab fetching Prime users + config in parallel) underneath this gate,
making the flash more user-noticeable.
**Fix:** Remove the `setTimeout` entirely and gate solely on a single
authoritative source — either the server `/api/auth/session` response, or a
deterministic `useAuth()` "ready" boolean. If the auth context lacks a "ready"
flag, returning `null` from the page until the server check resolves is safer
than a 500ms heuristic:
```ts
useEffect(() => {
  fetch('/api/auth/session')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(d => { if (d?.isAdmin) setAuthChecked(true); else router.replace('/'); })
    .catch(() => router.replace('/login'));
}, [router]);
```

### WR-04: `audit-tab.tsx` mount-only effect misses `setPrimeUsers`/`setPrimeUsersLoading` deps

**File:** `app/admin/audit-tab.tsx:120-130`
**Issue:** `useEffect(() => { … fetch('/api/admin/prime-users') … }, [])`
intentionally runs once on mount, but the React hooks lint rule
(`react-hooks/exhaustive-deps`) treats the empty array as a violation when the
effect closes over `cancelled` plus three setters. Setters are stable, so the
behaviour is correct, but the `// eslint-disable-next-line` is missing and the
fetch URL is hardcoded — if a future refactor needs to vary the URL per prop,
the empty-deps array will silently mask the change. **Fix:** Either add an
explicit `// eslint-disable-next-line react-hooks/exhaustive-deps` with a
one-line justification, or wrap the body in a `useCallback` that lists its
true non-stable deps and put the callback in the deps array. The same comment
applies to `app/admin/visibility-tab.tsx:312-330`.

---

## Info

### IN-01: `lib/format-relative.ts` accepts `NaN` via the `number` branch

**File:** `lib/format-relative.ts:21,24`
**Issue:** `typeof NaN === 'number'` so `NaN` short-circuits to the
`!Number.isFinite(ms)` guard correctly — but the test at
`format-relative.test.ts:75` documents this as expected behaviour. Worth a
one-line code comment so a future reader doesn't "simplify" the guard away.
**Fix:** Add `// NaN.isFinite() === false — guards both bad ISO strings and
explicit NaN passes.` above line 24.

### IN-02: `app/admin/page.tsx` unused `Tab` URL drift

**File:** `app/admin/page.tsx:62-65`
**Issue:** `changeTab` calls `router.replace(\`/admin?tab=${t}\`)` on every
click but the initial URL hydration in `useState(() => …)` (line 33–36) only
runs once. If something else updates the search params (e.g. external nav),
the local `tab` state and the URL desync. Low risk in practice — there's no
other code path mutating `?tab=` — but worth a comment.
**Fix:** Either add a `useEffect` syncing `searchParams.get('tab')` → state,
or document that the URL is one-way write-only after first mount.

### IN-03: `audit-tab.tsx` AEDT label inaccurate during AEST half of year

**File:** `app/admin/audit-tab.tsx:42-50,71`
**Issue:** Header reads "Timestamp (AEDT)" but the formatter uses
`timeZone: 'Australia/Sydney'`, which is **AEST** (UTC+10) from April through
October and AEDT (UTC+11) only during DST. The CSV header carries the same
inaccuracy. Today (2026-04-25) is already AEST per the test comment at
`audit-tab.test.ts:91-95`. Cosmetic — admins won't be misled — but inaccurate.
**Fix:** Use "Timestamp (Sydney)" or compute the abbreviation dynamically via
`Intl.DateTimeFormat(..., { timeZoneName: 'short' })`.

### IN-04: `PrimeUserPicker.tsx` 100 ms blur close is a magic number

**File:** `components/ui/PrimeUserPicker.tsx:254`
**Issue:** `onBlur={() => setTimeout(() => setOpen(false), 100)}` — the 100 ms
is justified by the inline comment (covers touch/keyboard activation) but the
comment lives at the top of the file, not at the call site. A future reader
may "simplify" this to a direct `setOpen(false)` and re-introduce the
"click swallowed by blur" footgun.
**Fix:** Extract a `const BLUR_CLOSE_DELAY_MS = 100;` constant with a one-line
comment at the call site referencing UI-SPEC.

### IN-05: `PrimeUserPicker.tsx` ARIA `aria-selected` semantics

**File:** `components/ui/PrimeUserPicker.tsx:291`
**Issue:** `aria-selected={isActive}` is set on every option for the keyboard-
active row. Per WAI-ARIA combobox pattern, `aria-selected` should mark the
*selected* option (which doesn't apply to a multi-select chip-picker like this),
not the *focused* option — the focused option is conveyed via
`aria-activedescendant` on the input (which the component does correctly at
line 247). Setting `aria-selected={true}` on the keyboard-focused row may
confuse screen readers into announcing it as "selected" when it is in fact only
focused. Low-impact, but worth fixing for screen-reader correctness.
**Fix:** Remove `aria-selected` from the `<li>` entirely. The visual
highlight + `aria-activedescendant` already convey focus state correctly.
If needed, use `aria-current="true"` on the active row instead.

### IN-06: `app/admin/visibility-tab.tsx` admin-row count check is over-cautious

**File:** `app/admin/visibility-tab.tsx:475,478`
**Issue:** `(config.admins?.length ?? 0) === 0` and the matching `> 0` guard
defend against `config.admins` being `undefined`, but `VisibilityConfig.admins`
is typed as `string[]` (non-optional) at `lib/page-visibility.ts:30`, and the
`EMPTY_CONFIG` initialiser (line 51) sets it to `[]`. The optional-chaining is
dead defensive code — harmless, but masks the type contract. Same thing at
line 343 (`(config.admins || [])`) and 480 (`config.admins.map(...)` — note
the inconsistency: the very next line drops the optional chain).
**Fix:** Either trust the type and use `config.admins.length`, or wrap the
loaded data with `{ admins: data.admins ?? [], ... }` once at the load site
(line 301) so all downstream code can assume the contract.

### IN-07: `app/api/admin/prime-users/route.ts` 500 path could expose `lastSuccessAt`

**File:** `app/api/admin/prime-users/route.ts:55-60`
**Issue:** When the unexpected throw happens (e.g. blob-cache disk error),
the 500 response sends `lastSuccessAt: null` — losing any cached
`lastSuccessAt` value the admin could otherwise still see. The picker UI uses
this metadata to render "cache last refreshed N hours ago", so on the rare
500 path the admin loses that signal entirely. Behaviour is consistent with
"return generic on error" per CLAUDE.md, so this is genuinely informational —
flagging only because the metadata is admin-only and harmless to surface.
**Fix:** Optional. If keeping the metadata on the 500 path is desired, call
`getDirectoryMetadata()` again inside the catch block (it doesn't touch Prime),
otherwise leave as-is and the picker will show "No Prime user cache yet" until
the next successful read.

---

_Reviewed: 2026-04-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
