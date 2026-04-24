# Phase 2: Session & Auth Context Integration — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 8 modified, 3 new test files (11 total)
**Analogs found:** 11 / 11 (100% — strictly additive phase, every touchpoint has a direct in-tree precedent)

---

## File Classification

All files are MODIFIED except the three test scaffolds (NEW). Phase 2 introduces zero net-new runtime modules — every change is an additive edit on an existing file. Test file location depends on the Wave 0 Vitest glob decision (RESEARCH.md Pitfall 1) — both options listed.

| File | New/Modified | Role | Data Flow | Closest Analog | Match Quality |
|------|--------------|------|-----------|----------------|---------------|
| `lib/audit.ts` | Modified | model + service | file-I/O (blob append) | (self — extends existing union) | exact (self) |
| `app/api/auth/session/route.ts` | Modified | route (API) | request-response | (self — adds one `await` + one field) | exact (self) |
| `app/api/auth/login/route.ts` | Modified | route (API) | request-response | (self — adds conditional audit write) | exact (self) |
| `lib/auth-context.tsx` | Modified | provider (React context) | client-state | (self — extends interface + default) | exact (self) |
| `components/ui/AuthGuard.tsx` | Modified | component (client) | request-response → state hydration | (self — extends `setAuthCtx`) | exact (self) |
| `components/ui/TopBar.tsx` | Modified | component (client) | client-state read (via `useAuth`) | `components/ui/Sidebar.tsx` (`useAuth` consumer); self-pattern for flex-row slot | exact |
| `app/admin/page.tsx` (`ActionBadge`) | Modified (optional, planner discretion) | component (client) | client-state read | (self — extend `if/else` branches) | exact (self) |
| `vitest.config.ts` | Modified (Option A only) | config | n/a | (self — widen `include` glob) | exact (self) |
| `app/api/auth/session/route.test.ts` (Option A) **OR** `lib/auth/session-response.test.ts` (Option B) | NEW | test | request-response (mocked) | `lib/prime-users.test.ts` (module-boundary mock pattern) | exact |
| `app/api/auth/login/route.test.ts` (Option A) **OR** `lib/auth/login-miss-audit.test.ts` (Option B) | NEW | test | request-response (mocked) | `lib/prime-users.test.ts` | exact |
| `lib/audit.test.ts` | NEW | test | file-I/O (mocked blob) | `lib/prime-users.test.ts` | exact |

**Note on Option B (helper extraction):** if planner picks the helper-extraction path, two new lib files are also created: `lib/auth/session-response.ts` and `lib/auth/login-miss-audit.ts`. Both follow `lib/prime-users.ts` shape (pure async functions, no side effects beyond their declared collaborator imports).

---

## Pattern Assignments

### `lib/audit.ts` (model + service, file-I/O)

**Analog:** self — `lib/audit.ts:11-17` already defines `AuditEntry` as a tight string-literal union with one optional field (`name?: string`). D-06 extends the union by one literal and adds one optional field — identical shape evolution.

**Existing union to extend** (`lib/audit.ts:11-17`):
```typescript
export interface AuditEntry {
  id: string;
  email: string;
  name?: string;
  action: 'login' | 'logout';
  timestamp: string;
}
```

**Pattern to copy:** add `'prime_user_miss'` to the action literal union, append `detail?: string` after `timestamp`. The `appendAuditLog` signature `Omit<AuditEntry, 'id' | 'timestamp'>` widens automatically — no signature edit needed (verified `lib/audit.ts:19`).

**Backward-compat invariants:**
- Existing 200 blob rows have `action: 'login' | 'logout'`, no `detail` — both compatible with the widened types per RESEARCH.md Assumptions A2/A3.
- `app/api/audit/log/route.ts:6` `VALID_ACTIONS = ['login', 'logout'] as const` MUST stay unchanged — `prime_user_miss` is server-written from the login route only, never from the browser POST endpoint (forgery guard, RESEARCH.md Q2).

**Append/persist pattern** (`lib/audit.ts:19-40`, **do not modify**, only call):
```typescript
export async function appendAuditLog(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
  try {
    const existing = await readAuditLog();
    const newEntry: AuditEntry = {
      ...entry,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
    };
    const updated = [newEntry, ...existing].slice(0, MAX_ENTRIES);
    await put(AUDIT_BLOB_PATH, JSON.stringify(updated), {
      access: 'private', contentType: 'application/json',
      addRandomSuffix: false, allowOverwrite: true,
    });
  } catch (e) {
    console.warn('[audit] Failed to write audit log:', e);
  }
}
```

**Logging convention:** internal failures use `console.warn('[audit] ...', e)` (line 38) — the new `prime_user_miss` audit write inherits this guarantee (silent on blob-write failure).

---

### `app/api/auth/session/route.ts` (route, request-response)

**Analog:** self — `app/api/auth/session/route.ts:1-36` is the canonical pattern. Phase 2 adds one import, one `await`, one response field.

**Imports pattern to extend** (`app/api/auth/session/route.ts:1-3`):
```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, getHiddenPaths, isAdminEmail } from '@/lib/page-visibility';
// Phase 2 — ADD:
import { resolveByEmail } from '@/lib/prime-users';
```

**Route handler pattern (current shape, lines 7-36):**
```typescript
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (session.expiresAt && Date.now() > session.expiresAt) {
      session.destroy();
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }
    const config = await getVisibilityConfig();
    const isAdmin = isAdminEmail(session.userEmail || '', config);
    const hiddenPaths = getHiddenPaths(session.userEmail || '', config, isAdmin);

    return NextResponse.json({
      userName: session.userName,
      userEmail: session.userEmail,
      expiresAt: session.expiresAt,
      isAdmin,
      hiddenPaths: Array.from(hiddenPaths),
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
}
```

**Phase 2 insertion points (D-01, D-07, D-17):**
- After line 23 (after `hiddenPaths` derivation): add `const primeUser = await resolveByEmail(session.userEmail || '');` — no try/catch (Phase 1 D-16 guarantees no-throw, RESEARCH.md Pattern 2).
- Inside `NextResponse.json({...})`: add `primeUser,` as the last field.
- Replace `console.error('Session check error:', error)` with `console.error('[session] check error:', error)` to honour the D-17 prefix convention.

**Defensive call pattern (no try/catch around `resolveByEmail`):** Phase 1 contract at `lib/prime-users.ts:15-17` documents NEVER throws — outer try/catch at line 32 is the only safety net needed. Adding a nested try is dead code (RESEARCH.md Anti-Pattern).

**Auth/expiry pattern (do not modify, lines 11-19):** the early-return cascade (`!accessToken` → 401, expired → `session.destroy()` → 401) is unchanged. Phase 2 inserts AFTER this cascade — `resolveByEmail` is only called for authenticated, non-expired sessions.

---

### `app/api/auth/login/route.ts` (route, request-response)

**Analog:** self — `app/api/auth/login/route.ts:1-102`. Phase 2 adds one import + one conditional audit write after the existing `appendAuditLog({action:'login'})` call.

**Imports pattern to extend** (`app/api/auth/login/route.ts:1-4`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { appendAuditLog } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
// Phase 2 — ADD:
import { resolveByEmail, getAllPrimeUsers } from '@/lib/prime-users';
```

**Existing audit-write pattern to mirror** (`app/api/auth/login/route.ts:90-95`):
```typescript
// Log login event
await appendAuditLog({
  email: email.trim().toLowerCase(),
  name: userName,
  action: 'login',
});
```

**Phase 2 insertion (D-04, D-06) — placed AFTER `session.save()` at line 88 AND AFTER the existing `'login'` audit at lines 91-95:**
```typescript
// D-04: resolve for audit-log purpose only — NOT stored, NOT returned in response
const primeUser = await resolveByEmail(normalisedEmail);
if (!primeUser) {
  // D-06: distinguish cache-empty (Prime unreachable) from match-miss
  const allUsers = await getAllPrimeUsers();
  const detail = allUsers.length === 0 ? 'cache_empty' : 'cache_hit: no match';
  await appendAuditLog({
    email: normalisedEmail,
    name: userName,
    action: 'prime_user_miss',
    detail,
  });
}
```

**Critical ordering invariant (D-04 / RESEARCH.md Pitfall 6):** `resolveByEmail` MUST be called AFTER the OAuth-success branch (after `session.save()` at line 88). If placed earlier, failed credential attempts would burn Prime budget and write spurious miss audits. Add a trailing comment at the call site: `// D-04: called AFTER successful Prime auth only — never resolve unauthenticated emails`.

**Email normalisation pattern to reuse** (`app/api/auth/login/route.ts:78`): the existing `normalisedEmail = email.trim().toLowerCase()` is the value passed to `resolveByEmail`. `resolveByEmail` re-normalises internally (`lib/prime-users.ts:218`), so this is double-normalisation but symmetric and safe.

**Rate-limit / brute-force pattern (do not modify, lines 9-29):** the IP-based 10/15min rate limiter at the top of the handler is untouched. Phase 2 changes are interior to the OAuth-success branch only.

**Error path pattern to preserve** (lines 61-68 + 98-101): OAuth failure returns 401 BEFORE any Phase 2 code runs (the `if (!tokenResponse.ok)` guard at line 61 returns early). No Prime resolution happens on credential failure — invariant enforced by code ordering, asserted by Phase 2 test case "does NOT write `prime_user_miss` on OAuth failure".

**Response shape:** unchanged — still `{ success: true, userName }` (line 97). D-04 explicitly forbids returning `primeUser` in the login response; the only consumer is the audit log.

---

### `lib/auth-context.tsx` (provider, client-state)

**Analog:** self — `lib/auth-context.tsx:1-32`. Phase 2 extends the interface + the createContext default + (transitively) AuthGuard's initial useState.

**Current full file pattern to extend** (`lib/auth-context.tsx:1-31`):
```typescript
'use client';

import { createContext, useContext } from 'react';

export interface AuthContext {
  userEmail: string;
  userName: string;
  isAdmin: boolean;
  hiddenPaths: Set<string>;
}

const AuthCtx = createContext<AuthContext>({
  userEmail: '',
  userName: '',
  isAdmin: false,
  hiddenPaths: new Set(),
});

export function AuthProvider({ value, children }: { value: AuthContext; children: React.ReactNode }) {
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
```

**Phase 2 edits (D-08):**
1. Add import: `import type { PrimeUser } from '@/lib/prime-users';` (after line 3).
2. Append to interface (after line 9): `primeUser: PrimeUser | null;`
3. Append to createContext default (after line 16): `primeUser: null,` — explicit null per RESEARCH.md Pitfall 4 (TypeScript will accept `undefined` but the consumer-side type must remain `PrimeUser | null`).

**Default-value-completeness invariant:** every field in the interface MUST also exist in the createContext default. Adding `primeUser` to the interface alone causes runtime `undefined` when `useAuth()` is called outside an `AuthProvider` (rare but possible in test renders). Three touchpoints, same diff: interface + createContext default + AuthGuard initial useState (next file).

**No provider/useAuth signature changes** — `AuthProvider({value, children})` and `useAuth()` are untouched. All Phase 2 plumbing rides the existing `value` prop.

---

### `components/ui/AuthGuard.tsx` (component, request-response → state hydration)

**Analog:** self — `components/ui/AuthGuard.tsx:1-112`. Phase 2 extends two state operations: the initial `useState` default and the post-fetch `setAuthCtx`.

**Initial useState pattern to extend** (`components/ui/AuthGuard.tsx:16-21`):
```typescript
const [authCtx, setAuthCtx] = useState<AuthContext>({
  userEmail: '',
  userName: '',
  isAdmin: false,
  hiddenPaths: new Set(),
});
```

**Phase 2 edit:** append `primeUser: null,` as the 5th field (matches the AuthContext default in `lib/auth-context.tsx`).

**Fetch + hydrate pattern to extend** (`components/ui/AuthGuard.tsx:36-58`):
```typescript
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
    });
    setAuthed(true);
    setChecking(false);
  })
  .catch(() => {
    router.replace('/login');
  });
```

**Phase 2 edit (D-08, D-09):** append `primeUser: data.primeUser ?? null,` as the 5th field inside `setAuthCtx({...})`. The `?? null` is the defensive coercion — if the server omits the field (e.g., during a partial deploy), the client renders the fallback rather than `undefined`.

**Single-fetch-site invariant (D-09, RESEARCH.md Q1):** AuthGuard.tsx is the ONLY file in the tree that fetches `/api/auth/session`. Verified via `app/layout.tsx:21` — AuthGuard wraps the entire app. No other component (TopBar, Sidebar, admin pages) makes its own session fetch — they all consume `useAuth()`. Phase 2 does NOT add a second fetch site; the new `primeUser` field rides this same fetch.

**AuthProvider wrapping pattern (do not modify, lines 81 + 94):** AuthGuard wraps children with `<AuthProvider value={authCtx}>` in two branches — kiosk mode (line 81) and full shell (line 94). Both branches automatically receive the extended `authCtx` since they share the single `useState`.

---

### `components/ui/TopBar.tsx` (component, client-state read)

**Primary analog:** self — `components/ui/TopBar.tsx:93-114` (existing flex-row slot pattern).
**Secondary analog:** `components/ui/Sidebar.tsx:41` — canonical `useAuth` consumer pattern (`import { useAuth } from '@/lib/auth-context';`).

**Existing flex-row pattern to extend** (`components/ui/TopBar.tsx:93-114`):
```typescript
return (
  <div className="flex items-center gap-4 text-sm overflow-hidden">
    {/* Weather */}
    {weather && (
      <div className="flex items-center gap-1.5 text-gray-400">
        <WeatherIcon code={weather.code} size={15} />
        <span className="font-mono text-white">{weather.temp}°C</span>
        <span className="hidden sm:inline text-gray-500">{weather.description}</span>
        <span className="text-gray-600 hidden sm:inline">· Sydney</span>
      </div>
    )}

    {/* Divider */}
    {weather && <div className="w-px h-4 bg-gray-700 hidden sm:block" />}

    {/* Date + Clock */}
    <div className="flex items-center gap-2 text-gray-400">
      <span className="hidden md:inline">{sydneyDate}</span>
      <span className="font-mono text-white tabular-nums">{sydneyTime}</span>
    </div>
  </div>
);
```

**TopBar visual conventions extracted (verified):**
- Outer container: `flex items-center gap-4 text-sm overflow-hidden` (line 94)
- Sub-item wrapping: `flex items-center gap-1.5 text-gray-400` with bright nested text (`text-white`)
- Conditional render via `&&` — every slot is `{value && <...>}`
- Conditional divider after each slot: `w-px h-4 bg-gray-700 hidden sm:block`
- Responsive secondary text: `hidden sm:inline` / `hidden md:inline`
- Numeric/monospace text: `font-mono text-white` (clock uses `tabular-nums` extra)

**Phase 2 edits (D-10, D-11, DISPLAY-04, UI-SPEC):**
1. Add `'use client'` is already present (line 1) — no change.
2. Add import: `import { useAuth } from '@/lib/auth-context';` (after the `lucide-react` import block).
3. Inside `TopBar()`, after the existing useState declarations: `const { primeUser, userEmail } = useAuth();` then `const displayName = primeUser?.fullName?.trim() || userEmail;` (D-10 cascade — verbatim, no helper).
4. Prepend a new flex slot at the START of the outer flex row (UI-SPEC declares "leftmost slot, before weather"):
```tsx
{/* Identity label — leftmost slot, added in Phase 2 (DISPLAY-04) */}
{displayName && (
  <div className="max-w-[200px] truncate text-gray-300">
    {displayName}
  </div>
)}
```
5. Optionally add a divider after the identity label following the existing pattern: `{displayName && weather && <div className="w-px h-4 bg-gray-700 hidden sm:block" />}` — UI-SPEC marks this as "only if visual testing shows crowding".

**Anti-pattern reminder:** do NOT import `resolveByEmail` (server-only — pulls in `@/lib/blob-cache`). Identity flows in via `useAuth()`, not via direct API call.

**Reference for `useAuth` consumer pattern** — `components/ui/Sidebar.tsx:41`:
```typescript
import { useAuth } from '@/lib/auth-context';
// later: const { isAdmin, hiddenPaths } = useAuth();
```
Sidebar's destructure-from-useAuth pattern is the established convention; TopBar follows it identically.

**Color contract from UI-SPEC (binding):** identity label uses `text-gray-300` (one shade brighter than weather's `text-gray-400`). Brand red (`#DC2626`) is RESERVED for active sidebar nav items + alerts — must NOT appear on the identity label. Contrast ratio ~13.3:1 (WCAG AAA).

**No tooltip / `title` attribute** (UI-SPEC Accessibility) — `truncate` clips visually but the full string remains in the DOM for screen readers.

---

### `app/admin/page.tsx` `ActionBadge` (component, client-state read) — OPTIONAL, planner discretion

**Analog:** self — `app/admin/page.tsx:508-513`. Two-branch literal-action switch.

**Existing pattern** (`app/admin/page.tsx:508-513`):
```typescript
function ActionBadge({ action }: { action: string }) {
  if (action === 'login') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-400 border border-green-800">Login</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">Logout</span>;
}
```

**Phase 2 issue (RESEARCH.md Pitfall 3):** new `'prime_user_miss'` rows fall through to the gray `Logout` badge. Two planner options:
1. Add a third branch in Phase 2 (e.g., amber "Miss" badge using the same `inline-flex` shell):
```typescript
if (action === 'prime_user_miss') {
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/50 text-amber-400 border border-amber-800">Miss</span>;
}
```
2. Defer to Phase 3 (DISPLAY-03) and document in Phase 2 SUMMARY Deviations.

**Tailwind class shape to copy:** `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-{color}-900/50 text-{color}-400 border border-{color}-800` — preserves visual rhythm with existing Login/Logout badges.

---

### `vitest.config.ts` (config) — Wave 0 gate, only edit if Option A

**Current pattern** (`vitest.config.ts:1-12`):
```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    globals: false,
    clearMocks: true,
  },
});
```

**Option A edit (RESEARCH.md Pitfall 1):**
```typescript
include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
```
**Option B (helper extraction):** no edit — keep glob narrow, put helper tests under `lib/auth/*.test.ts` which the existing glob already covers.

---

### Test files — `app/api/auth/session/route.test.ts` / `app/api/auth/login/route.test.ts` / `lib/audit.test.ts` (NEW)

**Analog:** `lib/prime-users.test.ts` — the canonical Phase 1 test pattern (20 green tests, module-boundary mocking).

**Imports + mock pattern to copy** (`lib/prime-users.test.ts:26-47`):
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

**For `app/api/auth/session/route.test.ts` — Phase 2 mock surface:**
```typescript
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/page-visibility', () => ({
  getVisibilityConfig: vi.fn(),
  getHiddenPaths: vi.fn(() => new Set<string>()),
  isAdminEmail: vi.fn(() => false),
}));
vi.mock('@/lib/prime-users', () => ({ resolveByEmail: vi.fn() }));

import { GET } from './route';
```
Mocking `@/lib/session` directly (not `next/headers` + `iron-session`) is the recommended pattern (RESEARCH.md Pitfall 2) — fewer mocks, matches Phase 1 boundary convention.

**Test fixture helper pattern to mirror** (`lib/prime-users.test.ts:60-87`): builds `makeUser()` and `makeBlob()` factory helpers at file top to keep per-test boilerplate minimal. Phase 2 should mirror — e.g., `makeSession()` and `makePrimeUser()` factories at the top of each test file.

**Test naming pattern** (`lib/prime-users.test.ts:89, 321, 403`): `describe('functionName (REQ-ID)', ...)` — top-level describe blocks are tagged with the requirement IDs they cover (e.g., `describe('GET /api/auth/session (SESSION-01, SESSION-03)', ...)`).

**Assertion style** (`lib/prime-users.test.ts:322-336`): single-responsibility tests, one behaviour per `it()`, both positive case and negative case (`expect(...).toEqual(...)` AND `expect(mockedX).not.toHaveBeenCalled()`).

**Console-spy pattern** (`lib/prime-users.test.ts:352, 394`): for tests that exercise an error path with logging, wrap with `vi.spyOn(console, 'error').mockImplementation(() => {})` and `spy.mockRestore()` at the end. Phase 2 login-route test for OAuth failure should adopt the same to avoid noisy stderr.

**Test target list (D-14):**
- `lib/audit.test.ts` — new `'prime_user_miss'` literal serialises round-trip (write → read).
- `app/api/auth/session/route.test.ts` (or `lib/auth/session-response.test.ts`):
  - returns `primeUser` from `resolveByEmail`
  - returns `primeUser: null` when `resolveByEmail` returns null
  - does NOT call `appendAuditLog` (D-05 invariant — verify by mocking `@/lib/audit` and asserting `appendAuditLog` not called, OR rely on absence-of-import test by inspecting source via fs read — recommend explicit mock)
  - response shape regression: `userName`, `userEmail`, `expiresAt`, `isAdmin`, `hiddenPaths` still present
- `app/api/auth/login/route.test.ts` (or `lib/auth/login-miss-audit.test.ts`):
  - calls `resolveByEmail` with normalised email
  - writes `'prime_user_miss'` audit with `detail: 'cache_empty'` when `getAllPrimeUsers` returns `[]`
  - writes `'prime_user_miss'` audit with `detail: 'cache_hit: no match'` when `getAllPrimeUsers` returns non-empty + `resolveByEmail` returns null
  - does NOT write `'prime_user_miss'` audit when OAuth fails (D-04 invariant — assert via `mockedAppend` call count)
  - existing `'login'` audit still fires once on success

---

## Shared Patterns

### Logging prefix convention (D-17, follows Phase 1 D-18)
**Source:** `lib/prime-users.ts` consistently uses `[prime-users]` prefix; `lib/audit.ts:38` uses `[audit]`.
**Apply to:** Phase 2 console output from `/api/auth/session/route.ts` and `/api/auth/login/route.ts` for Phase-2-specific reasons uses `[session]` prefix.
```typescript
console.error('[session] check error:', error);
```
**Do not double-log:** if `resolveByEmail` internally logs via `[prime-users]` (which it does on cache failure), the session route MUST NOT log a second time (D-18) — silently let `primeUser` be `null` in the response.

### Defensive call to never-throwing module (D-04 / Phase 1 D-16)
**Source:** `lib/prime-users.ts:15-17` — contractual no-throw guarantee for `getAllPrimeUsers` and `resolveByEmail`.
**Apply to:** all Phase 2 callers of `resolveByEmail`/`getAllPrimeUsers`. NO try/catch around these calls — the existing outer try at session route (line 32) and login route (line 31) is the only safety net needed. Adding a nested try is dead defensive code (RESEARCH.md Anti-Pattern).

### Email normalisation invariant (D-09 COMPARE from Phase 1)
**Source:** `app/api/auth/login/route.ts:78` — `const normalisedEmail = email.trim().toLowerCase();`
**Source:** `lib/prime-users.ts:218` — `resolveByEmail` re-normalises internally.
**Apply to:** any call to `resolveByEmail` from Phase 2 should pass an already-trimmed-lowercased email when available, but double-normalisation is safe and idempotent. Test fixtures should use lowercase emails to mirror production.

### Single-fetch-site invariant for AuthContext hydration (D-09)
**Source:** `components/ui/AuthGuard.tsx:36-58` — sole `fetch('/api/auth/session')` site in the tree.
**Apply to:** Phase 2 MUST NOT add a second `/api/auth/session` fetch from TopBar, picker, or any other component. New `primeUser` field rides the existing fetch via the `setAuthCtx` extension. RESEARCH.md Anti-Pattern: "Adding a second /api/auth/prime-user endpoint" is rejected.

### Module-boundary mocking for tests (Phase 1 convention)
**Source:** `lib/prime-users.test.ts:39-47` — mocks at the import boundary (`vi.mock('./prime-auth', ...)` rather than mocking deeper internals like `fetch`).
**Apply to:** all three Phase 2 test files. For session-route test, mock `@/lib/session`, `@/lib/page-visibility`, `@/lib/prime-users`. For login-route test, mock `@/lib/session`, `@/lib/audit`, `@/lib/prime-users`, plus `global.fetch` for the Prime OAuth call.

### Tailwind dark-theme color tokens (UI-SPEC + project-wide)
**Source:** `app/globals.css:7` — body bg `#030712`; `tailwind.config.ts` brand red `#DC2626`.
**TopBar text shades observed** (`components/ui/TopBar.tsx:97, 99, 101, 109`):
- `text-gray-400` — chrome / labels (weather metadata)
- `text-gray-500` — secondary labels (weather description)
- `text-gray-600` — tertiary (location suffix "· Sydney")
- `text-white` — primary numeric values (temperature, time)
**Phase 2 identity label** uses `text-gray-300` (one shade brighter than `text-gray-400`) per UI-SPEC — slot between chrome and primary, signalling "this is who you are" without competing with the active-nav red accent.

### Truncation pattern for variable-width text
**Source:** Sidebar user slot (referenced by UI-SPEC) and weather description.
**Apply to:** identity label uses `max-w-[200px] truncate` (UI-SPEC §Typography). The container clips long names with CSS ellipsis; the full string remains in the DOM for screen readers (no `title` attribute needed per UI-SPEC §Accessibility).

---

## No Analog Found

**None.** Every Phase 2 file has either an exact self-pattern (existing file being modified) or a direct sibling in the tree (`lib/prime-users.test.ts` for new test files; `components/ui/Sidebar.tsx` for `useAuth` consumer). This is consistent with RESEARCH.md's HIGH-confidence claim that Phase 2 has zero novel primitives.

---

## Pitfall-Driven Pattern Reinforcements

These are not new analogs but cross-cutting reminders the planner must encode in plan tasks:

| Pitfall | Pattern Reinforcement |
|---------|----------------------|
| Pitfall 1 (Vitest glob) | Wave 0 gate — pick Option A (widen glob) OR Option B (extract helpers); planner's call. Plan task must close this BEFORE any Wave 1 test lands. |
| Pitfall 2 (cookies() in test) | Mock `@/lib/session` at the boundary, NOT `next/headers` directly — matches `lib/prime-users.test.ts:39-47` boundary convention. |
| Pitfall 3 (ActionBadge fallthrough) | Either edit `app/admin/page.tsx:508-513` in Phase 2 OR document as Phase 3 deferral in SUMMARY. Planner's call — recommend the 2-line edit to avoid shipping misleading "Logout" badges. |
| Pitfall 4 (AuthContext default drift) | Three-touchpoint diff: interface (`lib/auth-context.tsx:5-10`) + createContext default (lines 12-17) + AuthGuard initial useState (`components/ui/AuthGuard.tsx:16-21`). All three MUST get `primeUser: null` in the same commit. |
| Pitfall 5 (whitespace fullName) | D-10 cascade `primeUser?.fullName?.trim() || userEmail` is mandatory in TopBar. Test case asserts `"   "` Prime name falls through to email. |
| Pitfall 6 (login ordering) | `resolveByEmail` MUST be placed AFTER `session.save()` at `app/api/auth/login/route.ts:88`. Add inline comment `// D-04: post-auth only`. Test asserts `mockedResolve` not called when OAuth returns 401. |

---

## Metadata

**Analog search scope:**
- `app/api/auth/**` (login, session, logout routes)
- `lib/*.ts` (audit, session, prime-users, auth-context, page-visibility, blob-cache)
- `lib/prime-users.test.ts` (Phase 1 test harness — freshest)
- `components/ui/AuthGuard.tsx`, `TopBar.tsx`, `Sidebar.tsx`
- `app/admin/page.tsx` (`ActionBadge` + audit table consumer)
- `app/api/audit/log/route.ts` (`VALID_ACTIONS` allowlist)
- `app/layout.tsx` (AuthGuard wrapping site)
- `vitest.config.ts` (test discovery glob)
- `.planning/phases/01-prime-user-directory/*` (Phase 1 module shipping)

**Files scanned:** 16
**Phase 1 commits referenced:** f29db2b (merged Phase 1 — `lib/prime-user-directory.ts`, `resolveByEmail()`, audit-log structure)
**Pattern extraction date:** 2026-04-24
**Confidence:** HIGH — every excerpt is verified against the working tree at the cited line numbers.
