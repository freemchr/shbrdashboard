---
phase: 03-admin-picker-identity-rich-display
plan: 03
subsystem: server-client-bridge
tags: [api-route, react-context, provider, wave-1, server-client-bridge, tri-state, pitfall-1, pitfall-3, pitfall-5]

# Dependency graph
requires:
  - phase: 01-prime-user-directory
    provides: PrimeUser / PrimeUserDirectoryBlob types; getCached() blob-cache API; BLOB_KEY shbr-admin/prime-users.json convention; refresh route auth-gate analog
  - phase: 02-session-auth-context
    provides: lib/auth-context.tsx Provider trio reference (createContext + Provider component + useHook)
  - plan: 03-01
    provides: app/api/admin/prime-users/route.test.ts Wave 0 RED scaffold (5 describe blocks); vitest+jsdom harness ready
provides:
  - Admin-gated GET endpoint for the cached Prime user directory (D-15)
  - Tri-state React Context Provider exposing { status, users, byEmail, lastSuccessAt, lastError, refresh, refreshing }
  - usePrimeDirectory hook (throws-on-misuse default-null pattern)
  - PrimeDirectoryContextValue type contract for Wave 1+2 consumers
affects:
  - 03-02-prime-user-picker (consumes usePrimeDirectory; mocked at boundary in Wave 0 test, real at runtime)
  - 03-04-admin-page-cascade (mounts <PrimeDirectoryProvider> at AdminPage root; uses byEmail in audit cascade)

# Tech tracking
tech-stack:
  added: []  # No new packages — uses React 18 stdlib (createContext, useState, useEffect, useCallback, useMemo)
  patterns:
    - "Module-boundary mock at the import boundary (Wave 0 RED test mocks @/lib/session, @/lib/page-visibility, @/lib/blob-cache — never the underlying iron-session or @vercel/blob)"
    - "Two-gate auth verbatim from Phase 1 sibling (refresh route): 401 on session.userEmail empty, 403 on isAdminEmail false"
    - "Pure cache read via getCached() directly — never the public read helper that has first-miss bootstrap (Pitfall 5)"
    - "Tri-state Provider status (loading|ready|error) so consumers can distinguish 'haven't loaded yet' from 'loaded with empty cache' (Pitfall 1)"
    - "byEmail Map built ONCE per users change inside Provider setState — consumers consume, never derive (Pitfall 3)"
    - "createContext default null + hook throws on null — forces correct mount; deliberate divergence from auth-context.tsx populated default"
    - "useMemo'd value object so consumers don't re-render on refreshing toggle when state is unchanged"
    - "On-mount single fetch via useEffect with [load] dep where load is useCallback-stable (D-16)"
    - "Error preservation: setState(prev => ({...users: prev.users, byEmail: prev.byEmail})) on fetch error — transient failure does not wipe a previously-good cache"

key-files:
  created:
    - "app/api/admin/prime-users/route.ts (66 lines — GET handler + two-gate auth + getCached read)"
    - "lib/prime-directory-context.tsx (146 lines — Provider + hook + tri-state DirectoryState union)"
  modified: []  # Both files entirely new — zero existing source touched

decisions:
  - "BLOB_KEY 'shbr-admin/prime-users.json' inlined as a const literal in route.ts rather than re-exporting from lib/prime-users (PATTERNS option (b)) — single call site, smaller change, no churn on lib/prime-users.ts"
  - "GET endpoint omits `export const maxDuration` — refresh sibling has it because it calls Prime; pure cache read needs no extended timeout"
  - "Auth gate response codes 401/403 (matches refresh sibling) — RESEARCH Open Question 1 chose this over 404 (audit endpoint convention) for symmetry with the immediate sibling"
  - "Provider createContext default is null (forces hook throw) — deliberate divergence from auth-context.tsx (populated default) because directory hook is consumed only inside <AdminPage> where Provider is guaranteed mounted"
  - "byEmail Map built inside Provider setState on each fetch resolve — Pitfall 3 mitigation; consumers receive a stable Map instance per `users` change"
  - "On fetch error, preserve prev.users + prev.byEmail rather than zeroing — transient refresh failure must not wipe a previously-good cache (RESEARCH Pattern 2 lines 337-344)"

metrics:
  duration: ~15 minutes
  completed: 2026-04-24
  tasks: 2
  files: 2
  loc-added: 211
---

# Phase 03 Plan 03: PrimeDirectoryProvider + GET Endpoint Summary

Wave 1 server-client bridge: an admin-gated GET endpoint at `/api/admin/prime-users`
that serves the cached Prime user directory (without ever calling Prime), and a
client-side React Context Provider that fetches it once on mount and exposes a
tri-state view (`loading | ready | error`) plus an O(1) `byEmail` Map for the
picker's historical-detection logic and Plan 04's audit cascade.

## What Shipped

**Two new files, both entirely new (zero existing source modified):**

1. **`app/api/admin/prime-users/route.ts`** (66 lines) — GET handler with two-gate
   auth (401 / 403) mirroring the Phase 1 refresh sibling verbatim. Reads via
   `getCached<PrimeUserDirectoryBlob>()` directly — Pitfall 5 invariant: this
   endpoint MUST NOT call Prime. Response shape:
   `{ users: PrimeUser[], lastSuccessAt: string | null, lastError: string | null }`.
   Cache-empty branch returns `{ users: [], lastSuccessAt: null, lastError: null }`
   so the picker's empty-cache UI (Surface 9) renders correctly.

2. **`lib/prime-directory-context.tsx`** (146 lines) — `'use client'` Context
   module exposing `PrimeDirectoryProvider`, `usePrimeDirectory`, and
   `PrimeDirectoryContextValue`. Tri-state status (loading|ready|error) per
   Pitfall 1, default-null context for hook-throws-on-misuse safety, single
   fetch on mount per D-16, refresh callback wired to Phase 1's existing POST
   `/api/admin/prime-users/refresh`, useMemo'd value to prevent consumer churn.

## Verification

### GET Endpoint — Wave 0 RED → GREEN

```
$ npx vitest run app/api/admin/prime-users/route.test.ts

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

All 5 describe blocks pass:

- **D-15 Gate 1 (session):** 401 + `{ error: 'Unauthorized' }` when `session.userEmail` empty; getCached NOT called.
- **D-15 Gate 2 (admin):** 403 + `{ error: 'Forbidden' }` when isAdminEmail returns false; getCached NOT called.
- **D-15 response shape:** 200 + `{ users, lastSuccessAt, lastError }` from a populated blob.
- **D-20 cache empty:** 200 + `{ users: [], lastSuccessAt: null, lastError: null }` when getCached returns null.
- **Pitfall 5 negative:** getCached called exactly once with key matching `/^shbr-admin\//` AND `/prime-users\.json$/`.

### Pitfall 5 Grep Audit (Endpoint Must Never Call Prime)

| Forbidden token       | Found |
| --------------------- | ----- |
| `getAllPrimeUsers`    | 0     |
| `refreshPrimeUsers`   | 0     |
| `resolveByEmail`      | 0     |
| `primeGet`            | 0     |
| `primeGetAllPages`    | 0     |
| `getCached<...>`      | 1     |

The original docstring referenced `getAllPrimeUsers()` by name in the Pitfall 5
warning. The grep audit caught this on first run (ironically, the warning text
itself violated the audit). Reworded to `getAll…` ellipsis so the audit stays
green while preserving the documentation. Token discipline matters here because
the audit is the structural guarantee that no future contributor accidentally
re-introduces the Prime-call hot-path on this read endpoint.

### Provider Contract (Pitfall 1 + Pitfall 3)

| Invariant                                                          | Verified |
| ------------------------------------------------------------------ | -------- |
| First non-comment line is `'use client';`                          | OK       |
| Tri-state status union `'loading' \| 'ready' \| 'error'`           | OK (3 occurrences) |
| Initial state `status: 'loading'` (Pitfall 1)                      | OK       |
| `createContext<...|null>(null)` — hook throws outside Provider    | OK       |
| Hook throw msg `'usePrimeDirectory must be inside <PrimeDirectoryProvider>'` | OK |
| `byEmail` Map built inside setState (Pitfall 3 — Provider owns it) | OK (`new Map(data.users.map(u => [u.email, u]))`) |
| Error path preserves `prev.users` + `prev.byEmail`                 | OK       |
| `useEffect(() => { load(); }, [load])` single-fetch on mount       | OK       |
| `load` is `useCallback`-stable                                     | OK       |
| `refresh` POSTs `/api/admin/prime-users/refresh` then awaits load  | OK       |
| `setRefreshing(false)` runs in `finally`                           | OK       |
| `useMemo<PrimeDirectoryContextValue>` with `[state, refresh, refreshing]` deps | OK |

### Server-Only Module Import Discipline (T-03-03-02 mitigation)

| Forbidden import                            | Found |
| ------------------------------------------- | ----- |
| Non-type `from '@/lib/prime-users'`         | 0     |
| Any `from '@/lib/blob-cache'`               | 0     |
| Any `from '@/lib/session'`                  | 0     |
| Any `from '@/lib/page-visibility'`          | 0     |
| Type-only `import type { PrimeUser } from '@/lib/prime-users'` | 1 (allowed; TS-strips at compile) |

### TypeScript Compile

`npx tsc --noEmit` reports zero errors in either target file. Two unrelated
errors remain in cross-plan files owned by other agents:

- `components/ui/PrimeUserPicker.test.tsx` — `Cannot find module '@/lib/prime-directory-context'` was the pre-Task-2 state; **now resolves cleanly** (the picker import target is satisfied).
- `app/admin/page.test.tsx` — `Cannot find module '@/lib/prime-directory-context'` likewise **now resolves**.

(One JSX parse error in `app/admin/page.test.tsx:93` is from the Wave 0 RED
scaffold for Plan 04 — out of scope here; Plan 04 will repair as it implements
the AdminPage cascade.)

## Architectural Decisions

### 1. BLOB_KEY: inline literal vs re-export

**Decision:** Inline `'shbr-admin/prime-users.json'` as a const in `route.ts`.

**Rationale:** Single call site. Re-exporting BLOB_KEY from `lib/prime-users.ts`
would touch a stable Phase 1 module to satisfy a one-place consumer.
PATTERNS option (b) explicitly preferred for this case. A code comment in
`route.ts` points back to `lib/prime-users.ts:29` for cross-reference.

### 2. Auth response codes: 401/403 (sibling-symmetric) vs 404 (audit-symmetric)

**Decision:** 401 for missing session, 403 for non-admin.

**Rationale:** RESEARCH Open Question 1 — match the immediate sibling
(refresh route) rather than the audit endpoint. The picker and refresh button
sit at the same UI surface; consistent error semantics simplify the picker's
error-state branch.

### 3. createContext default: `null` (Provider-required) vs populated (auth-context style)

**Decision:** `createContext<PrimeDirectoryContextValue | null>(null)` and
hook throws if used outside the Provider.

**Rationale:** auth-context.tsx uses a populated default because it tolerates
being read during the splash render. This Provider has a stricter contract —
it's only consumed inside `<AdminPage>` where the Provider is guaranteed
mounted. A loud throw turns "forgot to wrap in Provider" from a silent stale
state into a development-time crash. RESEARCH Pattern 2 lines 369-373 spec.

### 4. Error path: preserve prev state vs zero out

**Decision:** On fetch error, set `status: 'error'` but preserve
`prev.users`, `prev.byEmail`, `prev.lastSuccessAt`.

**Rationale:** A transient refresh failure (network blip, blob storage hiccup)
must NOT wipe a previously-good cache. Picker continues to render the last-known
directory; admin sees an error indicator on the refresh button hint, can retry.
RESEARCH Pattern 2 lines 337-344 spec.

### 5. byEmail Map: in Provider setState (Pitfall 3 mitigation)

**Decision:** Build the Map inside the success setState callback, once per
fetch resolve. Consumers receive a stable Map instance per `users` change.

**Rationale:** If consumers built their own Maps (e.g., `useMemo(() => new Map(users.map...), [users])`),
each consumer would build its own instance — cache-friendly per consumer but
wastes work and risks key-derivation drift. Building once in the Provider and
sharing is the React-Context-native pattern.

## Deviations from Plan

**None — plan executed exactly as written.** Both task action blocks contained
the verbatim source code; both were saved as-specified. The single deviation
was a docstring reword in `route.ts` to satisfy the literal grep audit on
forbidden tokens — the warning text "MUST NOT call `getAllPrimeUsers()`"
ironically used the forbidden token itself. Reworded to `getAll…` ellipsis;
documentation intent preserved, audit GREEN.

## Known Stubs

None.

## Threat Flags

None — no new security surface beyond what the plan's `<threat_model>` already
catalogued (T-03-03-01 through T-03-03-08, all mitigated or accepted with
documented rationale). The new GET endpoint shares the auth-gate shape of the
existing refresh sibling, the Provider stays client-side with no server-only
imports.

## Wave 1 Co-Land Status

This plan ran in parallel with Plan 02 (PrimeUserPicker component) in Wave 1.
Both flip independent Wave 0 RED tests GREEN:

- **Plan 02:** `components/ui/PrimeUserPicker.test.tsx` (mocks `usePrimeDirectory` at the import boundary — mock target now resolvable thanks to this plan landing)
- **Plan 03 (this plan):** `app/api/admin/prime-users/route.test.ts` — **5/5 GREEN**

Once both plans merge to the wave-integration branch, the full vitest suite
runs cleanly modulo Plan 04's pre-existing JSX parse error (out of scope here).

## Self-Check: PASSED

Files exist:
- `app/api/admin/prime-users/route.ts` — FOUND
- `lib/prime-directory-context.tsx` — FOUND

Commits exist:
- `efcad99` (Task 1 GET endpoint) — FOUND
- `808548d` (Task 2 Provider) — FOUND

Wave 0 RED test:
- `app/api/admin/prime-users/route.test.ts` — 5/5 GREEN

Pitfall 5 grep audit: 0 hits for `getAllPrimeUsers`, `refreshPrimeUsers`, `resolveByEmail`, `primeGet`, `primeGetAllPages`.

Server-only import discipline: 0 hits for runtime imports of `@/lib/blob-cache`, `@/lib/session`, `@/lib/page-visibility`, or non-type `@/lib/prime-users`.
