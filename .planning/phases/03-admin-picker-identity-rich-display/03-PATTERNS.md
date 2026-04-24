# Phase 3: Admin Picker & Identity-Rich Display - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 9 (3 NEW source + 3 NEW test + 3 MODIFIED)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/api/admin/prime-users/route.ts` (NEW) | route (App Router GET) | request-response, cache-read | `app/api/admin/prime-users/refresh/route.ts` | exact (sibling) |
| `app/api/admin/prime-users/route.test.ts` (NEW) | test (Vitest, node env) | unit | `app/api/auth/session/route.test.ts` | exact |
| `lib/prime-directory-context.tsx` (NEW) | provider (React Context, client) | event-driven, fetch-once | `lib/auth-context.tsx` + `components/ui/AuthGuard.tsx` (combined) | role-match (Provider) + role-match (mount/fetch) |
| `components/ui/PrimeUserPicker.tsx` (NEW) | component (combobox, client) | request-response (UI), event-driven (kbd) | NONE — first typeahead/combobox in codebase | no analog (use RESEARCH.md Pattern 3 + UI-SPEC §Surfaces) |
| `components/ui/PrimeUserPicker.test.tsx` (NEW) | test (Vitest, jsdom env) | unit, DOM | NONE — first .tsx test in project | no analog (use Wave 0 install + RESEARCH.md Test Strategy) |
| `app/admin/page.test.tsx` (NEW) | test (Vitest, jsdom env) | unit, DOM | NONE — first DOM test of admin page | no analog (mirror PrimeUserPicker.test.tsx harness) |
| `app/admin/page.tsx` (MODIFY) | page component (client) | request-response | self (already established register) | self-modify |
| `vitest.config.ts` (MODIFY) | config | infrastructure | self | self-modify |
| `package.json` (MODIFY) | manifest | infrastructure | self | self-modify |

**Notable absences in the codebase (planner must build, not copy):**
- No combobox/typeahead anywhere in `components/ui/` (verified via grep — only `<select>` and free-text inputs).
- No chip/tag primitive (verified — admin form uses textareas).
- No tooltip primitive (deliberately not introduced — D-08 discretion picks native `title`).
- No `.tsx` test, no JSDOM environment (Wave 0 gap).

---

## Pattern Assignments

### `app/api/admin/prime-users/route.ts` (route, request-response, cache-read)

**Analog:** `app/api/admin/prime-users/refresh/route.ts`

This is the closest possible analog — a sibling endpoint in the same directory. The new GET endpoint should look like the refresh route's twin: same imports, same runtime declarations, same two-gate auth, same error shape. The only deltas are (a) `GET` instead of `POST`, (b) read the cached blob via `getCached()` instead of calling `refreshPrimeUsers()` (Pitfall 5 — must NOT call `getAllPrimeUsers()` because that has a first-miss bootstrap that fires a Prime call).

**Imports + runtime declarations** (refresh route lines 19-26):
```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';
import { refreshPrimeUsers } from '@/lib/prime-users';

export const runtime = 'nodejs';
export const maxDuration = 60;           // matches app/api/prime/team/route.ts (similar /users fetch)
export const dynamic = 'force-dynamic';  // matches app/api/auth/login/route.ts:6 (session-touching)
```

For Phase 3's GET endpoint — use the same `runtime` + `dynamic` lines, but DROP `maxDuration: 60` (not needed for a pure cache read). Replace the `refreshPrimeUsers` import with `getCached` from `@/lib/blob-cache` and the type from `@/lib/prime-users`:
```typescript
import { getCached } from '@/lib/blob-cache';
import type { PrimeUserDirectoryBlob } from '@/lib/prime-users';
```

**Two-gate auth pattern** (refresh route lines 28-40 — copy verbatim, change handler signature):
```typescript
export async function POST() {
  // Gate 1: authenticated session?  (RESEARCH Pitfall 3 — distinct from Gate 2)
  const session = await getSession();
  if (!session.userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Gate 2: admin?  (uses lib/page-visibility.ts:isAdminEmail which handles
  // env ADMIN_EMAIL + config.admins + the existing hardcoded fallback).
  const config = await getVisibilityConfig();
  if (!isAdminEmail(session.userEmail, config)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
```

For Phase 3 GET — same two gates with `export async function GET()` and **403 on the admin gate** (RESEARCH Open Question 1 — assumption A1 picks 403 to match the immediate sibling).

**Cache-read body** (NO direct analog — Pitfall 5; new code per RESEARCH Pattern 1):
```typescript
const blob = await getCached<PrimeUserDirectoryBlob>('shbr-admin/prime-users.json');
return NextResponse.json({
  users: blob?.users ?? [],
  lastSuccessAt: blob?.lastSuccessAt ?? null,
  lastError: blob?.lastError ?? null,
});
```

The blob key string `'shbr-admin/prime-users.json'` is the literal from `lib/prime-users.ts:29`'s `BLOB_KEY` constant. Two acceptable approaches: (a) re-export `BLOB_KEY` from `lib/prime-users.ts` and import here, or (b) inline the literal with a comment pointing back. Planner picks; (a) is DRYer.

**Error handling pattern:** Refresh route uses bare `if/return` — no try/catch around the auth gates because `getSession()` and `getVisibilityConfig()` are well-behaved. Phase 3 GET should match (no try/catch). The `getCached()` call already swallows blob errors and returns `null` (`lib/blob-cache.ts:91-93`), so a missing/broken blob lands in the `blob?.users ?? []` fallback.

**Not analog (do NOT copy from refresh route):**
- `refreshPrimeUsers({ reason: 'admin' })` body — the GET endpoint MUST NOT trigger Prime calls (Pitfall 5).
- The `502` response branch — GET has no Prime path, so no upstream-failure status to return.
- The `userCount`/`durationMs`/`cachedAt` response shape — GET returns `{ users, lastSuccessAt, lastError }` per D-15.

---

### `app/api/admin/prime-users/route.test.ts` (route test, unit, node env)

**Analog:** `app/api/auth/session/route.test.ts`

Same surface kind (Next.js App Router GET handler with two-gate auth + cache read). The Phase 2 session route test is the most recent analog and uses module-boundary mocking exactly as RESEARCH.md prescribes for Phase 3.

**Module-boundary mocks pattern** (session test lines 4-32):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrimeUser } from '@/lib/prime-users';

// Module-boundary mocks (Pitfall 2 — mock @/lib/session at the import boundary, NOT the underlying request-cookie module).
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/page-visibility', () => ({
  getVisibilityConfig: vi.fn(),
  getHiddenPaths: vi.fn(() => new Set<string>()),
  isAdminEmail: vi.fn(() => false),
}));
vi.mock('@/lib/prime-users', () => ({ resolveByEmail: vi.fn() }));
vi.mock('@/lib/audit', () => ({ appendAuditLog: vi.fn() })); // D-05 guard

import { GET } from './route';
import { getSession } from '@/lib/session';
import { resolveByEmail } from '@/lib/prime-users';
import { getVisibilityConfig, getHiddenPaths, isAdminEmail } from '@/lib/page-visibility';
import { appendAuditLog } from '@/lib/audit';

const mockedGetSession = vi.mocked(getSession);
// ...etc
```

For Phase 3's route.test.ts — adapt to the GET endpoint's import surface. Mock list:
```typescript
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/page-visibility', () => ({
  getVisibilityConfig: vi.fn(),
  isAdminEmail: vi.fn(() => false),
}));
vi.mock('@/lib/blob-cache', () => ({
  getCached: vi.fn(),
}));
```

Note: `lib/prime-users.test.ts:38-47` shows the established pattern for mocking `./blob-cache` — mirror that.

**Session/admin fixtures pattern** (session test lines 34-66):
```typescript
function makeSession(overrides: Partial<{...}> = {}) {
  return {
    accessToken: 'tok-x',
    refreshToken: 'r-x',
    userEmail: 'jane@shbr.com',
    userName: 'jane@shbr.com',
    expiresAt: Date.now() + 3600_000,
    save: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };
}

function makePrimeUser(overrides: Partial<PrimeUser> = {}): PrimeUser {
  return {
    id: 'u1', email: 'jane@shbr.com', fullName: 'Jane Doe',
    firstName: 'Jane', lastName: 'Doe',
    division: null, region: null, roleOrTrade: null,
    status: 'active',
    ...overrides,
  };
}
```

Reuse both helpers verbatim. For Phase 3 also add a `makeBlob()` helper modelled on `lib/prime-users.test.ts:76-87`:
```typescript
function makeBlob(overrides: Partial<PrimeUserDirectoryBlob> = {}): PrimeUserDirectoryBlob {
  const nowIso = new Date().toISOString();
  return {
    schemaVersion: 1,
    users: [],
    lastSuccessAt: nowIso,
    lastAttemptAt: nowIso,
    lastError: null,
    lastErrorAt: null,
    ...overrides,
  };
}
```

**Test-case structure pattern** (session test lines 68-119, 133-156):
```typescript
describe('GET /api/auth/session (SESSION-01, SESSION-03 — D-07)', () => {
  it('returns primeUser from resolveByEmail when session is valid', async () => {
    mockedGetSession.mockResolvedValue(makeSession() as never);
    mockedConfig.mockResolvedValue({ admins: [], groups: [], pages: [] } as never);
    mockedResolve.mockResolvedValue(makePrimeUser({ fullName: 'Jane Doe' }));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.primeUser).toEqual(expect.objectContaining({ fullName: 'Jane Doe' }));
  });
  // ...
});

describe('GET /api/auth/session (auth-cascade invariants — D-20)', () => {
  it('returns 401 and does NOT call resolveByEmail when accessToken is missing', async () => {
    mockedGetSession.mockResolvedValue(makeSession({ accessToken: '' }) as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Not authenticated');
    expect(mockedResolve).not.toHaveBeenCalled();
  });
});
```

Translate to Phase 3 — `describe`s grouped by D-15 / Open Question 1 / Pitfall 5:
- `'GET /api/admin/prime-users (D-15 — auth gating)'`: 401 unauthenticated, 403 non-admin (per A1)
- `'GET /api/admin/prime-users (D-15 — response shape)'`: 200 + `{ users, lastSuccessAt, lastError }` from a populated blob
- `'GET /api/admin/prime-users (D-20 — cache empty)'`: 200 + `{ users: [], lastSuccessAt: null, lastError: null }` when `getCached` returns `null`
- `'GET /api/admin/prime-users (Pitfall 5 — no Prime call)'`: assert `getCached` was called and that NO `getAllPrimeUsers`/Prime mock was touched (the test won't even import `prime-users` module since we mock `blob-cache` directly)

**Important — runtime env:** session test runs under `environment: 'node'` (Vitest default per `vitest.config.ts:7`). The Phase 3 route test must remain `node` (NOT jsdom) — only the picker/page tests need jsdom. Wave 0 must support per-file environments (either via `// @vitest-environment jsdom` directives OR via `test.environmentMatchGlobs` in vitest.config.ts).

---

### `lib/prime-directory-context.tsx` (provider, event-driven + fetch-once)

**Analog (Provider shape):** `lib/auth-context.tsx`
**Analog (mount + initial fetch + setState):** `components/ui/AuthGuard.tsx` (lines 16-61)

Two analogs combined: `auth-context.tsx` is the canonical Context+Provider+useHook trio in this project (3 functions, 35 lines). `AuthGuard.tsx` shows the single-fetch-on-mount pattern that Phase 3's Provider must replicate (the auth-context Provider itself is "dumb" — receives a `value` prop; AuthGuard does the actual fetch).

Phase 3's Provider does BOTH — it's a "smart" Provider that owns the fetch and the state. The combined pattern looks like RESEARCH Pattern 2; the analog excerpts below show where each piece comes from.

**Imports + Context/Provider/Hook trio** (auth-context.tsx lines 1-34):
```typescript
'use client';

import { createContext, useContext } from 'react';
import type { PrimeUser } from '@/lib/prime-users';

export interface AuthContext {
  userEmail: string;
  userName: string;
  isAdmin: boolean;
  hiddenPaths: Set<string>;
  primeUser: PrimeUser | null;
}

const AuthCtx = createContext<AuthContext>({
  userEmail: '',
  userName: '',
  isAdmin: false,
  hiddenPaths: new Set(),
  primeUser: null,
});

export function AuthProvider({
  value,
  children,
}: {
  value: AuthContext;
  children: React.ReactNode;
}) {
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
```

For Phase 3 — file structure stays identical (Context + Provider + hook), but:
1. The exported interface is `PrimeDirectoryContextValue` (RESEARCH Pattern 2 has the full shape).
2. `createContext` default is `null` (forces the `usePrimeDirectory` hook to throw if used outside the Provider — this is the RESEARCH Pattern 2 contract; matches the "dev-time guard" pattern).
3. The Provider is "smart" (owns state) — see next analog.
4. The hook is `usePrimeDirectory()` and throws if `ctx === null` (per RESEARCH Pattern 2 lines 369-373).

**Mount + initial fetch + setState pattern** (AuthGuard.tsx lines 16-61):
```typescript
const [authCtx, setAuthCtx] = useState<AuthContext>({
  userEmail: '',
  userName: '',
  isAdmin: false,
  hiddenPaths: new Set(),
  primeUser: null,
});

// ...

useLayoutEffect(() => {
  if (isLoginPage) {
    setChecking(false);
    return;
  }

  fetch('/api/auth/session')
    .then(res => {
      if (!res.ok) {
        router.replace('/login');
      } else {
        return res.json();
      }
    })
    .then(data => {
      if (!data) return;
      setAuthCtx({
        userEmail: data.userEmail || '',
        userName: data.userName || '',
        isAdmin: !!data.isAdmin,
        hiddenPaths: new Set(data.hiddenPaths || []),
        primeUser: data.primeUser ?? null,
      });
      setAuthed(true);
      setChecking(false);
    })
    .catch(() => {
      router.replace('/login');
    });
}, [isLoginPage, router]);
```

For Phase 3 — translate to RESEARCH Pattern 2's tri-state shape:
- Use `useEffect` (NOT `useLayoutEffect` — picker isn't measuring layout); the auth-guard uses `useLayoutEffect` only because it's gating render.
- Initial state is `{ status: 'loading', users: [], byEmail: new Map(), lastSuccessAt: null, lastError: null }` (see RESEARCH Pattern 2 lines 314-320).
- On success, `setState` to `status: 'ready'` and build `byEmail` Map inside the same `setState` call (Pitfall 3 — Map lives in Provider, not consumer).
- On failure, `setState` to `status: 'error'` and PRESERVE `prev.users` / `prev.byEmail` so a transient refresh failure doesn't wipe a previously-good cache (RESEARCH Pattern 2 lines 337-344).
- Wrap `load` in `useCallback` and depend on `[load]` in the `useEffect` (matches AuthGuard's `[isLoginPage, router]` dependency style).
- `useMemo` the value object — see RESEARCH Pattern 2 lines 360-364.

**Tri-state initialization (Pitfall 1 mitigation — RESEARCH Pattern 2 lines 312-321):**
```typescript
const [state, setState] = useState<DirectoryState>({
  status: 'loading',
  users: [],
  byEmail: new Map(),
  lastSuccessAt: null,
  lastError: null,
});
```
Critical: `status: 'loading'` is the canonical "we don't know yet" signal. Pickers MUST NOT treat any email as historical while `status === 'loading'`. Encode this contract in tests (D-22).

**`refresh()` method pattern** (RESEARCH Pattern 2 lines 349-357 — no direct codebase analog):
```typescript
const refresh = useCallback(async () => {
  setRefreshing(true);
  try {
    await fetch('/api/admin/prime-users/refresh', { method: 'POST' });
    await load();
  } finally {
    setRefreshing(false);
  }
}, [load]);
```
The `POST` endpoint already exists (`app/api/admin/prime-users/refresh/route.ts` from Phase 1). This file does the click-handler glue.

**Mount location pattern (RESEARCH Open Question 2):** Mount `<PrimeDirectoryProvider>` at the `<AdminPage>` root, wrapping both `<VisibilityTab />` and `<AuditTab />` so they share the fetched directory across tab switches without re-fetching. See `app/admin/page.tsx:117-119` for the tab-render switch — the wrapper goes around that block.

---

### `components/ui/PrimeUserPicker.tsx` (component, combobox)

**Analog:** **NONE** — this is the first typeahead/combobox in the codebase. `components/ui/Sidebar.tsx` and `components/ui/TopBar.tsx` are the closest in the sense of "client component that consumes a Context hook," but neither has a listbox, chips, or keyboard nav.

The planner MUST use:
1. **RESEARCH.md Pattern 3** (lines 381-481) — the WAI-ARIA Combobox 1.2 implementation skeleton with `aria-activedescendant`, listbox + options, and the `onMouseDown={e => e.preventDefault()}` blur-swallow fix.
2. **UI-SPEC §"Visual Token Reference (per surface)"** — 13 surfaces enumerated with exact Tailwind class lists. Treat these as binding.
3. **UI-SPEC §"Implementation Reference (JSX skeleton — non-normative)"** (lines 858-909) — assembled component structure.

**Two extracted patterns from the existing admin page are worth pinning** (because the picker lives inside the existing admin section chrome and must visually belong):

**Form-input register pattern** (admin page line 300, reused at 340, 482):
```tsx
<input
  // or textarea
  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
/>
```
Phase 3 picker search input must adopt this verbatim **with one change**: `focus:border-red-600` (matches UI-SPEC Surface 5 — the audit `<select>` already uses red-600 at line 588; the textarea is the outlier with red-500). Planner picks red-600 to align with the audit-tab input convention; UI-SPEC §Color makes this explicit.

**`useAuth()` consumer pattern** (Sidebar.tsx:115, TopBar.tsx:45):
```typescript
const { isAdmin, hiddenPaths } = useAuth();
// or
const { primeUser, userEmail } = useAuth();
const displayName = primeUser?.fullName?.trim() || userEmail;
```
The picker uses `usePrimeDirectory()` exactly the same way:
```typescript
const { status, users, byEmail, lastSuccessAt, lastError, refresh, refreshing } = usePrimeDirectory();
```
TopBar.tsx:48's `primeUser?.fullName?.trim() || userEmail` cascade is also a direct analog for D-11's audit cascade: the same `.trim()` defensiveness applies (Pitfall: empty/whitespace-only `fullName` from Prime).

**Validation pattern (input cleanup):** None of the existing form inputs validate their text — the admin page's textarea relies on `app/admin/page.tsx:169-172`'s post-save `.split(/[\n,]+/).map(e => e.trim().toLowerCase()).filter(...)` cleanup. The picker takes a different approach: D-23 mandates emails are sourced from `PrimeUser.email` (already normalized by Phase 1 — see Pitfall 4). The picker emits canonical lowercase emails by construction; no validation in the component.

**Error handling pattern:** Picker has THREE failure modes:
- `status === 'loading'` → render `Loader2` spinner (UI-SPEC Surface 10), DO NOT classify chips as historical (Pitfall 1).
- `status === 'ready' && users.length === 0` → render the "Prime directory unavailable" empty-cache state (UI-SPEC Surface 9) with the existing `RefreshCw` icon from `lucide-react`.
- `status === 'error'` → same visual as empty-cache, plus `(refresh failed)` suffix on the inline hint per UI-SPEC Surface 11.

These map to the existing admin error register (`app/admin/page.tsx:608-610` red banner; `components/ui/LoadingSpinner.tsx:22` warning palette). The picker reuses the `ErrorMessage variant="warning"` colors (`yellow-800/60`, `yellow-950/30`, `yellow-500`) without importing the component — UI-SPEC Surface 11 has the exact class list.

---

### `components/ui/PrimeUserPicker.test.tsx` (component test, jsdom)

**Analog:** **NONE** — first `.tsx` test in the project; first DOM-rendered test.

The planner relies on:
1. **Wave 0** completing the `vitest.config.ts` widening + `jsdom` install (see "Wave 0 Requirements" in 03-VALIDATION.md).
2. **`lib/prime-users.test.ts`** — best analog for **module-boundary mocking style**, even though the test environment differs (node vs jsdom).
3. **RESEARCH.md "Wave 0 Gaps"** lines 774-780 — explicit list of test cases to write.
4. **UI-SPEC §"Accessibility Acceptance Criteria"** lines 729-794 — grep-able assertions to bind tests to.

**Module-boundary mocking pattern** (prime-users.test.ts lines 38-58):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Module-boundary mocks — NEVER hit real Prime, NEVER hit real Vercel Blob.
vi.mock('./prime-auth', () => ({
  primeGet: vi.fn(),
  primeGetAllPages: vi.fn(),
}));
vi.mock('./blob-cache', () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  invalidateCache: vi.fn(),
}));

// Typed references to the mocked module exports for IDE help + assertions.
import { primeGetAllPages } from './prime-auth';
import { getCached, setCached } from './blob-cache';
const mockedPrimeGetAllPages = vi.mocked(primeGetAllPages);
const mockedGetCached = vi.mocked(getCached);
const mockedSetCached = vi.mocked(setCached);

beforeEach(() => {
  vi.resetAllMocks();
});
```

For PrimeUserPicker.test.tsx — apply the same pattern but mock the Context module instead of HTTP/blob:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
// @vitest-environment jsdom  // OR set globally in vitest.config.ts via environmentMatchGlobs
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock the Context hook so we can drive the picker through different directory states.
vi.mock('@/lib/prime-directory-context', () => ({
  usePrimeDirectory: vi.fn(),
}));

import { PrimeUserPicker } from './PrimeUserPicker';
import { usePrimeDirectory } from '@/lib/prime-directory-context';
const mockedUseDirectory = vi.mocked(usePrimeDirectory);

beforeEach(() => {
  vi.resetAllMocks();
});
```

**Fixture pattern** (prime-users.test.ts lines 60-87 — `makeUser`/`makeBlob` helpers reused; reuse the same `makeUser` shape):
```typescript
function makeUser(overrides: Partial<PrimeUser> = {}): PrimeUser {
  return {
    id: 'u1', email: 'jane@shbr.com', fullName: 'Jane Doe',
    firstName: 'Jane', lastName: 'Doe',
    division: null, region: null, roleOrTrade: null,
    status: 'active',
    ...overrides,
  };
}

function makeDirectory(overrides: Partial<{ status, users, byEmail, ... }> = {}) {
  return {
    status: 'ready' as const,
    users: [],
    byEmail: new Map(),
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    refresh: vi.fn(),
    refreshing: false,
    ...overrides,
  };
}
```

**Test-case suites** (per 03-VALIDATION.md Wave 0 + RESEARCH "Wave 0 Gaps"):
- `'PrimeUserPicker (D-22 — tri-state loading)'`: when `status='loading'`, no chip is rendered with `italic` class even if `selected` contains unknown emails (Pitfall 1).
- `'PrimeUserPicker (D-18 — filter substring across 3 fields)'`: typing 'jane' matches a user with `fullName='Jane Doe'`, AND a user with `email='jane@x.com'`, AND a user with `division='Janitorial'`.
- `'PrimeUserPicker (D-19 — keyboard nav)'`: ArrowDown advances `aria-activedescendant`; Enter on highlighted row fires `onChange`; Esc closes; Backspace on empty input removes last chip.
- `'PrimeUserPicker (D-04/D-05 — chip add/remove + alphabetical)'`: clicking row adds chip; clicking × removes; chips render in `fullName` (live) or `email` (historical) alphabetical order.
- `'PrimeUserPicker (D-07/D-08 — historical detection)'`: when `status='ready'` and an email is NOT in `byEmail`, chip has `italic` + `text-gray-500` classes.
- `'PrimeUserPicker (D-20 — empty cache)'`: when `users.length === 0` and `status='ready'`, dropdown body shows "Prime directory unavailable." + refresh button.
- `'PrimeUserPicker (Pitfall 2 — blur-swallow)'`: clicking a row fires `onChange` (not blur-then-close); verify by inspecting that listbox `<li>` has an `onMouseDown` handler that calls `preventDefault`.
- `'PrimeUserPicker (UI-SPEC §A11y — ARIA wiring)'`: search input has `role="combobox"`, `aria-controls`, `aria-expanded`, `aria-autocomplete="list"`, `aria-activedescendant`, `aria-label="Search Prime users"`; listbox has `role="listbox"`; rows have `role="option"` and `aria-selected`.

---

### `app/admin/page.test.tsx` (DOM test, jsdom)

**Analog:** **NONE** — first DOM-rendered admin page test.

Mirror the picker test harness (above) for the AuditTab cascade and filter dropdown extension. Two test suites:

**1. AuditTab actor cascade (D-11/D-12):**
Render `<AuditTab />` wrapped in `<PrimeDirectoryProvider>` (mocked via `usePrimeDirectory` mock). Provide a mocked fetch returning a fixed audit log. Assert per row:
- live-hit (email in byEmail): primary line = `live.fullName`; secondary line = email
- live-miss + saved-hit (email not in byEmail, `entry.name` set): primary = `entry.name`; secondary = email
- live-miss + saved-miss (no `entry.name`): primary = `entry.email`; NO secondary line (D-12 — avoid email/email duplication)
- live-hit but `fullName=''` after `.trim()`: cascades to `entry.name || entry.email` (Pitfall mirrored from TopBar.tsx:48)

**2. Audit filter dropdown extension (D-13):**
Render `<AuditTab />`. Assert the `<select>` contains `<option value="prime_user_miss">Prime miss</option>`. Simulate selecting it; assert the fetch URL contains `?action=prime_user_miss` (intercept via `vi.spyOn(globalThis, 'fetch')`).

**Mocking pattern (combined):**
```typescript
vi.mock('@/lib/prime-directory-context', () => ({
  usePrimeDirectory: vi.fn(),
  PrimeDirectoryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn(() => ({ isAdmin: true })) }));
// Stub next/navigation since AuditTab uses useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
```

The auth-context mock is needed because `AdminPage` imports `useAuth` (`app/admin/page.tsx:48`); the navigation mock is needed because `AuditTab` calls `useRouter` (`app/admin/page.tsx:534`). Both follow the pattern used in `app/api/auth/session/route.test.ts` for boundary mocking.

---

### `app/admin/page.tsx` (MODIFY)

**Analog:** Self — the file already establishes the visual register and section chrome. Phase 3 modifies in 5 places without restructuring the tabs.

**Modification 1 — Mount the Provider** (around line 86-122 inside `AdminPage()`):
The existing tab-switch block:
```tsx
{/* Tab content */}
<div>
  {tab === 'visibility' && <VisibilityTab />}
  {tab === 'audit'      && <AuditTab />}
  {tab === 'changelog'  && <ChangelogTab />}
</div>
```
Wrap with `<PrimeDirectoryProvider>`:
```tsx
<PrimeDirectoryProvider>
  <div>
    {tab === 'visibility' && <VisibilityTab />}
    {tab === 'audit'      && <AuditTab />}
    {tab === 'changelog'  && <ChangelogTab />}
  </div>
</PrimeDirectoryProvider>
```
Per RESEARCH Open Question 2 — Provider lives at AdminPage root so the directory survives tab switches.

**Modification 2 — Replace admin emails textarea** (lines 295-301):
The existing textarea:
```tsx
<textarea
  value={adminEmailsRaw}
  onChange={(e) => setAdminEmailsRaw(e.target.value)}
  rows={4}
  placeholder="admin@shbr.com.au&#10;manager@shbr.com.au"
  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 resize-none font-mono"
/>
```
Replace with:
```tsx
<PrimeUserPicker
  multiSelect
  selected={config.admins}
  onChange={next => setConfig(c => ({ ...c, admins: next }))}
  placeholder="Search Prime users by name, email, or division…"
  allowHistorical
/>
```
Drop the `adminEmailsRaw` state (line 141) and the merge-back logic (lines 169-172) since `config.admins` becomes the canonical source. The save handler (line 165) simplifies to `setSaving(true); ... fetch(...); ...`.

**Modification 3 — Replace GroupCard textarea** (lines 477-484):
The existing textarea inside `GroupCard`:
```tsx
<textarea
  value={group.members.join('\n')}
  onChange={(e) => onUpdateMembers(e.target.value)}
  rows={Math.max(3, Math.min(group.members.length + 1, 8))}
  className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 resize-none font-mono"
  placeholder="user@shbr.com.au"
/>
```
Replace with:
```tsx
<PrimeUserPicker
  multiSelect
  selected={group.members}
  onChange={next => onUpdateMembersList(next)}  // new prop, see below
  placeholder="Add member by name, email, or division…"
  allowHistorical
/>
```
The `onUpdateMembers(raw: string)` callback (current signature at line 460) must change to `onUpdateMembersList(emails: string[])` — direct email-array callback removes the parse step. Update the corresponding state setter at the call site.

**Modification 4 — Replace New Group form textarea** (lines 343-351):
Mirror Modification 3 inside the New Group form. Replace `newGroupEmails` state (line 138, parsed at line 199-201) with a `newGroupMembers: string[]` state.

**Modification 5 — AuditTab cascade and filter** (lines 538, 587-592, 626-635):
- Line 496: extend `ActionFilter` type:
  ```typescript
  type ActionFilter = 'all' | 'login' | 'logout' | 'prime_user_miss';
  ```
- Lines 587-592: add the new `<option>`:
  ```tsx
  <select value={actionFilter} onChange={...}>
    <option value="all">All</option>
    <option value="login">Login</option>
    <option value="prime_user_miss">Prime miss</option>
    <option value="logout">Logout</option>
  </select>
  ```
- Add `const { byEmail } = usePrimeDirectory();` near line 538 (top of `AuditTab`).
- Lines 626-635: replace the existing actor cell with the cascade per RESEARCH Pattern 4:
  ```tsx
  {entries.map(entry => {
    const live = byEmail.get(entry.email.toLowerCase());
    const displayName = live?.fullName?.trim() || entry.name || entry.email;
    const showEmailLine = displayName !== entry.email;
    return (
      <tr key={entry.id} className="hover:bg-gray-800/30 transition-colors">
        <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">{formatAEDT(entry.timestamp)}</td>
        <td className="px-4 py-3">
          <div className="text-gray-300 text-sm">{displayName}</div>
          {showEmailLine && <div className="text-gray-600 text-xs">{entry.email}</div>}
        </td>
        <td className="px-4 py-3"><ActionBadge action={entry.action} /></td>
      </tr>
    );
  })}
  ```
The CSS classes are unchanged; only the value source changes (per UI-SPEC Surface 12).

**Pair with `app/api/audit/entries/route.ts` (1-line change at line 35):**
```typescript
// Before
if (actionFilter && ['login', 'logout'].includes(actionFilter)) {
// After
if (actionFilter && ['login', 'logout', 'prime_user_miss'].includes(actionFilter)) {
```
Pitfall 6 — both sides must change together; without this, the dropdown silently no-ops.

---

### `vitest.config.ts` (MODIFY)

**Analog:** Self — the entire file is 12 lines.

**Existing** (verbatim):
```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    globals: false,
    clearMocks: true,
  },
});
```

**Phase 3 Wave 0 deltas** (per 03-VALIDATION.md "Wave 0 Requirements"):
1. Widen `include` to accept `.tsx` and `components/`:
   ```typescript
   include: [
     'lib/**/*.test.{ts,tsx}',
     'app/**/*.test.{ts,tsx}',
     'components/**/*.test.{ts,tsx}',
   ],
   ```
2. Switch to per-file environment so node tests stay fast (preferred) — use `environmentMatchGlobs` or instruct each `.tsx` test to declare `// @vitest-environment jsdom` at the top.

   **Recommended (per-file directive):** keep `environment: 'node'` as the default; add `// @vitest-environment jsdom` to each `.tsx` test file. Lower blast radius — node tests don't pay JSDOM cost.

   **Alternative (config-level):** use `environmentMatchGlobs: [['**/*.test.tsx', 'jsdom']]` if Vitest 4 supports it cleanly.

3. Add `setupFiles` if the project chooses `@testing-library/jest-dom` matchers globally:
   ```typescript
   setupFiles: ['./vitest.setup.ts'],
   ```
   With `vitest.setup.ts` containing `import '@testing-library/jest-dom/vitest';`. Alternative: import per-file. Recommend per-file for explicitness given the small number of `.tsx` tests.

The file remains < 25 lines after the changes. This is the only `vitest.config.ts` in the repo.

---

### `package.json` (MODIFY)

**Analog:** Self — current devDependencies block (lines 30-41):
```json
"devDependencies": {
  "@types/node": "^20",
  "@types/react": "^18",
  "@types/react-dom": "^18",
  "eslint": "^8",
  "eslint-config-next": "14.2.35",
  "postcss": "^8",
  "tailwindcss": "^3.4.1",
  "typescript": "^5",
  "vitest": "^4.1.5",
  "vite-tsconfig-paths": "^6.1.1"
}
```

**Phase 3 Wave 0 additions** (per 03-VALIDATION.md):
- `jsdom` — Vitest's documented JSDOM provider (~5MB unpacked).
- `@testing-library/react` — `render`, `screen`, `fireEvent`, `waitFor` for React 18 components (~50KB).
- `@testing-library/jest-dom` — `toBeInTheDocument()`, `toHaveClass()`, etc.

Suggested install command (Wave 0 task body):
```bash
npm install --save-dev jsdom @testing-library/react @testing-library/jest-dom
```
Commit `package-lock.json` alongside the `package.json` diff. No `dependencies` block changes — Phase 3 introduces zero runtime libs (verified by RESEARCH §"Standard Stack" — all picker libs already shipped).

---

## Shared Patterns

### Two-gate admin auth (used by all admin endpoints)

**Source:** `app/api/admin/prime-users/refresh/route.ts:28-40`

```typescript
const session = await getSession();
if (!session.userEmail) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const config = await getVisibilityConfig();
if (!isAdminEmail(session.userEmail, config)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Apply to:** `app/api/admin/prime-users/route.ts` (the new GET endpoint).

**Established convention:**
- 401 for missing session (also used by `/api/audit/entries` lines 12-14 with a slightly different shape: `accessToken && userEmail`).
- 403 for non-admin (also used by `/api/admin/page-visibility`); the audit endpoint deviates with 404 (lines 17-19) — see RESEARCH Open Question 1, recommendation 403 to match the immediate sibling.

`isAdminEmail(email, config)` lives at `lib/page-visibility.ts:121-129` and handles env `ADMIN_EMAIL` + config.admins + the hardcoded `chris.freeman@techgurus.com.au` fallback (CLAUDE.md known-issue note).

---

### Module-boundary mocking (Vitest)

**Source:** `lib/prime-users.test.ts:38-58` (canonical) and `app/api/auth/session/route.test.ts:4-32` (most recent application)

```typescript
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/page-visibility', () => ({
  getVisibilityConfig: vi.fn(),
  isAdminEmail: vi.fn(() => false),
}));

import { GET } from './route';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';

const mockedGetSession = vi.mocked(getSession);
const mockedConfig = vi.mocked(getVisibilityConfig);
const mockedIsAdmin = vi.mocked(isAdminEmail);

beforeEach(() => {
  vi.resetAllMocks();
});
```

**Apply to:** `app/api/admin/prime-users/route.test.ts`, `components/ui/PrimeUserPicker.test.tsx`, `app/admin/page.test.tsx`.

**Convention:** Always mock at the import boundary (the path the SUT imports from), never at the underlying transitive module. After `vi.resetAllMocks()` in `beforeEach`, restore any mock defaults that subsequent tests rely on (see session test lines 27-32 for the `mockedHidden`/`mockedIsAdmin` re-set pattern — needed because `resetAllMocks` clears default implementations).

---

### React Context Provider trio (createContext + Provider + useHook)

**Source:** `lib/auth-context.tsx` (entire 35-line file)

```typescript
'use client';
import { createContext, useContext } from 'react';

const AuthCtx = createContext<AuthContext>({ /* default value */ });

export function AuthProvider({ value, children }: { value: AuthContext; children: React.ReactNode }) {
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
```

**Apply to:** `lib/prime-directory-context.tsx` (with the smart-Provider extension — owns state + fetch).

**Convention difference for Phase 3:** The auth-context default is a populated AuthContext shape; Phase 3's default is `null` so `usePrimeDirectory()` can throw a dev-time error if used outside the Provider (RESEARCH Pattern 2 lines 369-373). This is a deliberate divergence — auth-context tolerates being read outside the AuthProvider during the initial splash render; the directory hook is consumed only inside `<AdminPage>` which guarantees the Provider is mounted.

---

### `useAuth()`-style consumer pattern

**Source:** `components/ui/Sidebar.tsx:115` and `components/ui/TopBar.tsx:45`

```typescript
const { isAdmin, hiddenPaths } = useAuth();
// or
const { primeUser, userEmail } = useAuth();
```

**Apply to:** Every Phase 3 component consuming the directory:
```typescript
const { status, users, byEmail, lastSuccessAt, lastError, refresh, refreshing } = usePrimeDirectory();
```

Used in: `PrimeUserPicker` (top-level), `AuditTab` (uses `byEmail` only).

---

### Defensive name cascade (TopBar pattern → audit cascade)

**Source:** `components/ui/TopBar.tsx:48`

```typescript
const displayName = primeUser?.fullName?.trim() || userEmail;
```

**Apply to:** `app/admin/page.tsx` AuditTab actor cell (D-11):
```typescript
const live = byEmail.get(entry.email.toLowerCase());
const displayName = live?.fullName?.trim() || entry.name || entry.email;
```

**Convention:** The `.trim()` is non-optional — Pitfall mirrored from Phase 2 (whitespace-only Prime fullName must not pass the `||` short-circuit). The 3-step cascade (live → saved → email) is a strict superset of the TopBar's 2-step cascade (live → email).

---

### Email normalization (compare-time `.toLowerCase().trim()`)

**Source:** Multiple call sites:
- `lib/page-visibility.ts:125` — `isAdminEmail`'s normalize
- `app/api/auth/login/route.ts:78` — login email normalize
- `lib/prime-users.ts:218` — `resolveByEmail`'s normalize
- `app/api/audit/entries/route.ts:23` — email filter normalize

```typescript
const normalised = email.toLowerCase().trim();  // or .trim().toLowerCase() — order doesn't matter
```

**Apply to:** Picker historical-detection lookup AND audit cascade lookup:
```typescript
const live = byEmail.get(entry.email.toLowerCase());  // entry.email already lowercased on write, but be defensive
```

The `byEmail` Map is built from `PrimeUser.email` values — Phase 1's `mapRawToPrimeUser` (`lib/prime-users.ts:105`) already lowercases on store. The lookup-side `.toLowerCase()` is belt-and-braces (Pitfall 4 — historical-detection breaks if cases differ).

---

### Form-input visual register (admin page)

**Source:** `app/admin/page.tsx:300, 340, 482, 482, 588`

```tsx
className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
```

(Audit `<select>` at line 588 uses `focus:border-red-600` — UI-SPEC §Color picks red-600 for the picker to align with the audit-side convention.)

**Apply to:** `PrimeUserPicker` search input (UI-SPEC Surface 5 has the locked class list).

---

## No Analog Found

Files / aspects with no close codebase analog (use RESEARCH.md + UI-SPEC patterns):

| File / Aspect | Reason | Where to look instead |
|---------------|--------|----------------------|
| Combobox / typeahead UI | First in codebase | RESEARCH Pattern 3 (W3C WAI-ARIA Combobox 1.2); UI-SPEC Surfaces 5-9 |
| Chip / tag primitive | First in codebase | UI-SPEC Surfaces 3-4 (live + historical variants) |
| `aria-activedescendant` virtual focus | First in codebase | RESEARCH Pattern 3 lines 393-481; UI-SPEC §A11y |
| `onMouseDown={e => e.preventDefault()}` blur-swallow fix | First in codebase | RESEARCH Pitfall 2; UI-SPEC §Focus management |
| Tri-state container (`loading | ready | error`) | First explicit pattern (most state in this project is binary `loading`/`loaded`) | RESEARCH Pattern 2 lines 299-309 + Pitfall 1 mitigation |
| `Intl.RelativeTimeFormat` time-ago | First in codebase (no date lib in deps) | UI-SPEC §Copywriting "Relative-time formatting (locked)"; RESEARCH Open Question 4 |
| JSDOM-environment Vitest test | First in project | RESEARCH "Wave 0 Gaps"; 03-VALIDATION.md §Wave 0 |
| `@testing-library/react` usage | First in project | Wave 0 install + standard `render(<Picker />)` API |
| Inline warning banner with action button | First instance (existing audit error banner is plain text) | UI-SPEC Surface 11 + the `ErrorMessage variant="warning"` color tokens from `LoadingSpinner.tsx:22` (visual peer, not code peer) |

For all of the above — the planner's plan files should reference RESEARCH.md / UI-SPEC sections as the authority, not invent net-new patterns.

---

## Metadata

**Analog search scope:**
- `app/api/admin/**` (route handlers)
- `app/api/audit/**` (route handlers + tests)
- `app/api/auth/**` (route handlers + tests — Phase 2 most-recent reference)
- `app/admin/page.tsx` (the file being modified)
- `lib/auth-context.tsx`, `lib/prime-users.ts`, `lib/page-visibility.ts`, `lib/blob-cache.ts`, `lib/prime-users.test.ts` (lib analogs)
- `components/ui/AuthGuard.tsx`, `components/ui/Sidebar.tsx`, `components/ui/TopBar.tsx`, `components/ui/LoadingSpinner.tsx` (component analogs)
- `vitest.config.ts`, `package.json` (infra)

**Files scanned:** 14 source + 3 tests = 17 total

**Pattern extraction date:** 2026-04-24

**Key insight:** Phase 1 + Phase 2 already built the heavy infrastructure (cache, refresh endpoint, two-gate admin auth, AuthContext, Vitest harness, audit log). Phase 3's three NEW source files (route, context, picker) each have a strong analog for the auth/Provider/consumer scaffolding — the only genuinely novel surface is the picker's combobox UI itself, which RESEARCH Pattern 3 + UI-SPEC handle exhaustively. Wave 0 fills the test-harness gap (jsdom + .tsx glob) so Wave 1+2 implementation can land against RED tests written against existing analogs.
