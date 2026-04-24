# Phase 2: Session & Auth Context Integration — Research

**Researched:** 2026-04-24
**Domain:** Next.js 14 App Router session plumbing + Vitest route-handler testing + React context propagation
**Confidence:** HIGH (every claim about existing files is code-verified from the working tree; one Vitest ergonomics finding cross-checked against official Next.js 16.2 docs dated 2026-04-21)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Attribute freshness & storage shape**
- **D-01:** Prime attributes are derived at session-check time via `resolveByEmail()`, not stored in the iron-session cookie. `/api/auth/session` calls `resolveByEmail(session.userEmail)` on every request and returns the result.
- **D-02:** REQUIREMENT AMENDMENT — SESSION-01 and ROADMAP Phase 2 SC #1 are updated to replace "stored in the iron-session cookie" with "derived at session-check time via `resolveByEmail()` and exposed through `/api/auth/session`". The amendment is committed alongside this CONTEXT.md.
- **D-03:** `SessionData` is not extended with Prime fields. The iron-session cookie keeps its current shape (`accessToken, refreshToken, expiresAt, userName, userEmail`). In-flight 8h cookies are forward-compatible.

**Login-time resolution + audit log**
- **D-04:** Login calls `resolveByEmail()` exactly once (after OAuth + email normalisation) for the sole purpose of writing the audit-log entry on a miss. Session-check continues to call `resolveByEmail()` for delivery freshness. First-miss bootstrap (Phase 1 D-03) — acceptable trigger.
- **D-05:** `/api/auth/session` does NOT write audit entries for unresolved users — only login does. Avoids log spam (session is polled per page navigation).
- **D-06:** New audit event type `PRIME_USER_MISS` added to `lib/audit.ts`. Entry shape matches existing audit rows (timestamp, actor email, event type, optional detail). Detail field: `"cache_hit: no match"` vs `"cache_empty"`.

**API response + AuthContext shape**
- **D-07:** `/api/auth/session` response is extended with a nested `primeUser: PrimeUser | null` field, placed alongside existing `userName`, `userEmail`, `expiresAt`, `isAdmin`, `hiddenPaths`. Type imported from `lib/prime-users.ts` verbatim — no Phase-2-only variant.
- **D-08:** `AuthContext` (`lib/auth-context.tsx`) extended with `primeUser: PrimeUser | null`. Existing consumers (`isAdmin`, `hiddenPaths`) are untouched; `primeUser` is additive.
- **D-09:** Root layout / session provider plumbing — wherever the AuthContext provider is currently wired, Phase 2 threads `primeUser` through the same path. No new fetch calls; existing session fetch is extended.

**Display name fallback + TopBar surface**
- **D-10:** Display-name fallback cascade: `primeUser?.fullName?.trim() || session.userEmail`. Treats empty / whitespace-only Prime strings as missing. One-liner; no utility function needed.
- **D-11:** TopBar adds a compact user-identity surface where there is none today. Phase 2 introduces the first user-identity render — a minimal text label (name with email fallback). No avatar, no admin badge.
- **D-12:** Phase 2 renders user-identity in TopBar only. AuthContext exposes `primeUser` so Phase 3 components can consume it without additional plumbing.
- **D-13:** Division, region, role/trade are NOT rendered in Phase 2 UI. Probe confirmed these are always `null` in the current tenant. AuthContext still carries them.

**Test strategy**
- **D-14:** Continue the Vitest harness from Phase 1. New test files follow the co-located `*.test.ts` pattern. Test targets: `app/api/auth/login/route.ts`, `app/api/auth/session/route.ts`, `lib/audit.ts`.
- **D-15:** No integration tests for AuthContext/TopBar in this phase. AuthContext plumbing is covered at API response level; TopBar rendering is covered by manual smoke.
- **D-16:** Contract tests first, implementation second — for the two API route handlers, write Vitest cases before the handler changes.

**Operational / observability**
- **D-17:** `[session]` log prefix — Phase-2-specific `console.error`/`console.warn` from session or login routes uses `[session]` prefix (follows Phase 1 D-18 convention).
- **D-18:** No per-request `resolveByEmail` failure logging. If the blob-cache read throws, the session route returns `primeUser: null` silently — Phase 1's `[prime-users]` module already owns cache-error logging.
- **D-19:** No telemetry on Prime attr churn. If admin refresh changes a user's display name mid-session, the next `/api/auth/session` call silently returns the new value.

**Scope guardrails**
- **D-20:** No changes to Prime OAuth flow, cookie TTL, or session destroy behavior. Phase 2 is strictly additive.
- **D-21:** No iron-session cookie shape migration. D-03 locks this.
- **D-22:** No `/api/auth/logout` changes.

### Claude's Discretion
- Exact Vitest ergonomics for mocking `next/headers` cookies + `iron-session` in route-handler tests (planner picks the mock shape).
- Whether to extend `vitest.config.ts` `include` glob to cover `app/**/*.test.ts` (see Pitfall 1 — this is blocking for D-14).
- Exact TopBar visual placement of identity label (left / right / which flex slot).
- Whether the AuthContext default value also gets `primeUser: null` added (trivial — keep defaults complete).
- Whether `PRIME_USER_MISS` is modelled as a new literal in `AuditEntry['action']` union or as a sibling field (see Open Question 2 resolution below).

### Deferred Ideas (OUT OF SCOPE)
- Admin picker UI (ADMIN-01..05) — Phase 3.
- Group/admin list identity rendering (DISPLAY-01..02) — Phase 3.
- Audit-log actor display (DISPLAY-03) — Phase 3.
- Division / region / role rendering in any UI — probe-confirmed always null in tenant.
- Eagerly pre-building Phase 3 scaffolding.
- Per-request audit on session-check misses — rejected as spam.
- Session cookie schema evolution — not needed.
- Telemetry on Prime attr change mid-session.
- In-memory memoization of `resolveByEmail` at the session-route layer — premature optimization (Phase 1 blob-cache already in front).
</user_constraints>

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESSION-01 | Prime attrs derived at session-check via `resolveByEmail()`, exposed through `/api/auth/session` (amended by D-02) | `resolveByEmail()` exists and works; `/api/auth/session/route.ts:7-36` is trivially extendable with one await call — see "Current session route shape" below |
| SESSION-02 | Login still succeeds if email not resolvable in Prime directory; `primeUser: null` and audit entry recorded | `resolveByEmail()` returns `null` on miss without throwing (Phase 1 D-16); `appendAuditLog` is already called from login route on every success — one more call on miss is symmetric |
| SESSION-03 | `/api/auth/session` returns Prime-sourced attrs alongside existing fields | One-field extension to the existing `NextResponse.json(...)` body — see "Current session route shape" |
| SESSION-04 | `AuthContext` exposes Prime user attrs to client components without additional fetches | `AuthGuard.tsx` is the single point that fetches `/api/auth/session` and hydrates AuthContext — single-edit plumbing path |
| DISPLAY-04 | TopBar shows Prime display name (fallback to email) | `TopBar.tsx` currently has no identity surface; one insert point needed. `useAuth()` already wired |

---

## Summary

Phase 2 is **strictly additive plumbing** with zero architectural novelty. Every primitive the phase needs already exists in the working tree:

- `resolveByEmail(email: string): Promise<PrimeUser | null>` — shipped by Phase 1, never throws, handles empty input defensively
- `PrimeUser` type — 9 exported fields (`id, email, fullName, firstName, lastName, division, region, roleOrTrade, status`)
- `appendAuditLog()` — already writes to blob audit log with `Omit<AuditEntry, 'id' | 'timestamp'>`
- `AuthProvider` / `useAuth()` — React context with 4 fields today (add a 5th)
- `AuthGuard.tsx` — the single point where `/api/auth/session` is fetched and its payload hydrates AuthContext
- Vitest harness — 20/20 green tests from Phase 1 with module-boundary mock patterns that transfer directly

**Primary recommendation:** Five discrete edits, testable contract-first (D-16):

1. Extend `AuditEntry['action']` to union `'login' | 'logout' | 'prime_user_miss'` and add a `detail?: string` field (additive, backward-compatible with existing rows that have no `detail`).
2. Add a `resolveByEmail()` call + audit log write to `app/api/auth/login/route.ts` (one `await`, one `if`, one audit entry on miss — no shape change to the login response).
3. Add a `resolveByEmail()` call to `app/api/auth/session/route.ts` and extend the response body with `primeUser: PrimeUser | null`.
4. Extend `AuthContext` interface + default value + `AuthGuard` hydration step with `primeUser` (three line-edits in two files).
5. Render the display-name fallback in `TopBar.tsx` using `useAuth()` (new JSX slot at the start of the existing flex row).

**Blocking planning gate:** The current `vitest.config.ts` scopes tests to `include: ['lib/**/*.test.ts']`. Phase 2 needs tests under `app/api/auth/**` per D-14 — either (a) co-locate handler tests, which requires widening the include glob, or (b) put handler behavior tests in `lib/` alongside a thin extractable helper. See Pitfall 1 and Wave 0 Gaps. **Planner must choose one of these two approaches explicitly.**

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login-time Prime resolution | API / Backend | — | `resolveByEmail` is server-only (reads env vars via `@vercel/blob`); login route is the sole caller for the audit-log path |
| Session-check-time Prime resolution | API / Backend | — | Server-only; blob-cache + potential first-miss Prime fetch must stay behind the API boundary |
| Audit log write on Prime miss | API / Backend | Database / Storage (Vercel Blob) | `lib/audit.ts:appendAuditLog` already owns blob write; login route is the caller |
| Prime identity in AuthContext | Frontend Server (SSR handoff) → Browser / Client | API / Backend (source) | API route produces the JSON; `AuthGuard` client component hydrates context with the JSON payload; child components consume via `useAuth()` |
| TopBar identity render | Browser / Client | — | Pure client component; reads `useAuth()` context; zero new network calls |

**Tier violations to prevent:**
- Do NOT call `resolveByEmail` from a client component or from the TopBar — it's server-only (imports `@/lib/blob-cache`).
- Do NOT add a second `/api/auth/session` call from TopBar or any other component — `AuthGuard` is the single fetch site; `primeUser` rides the existing fetch.
- Do NOT persist `primeUser` to the iron-session cookie (D-03 locks this).

---

## Standard Stack

### Core (all already installed — Phase 2 adds zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.35 | App Router + route handlers + `next/headers` | Project-locked framework; no migration in scope `[VERIFIED: package.json:22]` |
| react | ^18 | Context provider + `useContext` hook | Existing AuthContext is a React context `[VERIFIED: lib/auth-context.tsx]` |
| iron-session | ^8.0.4 | Encrypted cookie storage for `SessionData` | In use today; not being migrated `[VERIFIED: package.json:19]` |
| @vercel/blob | ^2.3.1 | Audit-log persistence + directory blob reads | Already persists `audit/audit-log.json` and `shbr-admin/prime-users.json` `[VERIFIED: lib/audit.ts, lib/prime-users.ts]` |
| vitest | ^4.1.5 | Test runner for Phase 2 contract tests | Installed Phase 1, 20 green tests `[VERIFIED: package.json:39]` |
| vite-tsconfig-paths | ^6.1.1 | `@/` alias resolution in tests | Installed Phase 1 `[VERIFIED: package.json:40]` |
| typescript | ^5 | Compile-time safety for extended types | Project language `[VERIFIED: package.json:38]` |

### Alternatives Considered (rejected)

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| Extending `/api/auth/session` | Create `/api/auth/prime-user` sibling | Double round-trip in browser; no functional benefit; violates D-09 ("no new fetch calls") |
| Storing `primeUser` in iron-session cookie | Persist on login, read on session check | Locked `NO` by D-01 — 8h staleness and cookie bloat |
| `next-test-api-route-handler` library for route tests | Mock `next/headers` + `iron-session` directly | Extra dependency; Phase 1 mock pattern transfers directly to route handlers (see Code Examples below) |
| Custom React server component pattern | Keep client-side fetch via `AuthGuard` | `AuthGuard` is already the single gate — rewriting to RSC is out of scope |

**Installation:** no `npm install` needed for Phase 2. `[VERIFIED: package.json — existing dependency set sufficient]`

---

## Architecture Patterns

### System Architecture Diagram

```
                   ┌──────────────────────────────────────────────┐
                   │ Browser / login form                          │
                   └──────────────────────────────────────────────┘
                                │ POST email + password
                                ▼
              ┌───────────────────────────────────────────┐
              │ app/api/auth/login/route.ts               │
              │ 1. Prime OAuth (unchanged)                │
              │ 2. email.trim().toLowerCase() (unchanged) │
              │ 3. session.save() (unchanged)             │
              │ 4. appendAuditLog({action:'login'}) ✓     │
              │ 5. ★ resolveByEmail(normalisedEmail)      │
              │ 6. ★ if null → appendAuditLog({           │
              │       action: 'prime_user_miss',          │
              │       detail: 'cache_empty'|'cache_hit:…'})│
              └───────────────────────────────────────────┘
                                │ 200 { success, userName }
                                ▼
                   ┌──────────────────────────────────────────────┐
                   │ Client-side redirect to /                     │
                   └──────────────────────────────────────────────┘
                                │
                                ▼
              ┌───────────────────────────────────────────┐
              │ components/ui/AuthGuard.tsx (client)      │
              │ fetch('/api/auth/session')                │
              └───────────────────────────────────────────┘
                                │
                                ▼
              ┌───────────────────────────────────────────┐
              │ app/api/auth/session/route.ts             │
              │ 1. getSession() (unchanged)               │
              │ 2. getVisibilityConfig() (unchanged)      │
              │ 3. isAdminEmail + getHiddenPaths(unchanged)│
              │ 4. ★ resolveByEmail(session.userEmail)    │
              │    → PrimeUser | null                     │
              │ 5. Response JSON includes ★ primeUser     │
              └───────────────────────────────────────────┘
                                │
                                ▼
              ┌───────────────────────────────────────────┐
              │ AuthGuard.setAuthCtx({ userEmail,         │
              │   userName, isAdmin, hiddenPaths,         │
              │   ★ primeUser                             │
              │ })                                         │
              │ <AuthProvider value={authCtx}>            │
              └───────────────────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
      ┌────────┐   ┌────────┐   ┌────────────┐
      │Sidebar │   │admin/  │   │ ★ TopBar   │
      │useAuth │   │useAuth │   │   useAuth  │
      │ already│   │ already│   │   renders  │
      │wired   │   │wired   │   │   name ||  │
      │        │   │        │   │   email    │
      └────────┘   └────────┘   └────────────┘
```

★ = change introduced by Phase 2.

### Component Responsibilities

| File | Current role | Phase 2 change |
|------|-------------|----------------|
| `lib/prime-users.ts` | Cached Prime directory; exports `resolveByEmail`, `PrimeUser` | **No change** — consumed as-is |
| `lib/session.ts` | iron-session wrapper; exports `getSession`, `SessionData` | **No change** per D-03 / D-21 |
| `lib/audit.ts` | Audit log append + read | Add `'prime_user_miss'` to action union; add optional `detail?: string` field |
| `lib/auth-context.tsx` | React context with `{userEmail, userName, isAdmin, hiddenPaths}` | Add `primeUser: PrimeUser | null` to interface + default |
| `app/api/auth/login/route.ts` | POST login → Prime OAuth → session save → audit | Add `resolveByEmail` call + conditional miss-audit write |
| `app/api/auth/session/route.ts` | GET session → 401 / 401 / 200 w/ auth ctx | Add `resolveByEmail` call; extend response body with `primeUser` |
| `components/ui/AuthGuard.tsx` | Fetch session → hydrate AuthContext → wrap children | Extend `authCtx` state + setter to carry `primeUser` |
| `components/ui/TopBar.tsx` | Clock + weather | Prepend identity label using `useAuth().primeUser?.fullName?.trim() || useAuth().userEmail` |

### Pattern 1: Extending an existing API response additively

**What:** Add a new field to an existing JSON response without breaking existing consumers.
**When to use:** Phase 2 edits `/api/auth/session` — all current callers (AuthGuard) will be updated in the same phase; no external consumer exists.
**Example:**
```typescript
// Current: app/api/auth/session/route.ts:25-31 [VERIFIED]
return NextResponse.json({
  userName: session.userName,
  userEmail: session.userEmail,
  expiresAt: session.expiresAt,
  isAdmin,
  hiddenPaths: Array.from(hiddenPaths),
});

// Phase 2 shape:
const primeUser = await resolveByEmail(session.userEmail);  // never throws (Phase 1 D-16)
return NextResponse.json({
  userName: session.userName,
  userEmail: session.userEmail,
  expiresAt: session.expiresAt,
  isAdmin,
  hiddenPaths: Array.from(hiddenPaths),
  primeUser,  // PrimeUser | null
});
```

### Pattern 2: Defensive call to a never-throwing API

**What:** Invoke a function that is contractually non-throwing, without a try/catch.
**When to use:** `resolveByEmail` is contract-documented "NEVER throws" (`lib/prime-users.ts:18-19`, Phase 1 D-16). Session route does NOT need a surrounding try for the new call; the existing outer try remains as infrastructure safety net.
**Example:**
```typescript
// Phase 1 contract comment [VERIFIED: lib/prime-users.ts:18-19]:
// * - `getAllPrimeUsers()` / `resolveByEmail()` NEVER throw — Prime/Blob failure
// *   degrades to `[]` / `null` per D-16.

// Phase 2 usage — no new try/catch needed:
const primeUser = await resolveByEmail(session.userEmail || '');
// primeUser is `PrimeUser | null`; existing outer try at session route handles truly unexpected throws
```

### Pattern 3: Extending a discriminated union (audit action)

**What:** Add a new variant to a string-literal union without breaking existing code paths.
**When to use:** `AuditEntry.action` is currently `'login' | 'logout'`. D-06 adds `PRIME_USER_MISS`.
**Example:**
```typescript
// Current: lib/audit.ts:11-17 [VERIFIED]
export interface AuditEntry {
  id: string;
  email: string;
  name?: string;
  action: 'login' | 'logout';
  timestamp: string;
}

// Phase 2 shape (lowercase to match existing 'login'/'logout' convention):
export interface AuditEntry {
  id: string;
  email: string;
  name?: string;
  action: 'login' | 'logout' | 'prime_user_miss';
  timestamp: string;
  detail?: string;  // D-06 — "cache_hit: no match" | "cache_empty"
}
```

**Audit consumer backward-compat verification:**
- `app/api/audit/log/route.ts:6` — `VALID_ACTIONS = ['login', 'logout']`. This is the external POST /api/audit/log endpoint — it's called by the browser `AuditTracker` and validates action against a fixed allowlist. The new `prime_user_miss` event is written SERVER-SIDE from `/api/auth/login`, NOT via this public endpoint. So VALID_ACTIONS stays as-is (login/logout only) — no accidental client-driven write of the new event type. `[VERIFIED: app/api/audit/log/route.ts:6-18]`
- `app/api/audit/entries/route.ts:35` — filter only allows `['login', 'logout']`. The new event type will flow through unfiltered (no `action` param → all entries returned). The admin UI (`app/admin/page.tsx:530`) will simply render the new rows. `ActionBadge` at `app/admin/page.tsx:508-513` currently branches on `'login'` → green, else → gray logout badge. A `'prime_user_miss'` row will render with the gray badge labeled "Logout". **This is a display-quality concern, but outside Phase 2 scope (DISPLAY-03 is Phase 3)** — log it for Phase 3 rather than fix here. Alternative: add a 1-line fallback to `ActionBadge` for the new type. Planner's call.
- CSV export at `app/admin/page.tsx:515-528` passes `e.action` through unchanged — new event type exports cleanly.

### Pattern 4: AuthContext hydration plumbing (single-fetch-site invariant)

**What:** Extend the React context value carried from server to browser via a single fetch point.
**When to use:** D-09 — Phase 2 threads `primeUser` through the existing `AuthGuard` fetch, no new fetches.
**Example:**
```typescript
// Current: components/ui/AuthGuard.tsx:16-21 [VERIFIED]
const [authCtx, setAuthCtx] = useState<AuthContext>({
  userEmail: '',
  userName: '',
  isAdmin: false,
  hiddenPaths: new Set(),
});

// Phase 2:
const [authCtx, setAuthCtx] = useState<AuthContext>({
  userEmail: '',
  userName: '',
  isAdmin: false,
  hiddenPaths: new Set(),
  primeUser: null,  // D-08 additive
});

// And in the fetch hydration at AuthGuard.tsx:47-53:
setAuthCtx({
  userEmail: data.userEmail || '',
  userName: data.userName || '',
  isAdmin: !!data.isAdmin,
  hiddenPaths: new Set(data.hiddenPaths || []),
  primeUser: data.primeUser ?? null,  // D-08
});
```

### Anti-Patterns to Avoid

- **Adding a second /api/auth/prime-user endpoint:** doubles round-trips; `AuthGuard` is the established single fetch site. Violates D-09.
- **Storing `PrimeUser` on the iron-session cookie:** locked `NO` by D-03 — 8h staleness + cookie size bloat (cookie limit is 4KB, already carrying 2 OAuth tokens).
- **Writing audit entry from `/api/auth/session` on miss:** locked `NO` by D-05 — session is polled per page nav, would spam the 200-entry cap in minutes.
- **Try/catch around `resolveByEmail`:** unnecessary; Phase 1 contract guarantees no-throw. Adding it is dead defensive code.
- **Adding `primeUser` to AuthContext default but forgetting the null:** TypeScript will accept `undefined` at the JS runtime but the consumer type is `PrimeUser | null`; set explicit `null` in the default value and the initial useState.
- **Importing `resolveByEmail` into TopBar / any client component:** `lib/prime-users.ts` imports `@/lib/blob-cache` which reads env vars — a client import will compile but fail at runtime in the browser.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email → Prime user resolution | Re-implement `.find(u => u.email === ...)` in the route | `resolveByEmail()` from `lib/prime-users.ts` | Handles normalisation (`D-09 COMPARE`), first-miss bootstrap, 30-day safety net, and no-throw contract — Phase 1 tests prove it all works |
| Audit log record persistence | Direct `put()` to Vercel Blob | `appendAuditLog()` from `lib/audit.ts` | Already handles 200-entry cap, read-then-prepend semantics, blob URL resolution, silent-fail on write errors |
| Display name with fallback | Build a `<UserLabel>` component | Inline `primeUser?.fullName?.trim() || userEmail` per D-10 | Phase 2 has one render site (TopBar); component abstraction pays off only when Phase 3 ships multiple display sites |
| Session-route Prime cache | Memoize `resolveByEmail` results in-process | Use it as-is (it already has 3 cache layers) | In-memory blob-cache (L1) → Vercel Blob (L2) → Prime API (L3, hit on first-miss or 30d stale). Adding L0 adds invalidation complexity, zero measurable win — locked `DEFERRED` in CONTEXT.md |
| iron-session / cookie test harness | Build custom session test utilities | `vi.mock('iron-session')` + `vi.mock('next/headers')` | Module-boundary mocking; Phase 1 already uses the same pattern for `prime-auth` and `blob-cache` |

**Key insight:** This phase has ZERO novel primitives. Every implementation file lands in the "add a line here, add a field there" regime. The only genuinely new construct is the `PRIME_USER_MISS` audit event type, and even that is a 2-line edit to `lib/audit.ts`.

---

## Common Pitfalls

### Pitfall 1: Vitest `include` glob does not cover `app/` tests

**What goes wrong:** D-14 says "New test files follow the co-located `*.test.ts` pattern" with targets in `app/api/auth/login` and `app/api/auth/session`. But `vitest.config.ts:8` declares `include: ['lib/**/*.test.ts']` — `app/**` tests will be silently skipped by `vitest run`.
**Why it happens:** Phase 1 only tested `lib/prime-users.ts` — the include glob was tight on purpose. D-22 of Phase 1 locked "co-located tests: `lib/prime-users.test.ts` (NOT `__tests__/`)". D-14 of Phase 2 inherits "co-located" but the target modules live under `app/`, which the glob excludes.
**How to avoid:** Two legitimate approaches — planner must pick one:
1. **Widen the include glob** to `['lib/**/*.test.ts', 'app/**/*.test.ts']`. Test files colocate with routes as `app/api/auth/login/route.test.ts` etc.
2. **Extract thin handler helpers into `lib/`** (e.g., `lib/auth/session-response.ts` with `buildSessionResponseBody(session, config): Promise<...>`) and test those. The route handler becomes a 5-line adapter that's covered by manual smoke.
**Warning signs:** CI reports "0 tests in route file" or `npm test` shows the same 20-test count as Phase 1 instead of 20 + new-phase count. **This gate must close in Wave 0 of Phase 2 before any Wave 1 test lands.** `[VERIFIED: vitest.config.ts:8 — current glob excludes app/]`

### Pitfall 2: Mocking `cookies()` from `next/headers` is not optional for route tests

**What goes wrong:** `lib/session.ts:25-27` calls `await cookies()` from `next/headers` then wraps with `getIronSession`. Under `vitest` with `environment: 'node'` (the current config), `next/headers` is still importable but `cookies()` throws because it relies on Next.js async-local-storage not established in test env.
**Why it happens:** `next/headers` functions are request-scoped in Next.js, populated by the framework's request handling. Vitest runs handlers in isolation — no request context.
**How to avoid:** Two mock layers at the top of each route handler test file:
```typescript
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(), set: vi.fn(), delete: vi.fn(),
  })),
}));

vi.mock('iron-session', () => ({
  getIronSession: vi.fn(async () => mockSession),
}));
```
Or (cleaner): mock `@/lib/session` directly — it's our own wrapper.
```typescript
vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => mockSession),
}));
```
The second form is simpler and matches Phase 1's "module-boundary mock" pattern (`prime-users.test.ts:39-47` mocks `./prime-auth` and `./blob-cache`). **Recommend mocking `@/lib/session` directly** to reduce mock surface area. `[CITED: nextjs.org/docs/app/guides/testing/vitest (2026-04-21), verified convention against prime-users.test.ts pattern]`
**Warning signs:** Test errors like "cookies() was called outside a request scope" or "Cannot read properties of undefined (reading 'get')" from iron-session.

### Pitfall 3: `action: 'prime_user_miss'` row will render as "Logout" badge in admin audit UI

**What goes wrong:** `app/admin/page.tsx:508-513` `ActionBadge({ action })` branches only on `'login'`; the fallback (including `'prime_user_miss'`) renders the "Logout" gray badge.
**Why it happens:** The badge component assumes a binary action set.
**How to avoid:** Either (a) extend `ActionBadge` with a third branch for `'prime_user_miss'` (e.g., amber "Miss" badge) in Phase 2, or (b) document as a Phase-3-blocked UI quirk and flag in Phase 2 SUMMARY Deviations. The 2-line ActionBadge edit is cheap — recommend doing it in Phase 2 to avoid shipping a misleading log display. **Planner's call — not locked by CONTEXT.md.**
**Warning signs:** Admin audit tab shows new rows labeled "Logout" during Phase 2 smoke test. `[VERIFIED: app/admin/page.tsx:508-513, 627]`

### Pitfall 4: AuthContext default value drift — `primeUser` only added to interface

**What goes wrong:** If `AuthContext` interface gains `primeUser` but the `createContext<AuthContext>({...})` default at `lib/auth-context.tsx:12-17` is not updated, TypeScript will compile an incomplete default that satisfies only the widened interface by coercion. The default context (used when `useAuth()` is called outside an `AuthProvider`) will return `undefined` for `primeUser` at runtime, which widens the consumer type to `PrimeUser | null | undefined` effectively.
**Why it happens:** The default object literal is easy to miss in a rapid interface edit.
**How to avoid:** Always update the interface AND the createContext default AND the AuthGuard initial `useState` together. Three touchpoints, same diff.
**Warning signs:** TypeScript errors like "Type 'X' is missing the following properties from type 'AuthContext': primeUser". If tsc passes but runtime logs show `primeUser` as undefined in the default context, the default was widened without explicit `null`. `[VERIFIED: lib/auth-context.tsx:12-17, components/ui/AuthGuard.tsx:16-21]`

### Pitfall 5: Whitespace-only Prime fullName values

**What goes wrong:** If Prime returns `fullName: "   "` (whitespace only), a naive `primeUser?.fullName || userEmail` fallback renders whitespace — visually looks like an empty TopBar.
**Why it happens:** JavaScript's truthiness: `"   "` is truthy, so `||` does not fall through.
**How to avoid:** Exact cascade per D-10: `primeUser?.fullName?.trim() || session.userEmail`. The `.trim()` collapses whitespace to empty string which is falsy. **Already locked by D-10 — tests should assert this.** `[VERIFIED: CONTEXT.md D-10]`
**Warning signs:** TopBar shows empty slot but AuthContext logs show a populated `primeUser.fullName`.

### Pitfall 6: Login route calls `resolveByEmail` on unauthenticated request

**What goes wrong:** If a developer refactors the login route and moves the `resolveByEmail` call above the `if (!tokenResponse.ok)` check, a failed OAuth attempt would still trigger a Prime resolution call (costing Prime budget and potentially writing an audit entry for an email that never authenticated).
**Why it happens:** Refactor ordering mistake; the critical invariant "Prime resolution happens ONLY after successful auth" is not enforced by types.
**How to avoid:** Add a comment at the resolveByEmail call site: `// D-04: called AFTER successful Prime auth only — never resolve unauthenticated emails`. Prefer placing the call AFTER `session.save()` (post-auth, pre-response) so intent is obvious. Test case: asserts `resolveByEmail` is not called when Prime OAuth returns 401.
**Warning signs:** Audit log shows `prime_user_miss` entries for emails that never successfully logged in; Prime /users budget spikes proportional to login-failure rate. `[VERIFIED: app/api/auth/login/route.ts:61-68 — OAuth error branch returns early]`

---

## Code Examples

### Example 1: Extended `lib/audit.ts`

```typescript
// Source: lib/audit.ts (current) → additive edits [VERIFIED current shape]

export interface AuditEntry {
  id: string;
  email: string;
  name?: string;
  action: 'login' | 'logout' | 'prime_user_miss';  // D-06: new literal
  timestamp: string;
  detail?: string;                                 // D-06: optional detail
}

// appendAuditLog signature unchanged — `Omit<AuditEntry, 'id' | 'timestamp'>` widens
// automatically to accept the new action + optional detail.
export async function appendAuditLog(
  entry: Omit<AuditEntry, 'id' | 'timestamp'>
): Promise<void> {
  // ... existing body unchanged
}
```

### Example 2: Extended `app/api/auth/session/route.ts`

```typescript
// Source: app/api/auth/session/route.ts (current) → additive [VERIFIED current shape]

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, getHiddenPaths, isAdminEmail } from '@/lib/page-visibility';
import { resolveByEmail } from '@/lib/prime-users';  // NEW

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

    // D-01 + D-07 — live-read, never throws per Phase 1 D-16
    const primeUser = await resolveByEmail(session.userEmail || '');

    return NextResponse.json({
      userName: session.userName,
      userEmail: session.userEmail,
      expiresAt: session.expiresAt,
      isAdmin,
      hiddenPaths: Array.from(hiddenPaths),
      primeUser,  // PrimeUser | null — D-07
    });
  } catch (error) {
    console.error('[session] check error:', error);  // D-17 prefix
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
}
```

### Example 3: Extended `app/api/auth/login/route.ts` (relevant diff only)

```typescript
// Additive — placed AFTER session.save() + before audit write (D-04 ordering)

import { resolveByEmail, getAllPrimeUsers } from '@/lib/prime-users';  // NEW

// ... after `await session.save()` and before the existing login audit log:

// D-04: resolve for audit-log purpose only — NOT stored, NOT returned
const primeUser = await resolveByEmail(normalisedEmail);

// Existing login entry (unchanged):
await appendAuditLog({
  email: normalisedEmail,
  name: userName,
  action: 'login',
});

// D-04 + D-06: miss audit entry with cache-state detail
if (!primeUser) {
  // Distinguish cache-empty from match-miss (D-06)
  const allUsers = await getAllPrimeUsers();  // cached; no extra Prime call if populated
  const detail = allUsers.length === 0 ? 'cache_empty' : 'cache_hit: no match';
  await appendAuditLog({
    email: normalisedEmail,
    name: userName,
    action: 'prime_user_miss',
    detail,
  });
}
```

**Note on the extra `getAllPrimeUsers()` call:** This is the only way to distinguish `cache_empty` from `cache_hit: no match` without exposing more internals of `lib/prime-users.ts`. `getAllPrimeUsers` is O(1) on the hot path (just reads the blob-cache in-memory layer) and never calls Prime except in the two bootstrap branches locked by Phase 1. Alternative: expose a lightweight `getDirectoryState(): 'empty' | 'populated'` from `lib/prime-users.ts` — cleaner API, 3-line addition. **Planner's call.** `[VERIFIED: lib/prime-users.ts:193-210 — getAllPrimeUsers DIR-02 hot-path guarantee]`

### Example 4: Extended `lib/auth-context.tsx`

```typescript
'use client';

import { createContext, useContext } from 'react';
import type { PrimeUser } from '@/lib/prime-users';  // NEW

export interface AuthContext {
  userEmail: string;
  userName: string;
  isAdmin: boolean;
  hiddenPaths: Set<string>;
  primeUser: PrimeUser | null;  // D-08
}

const AuthCtx = createContext<AuthContext>({
  userEmail: '',
  userName: '',
  isAdmin: false,
  hiddenPaths: new Set(),
  primeUser: null,  // explicit null per Pitfall 4
});

export function AuthProvider({ value, children }: { value: AuthContext; children: React.ReactNode }) {
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
```

### Example 5: TopBar identity surface

```typescript
// components/ui/TopBar.tsx — prepend identity to existing flex row [VERIFIED current structure]

'use client';
import { useAuth } from '@/lib/auth-context';
// ... existing imports for weather/clock

export function TopBar() {
  const { primeUser, userEmail } = useAuth();
  // D-10 — whitespace-defensive cascade
  const displayName = primeUser?.fullName?.trim() || userEmail;

  // ... existing clock + weather effects

  return (
    <div className="flex items-center gap-4 text-sm overflow-hidden">
      {/* D-11 — minimal identity label, visual placement planner's call */}
      {displayName && (
        <div className="flex items-center gap-1.5 text-gray-400">
          <span className="text-white truncate max-w-[200px]">{displayName}</span>
        </div>
      )}

      {/* existing weather + divider + clock blocks unchanged */}
    </div>
  );
}
```

**TopBar visual conventions observed** `[VERIFIED: components/ui/TopBar.tsx]`:
- Outer container: `flex items-center gap-4 text-sm overflow-hidden`
- Sub-items wrapped as: `flex items-center gap-1.5 text-gray-400` with bright items (`text-white`) nested
- Separators: `w-px h-4 bg-gray-700 hidden sm:block` (conditional with `&&`)
- Responsive: `hidden sm:inline` / `hidden md:inline` for secondary text
- Whole TopBar lives inside an end-aligned flex container at `AuthGuard.tsx:100` (`flex items-center justify-end gap-3 px-6 py-3 ...`)

Planner decision points:
- Place identity label left of weather (prepend) — most visible, consistent with how other dashboards prefix identity.
- Or right of clock (append) — aligns with "account menu" convention at the extreme right.
- Truncation for long names: `max-w-[200px] truncate` (matches Sidebar user slot style).

### Example 6: Vitest route-handler test pattern (new for Phase 2)

```typescript
// app/api/auth/session/route.test.ts — NEW FILE (assuming glob widened, see Pitfall 1)
// OR lib/auth/session-response.test.ts if extracting a helper (see Pitfall 1 option 2)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Module-boundary mocks — matches Phase 1 lib/prime-users.test.ts:39-47 pattern
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/page-visibility', () => ({
  getVisibilityConfig: vi.fn(),
  getHiddenPaths: vi.fn(() => new Set<string>()),
  isAdminEmail: vi.fn(() => false),
}));
vi.mock('@/lib/prime-users', () => ({ resolveByEmail: vi.fn() }));

import { GET } from './route';
import { getSession } from '@/lib/session';
import { resolveByEmail } from '@/lib/prime-users';
import { getVisibilityConfig } from '@/lib/page-visibility';

const mockedGetSession = vi.mocked(getSession);
const mockedResolve = vi.mocked(resolveByEmail);
const mockedConfig = vi.mocked(getVisibilityConfig);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/auth/session (SESSION-01, SESSION-03)', () => {
  it('returns primeUser from resolveByEmail', async () => {
    mockedGetSession.mockResolvedValue({
      accessToken: 'x',
      userEmail: 'jane@shbr.com',
      userName: 'jane@shbr.com',
      expiresAt: Date.now() + 3600_000,
    } as never);
    mockedConfig.mockResolvedValue({ admins: [], groups: [], pages: [] });
    mockedResolve.mockResolvedValue({
      id: 'u1', email: 'jane@shbr.com', fullName: 'Jane Doe',
      firstName: 'Jane', lastName: 'Doe',
      division: null, region: null, roleOrTrade: null, status: 'active',
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.primeUser).toEqual(expect.objectContaining({ fullName: 'Jane Doe' }));
    expect(mockedResolve).toHaveBeenCalledWith('jane@shbr.com');
  });

  it('returns primeUser: null when resolveByEmail returns null', async () => {
    mockedGetSession.mockResolvedValue({
      accessToken: 'x', userEmail: 'nobody@example.com', userName: 'nobody@example.com',
      expiresAt: Date.now() + 3600_000,
    } as never);
    mockedConfig.mockResolvedValue({ admins: [], groups: [], pages: [] });
    mockedResolve.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(body.primeUser).toBeNull();
  });

  it('does NOT write audit entry on null (D-05)', async () => {
    // audit module not imported by session route — covered by absence of the import.
    // To make this an explicit test, mock lib/audit and assert appendAuditLog not called.
  });
});
```

### Example 7: Login route test for miss audit write

```typescript
// Additional test skeleton — illustrates the cache-state discrimination

it('writes prime_user_miss with detail="cache_empty" when directory is empty', async () => {
  // Mock successful Prime OAuth, then resolveByEmail → null, getAllPrimeUsers → []
  mockedResolve.mockResolvedValue(null);
  mockedGetAll.mockResolvedValue([]);
  mockedAppend.mockResolvedValue(undefined);

  const req = new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'ghost@shbr.com', password: 'x' }),
  });
  // ... mock global fetch for Prime OAuth success

  await POST(req);

  // Two audit calls: one 'login', one 'prime_user_miss'
  expect(mockedAppend).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'login' })
  );
  expect(mockedAppend).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'prime_user_miss', detail: 'cache_empty' })
  );
});

it('writes prime_user_miss with detail="cache_hit: no match" when directory populated but user absent', async () => {
  mockedResolve.mockResolvedValue(null);
  mockedGetAll.mockResolvedValue([/* some users without ghost@ */]);
  // ... assert detail is 'cache_hit: no match'
});
```

---

## Open Questions — RESOLVED

### Q1: Where exactly in the RSC tree does AuthProvider get its value?

**RESOLVED:** `components/ui/AuthGuard.tsx` is the single AuthProvider wiring site. Flow:
1. `app/layout.tsx:18-26` wraps `{children}` in `<AuthGuard>`.
2. `AuthGuard.tsx` is a client component (`'use client'` at line 1).
3. `AuthGuard.tsx:36-58` — on mount (and on `pathname` change), `fetch('/api/auth/session')` runs.
4. Response body hydrates `authCtx` via `setAuthCtx({...})` at lines 47-53.
5. `AuthProvider value={authCtx}` wraps `{children}` at lines 81 (kiosk) AND 94 (full shell).

**Phase 2 implementation point:** Change AuthGuard.tsx at three places (initial useState default, fetch-response hydration, AuthContext interface) — all within a 50-line diff. The AuthGuard component is imported by `app/layout.tsx` only, so the AuthProvider is guaranteed to wrap all authenticated routes. No other file needs editing for AuthContext plumbing. `[VERIFIED: components/ui/AuthGuard.tsx, app/layout.tsx]`

### Q2: Does `lib/audit.ts` have a generic event-type registry?

**RESOLVED:** No registry — `AuditEntry.action` is a tight string-literal union `'login' | 'logout'`. Two places to edit in `lib/audit.ts`:

1. Line 15: `action: 'login' | 'logout'` → `action: 'login' | 'logout' | 'prime_user_miss'`
2. Optionally add `detail?: string;` on line 16 (D-06 requires this).

**Downstream touchpoints** (planner must decide):
- `app/api/audit/log/route.ts:6` — `VALID_ACTIONS = ['login', 'logout']` is the POST validator. **Do NOT add `prime_user_miss` here** — this endpoint is an externally-callable audit-writer; we don't want the browser to be able to forge miss events. The new type is written server-side only from the login route. `[VERIFIED]`
- `app/api/audit/entries/route.ts:35` — filter allowlist, no edit needed.
- `app/admin/page.tsx:508-513` `ActionBadge` + audit table display — see Pitfall 3 (Phase 2 discretion vs Phase 3 deferral).
- `app/admin/page.tsx:515-528` CSV export — passes action through, no edit.

**Recommendation:** Use lowercase `'prime_user_miss'` (matches existing `'login'`/`'logout'` convention), not the uppercase `PRIME_USER_MISS` that D-06 text uses. D-06 text means the conceptual event name; the runtime value can be lowercase-with-underscore per existing style.

### Q3: TopBar visual placement for identity label

**RESOLVED with observations** (planner decides):
- Current TopBar: `flex items-center gap-4 text-sm overflow-hidden`, rightmost in header (end-aligned by parent at AuthGuard.tsx:100).
- Identity label options:
  - **LEFT of existing items (prepend):** most readable, common dashboard convention ("you are logged in as X").
  - **RIGHT of existing items (append):** matches "account menu" convention.
- No avatar per D-11, no admin badge per D-11.
- Truncation recommended: `max-w-[200px] truncate` to mirror Sidebar's user slot.
- Responsive: the identity label should probably stay visible on all breakpoints (D-11 "compact user-identity surface") — unlike weather/date which already hide on small screens.

**Recommend:** prepend to the existing flex row. Rationale — email addresses/full names are long; right-alignment with the clock compresses useful space; left-of-row places it first in reading order.

### Q4: Do login-time Prime cache misses retry?

**RESOLVED:** No retries needed — Phase 1 D-03's first-miss bootstrap is a single Prime call inside `refreshPrimeUsers({ reason: 'first-miss' })`. If it fails:
- `refreshPrimeUsers` returns `{ ok: false, blob: { users: [], ... } }`
- `getAllPrimeUsers` returns `[]` (Phase 1 D-16)
- `resolveByEmail` returns `null`
- Login route's audit detail becomes `'cache_empty'`

The CONTEXT.md lean ("yes, write the miss audit anyway with detail=cache_empty") is **correct and already aligns with how Phase 1 behaves**. Admin reviewing the log sees `'cache_empty'` and knows Prime was down at login time (distinct from `'cache_hit: no match'` where Prime was reachable but email wasn't found). No retry logic needed in Phase 2. `[VERIFIED: lib/prime-users.ts:134-175, 193-210]`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Re-derive identity from email in each client component | Expose typed user object through context | Phase 2 | Single source of truth, zero re-fetches |
| Store full user profile on cookie | Live-read from blob-cache on session check | Phase 2 CONTEXT D-01/D-02 | No cookie bloat, no staleness within admin-refresh window |
| Vitest with `@vitejs/plugin-react` + jsdom | Vitest node-env only (current config) | Phase 1 | Route handler + pure-lib tests only; no component rendering in tests |

**Not deprecated, but narrow-scoped:** `app/api/audit/log/route.ts`'s `VALID_ACTIONS` allowlist — intentionally does NOT include `prime_user_miss` because browser-writable miss events would be a forgery vector.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vi.mock('@/lib/session', ...)` is sufficient to bypass `next/headers`+`iron-session` in Vitest node-env, without needing to mock `next/headers` directly | Pitfall 2, Example 6 | Tests fail with cookies() scope errors; remediation is adding a `vi.mock('next/headers')` block (1-minute fix). Risk: LOW |
| A2 | `AuditEntry.action` union extension from `'login' | 'logout'` to `'login' | 'logout' | 'prime_user_miss'` is backward-compatible with existing blob rows (which have `'login'`/`'logout'` values) | Pattern 3, Q2 | If TypeScript's JSON parser widens the field on read, downstream is untouched. Pre-existing 200 blob rows already have `'login'`/`'logout'` values — deserialising them against the widened union is safe. Risk: NONE (verified against blob structure) |
| A3 | Adding `detail?: string` to `AuditEntry` is backward-compatible with existing rows that lack the field | Pattern 3, Example 1 | `detail?` is optional — existing rows simply have `undefined`. JSON.parse tolerates absent optional fields. Risk: NONE |
| A4 | `ActionBadge` rendering mismatch for new event type is a Phase 3 (DISPLAY-03) concern, not a Phase 2 requirement | Pitfall 3 | If user spots "Logout" badges on miss events during Phase 2 UAT, planner may reclassify as a P2 scope addition. Risk: LOW — documented in SUMMARY |
| A5 | `getAllPrimeUsers()` call in login route to discriminate cache states has O(1) hot-path cost (blob-cache in-memory hit) | Example 3 | Phase 1 D-02 + DIR-02 + test at `lib/prime-users.test.ts:322-336` proves no Prime call on populated cache. Risk: NONE (regression-tested) |
| A6 | Phase 1's `getAllPrimeUsers()` distinguishes `cache_empty` from `cache_hit: no match` by returning `[]` vs `[user1, user2, ...]` after a successful resolve | Example 3, Q2 | Alternative signal source (internal state of blob) is more invasive. Length check is sufficient. Risk: LOW |
| A7 | The `'prime_user_miss'` literal should be lowercase with underscore, not uppercase `PRIME_USER_MISS` as CONTEXT.md D-06 text reads | Q2 | Matches existing `'login'`/`'logout'` convention. If planner reads CONTEXT.md D-06 verbatim, runtime value may differ — clarify in plan. Risk: LOW (cosmetic, fully within single-phase edit) |

**If this table resolves:** All assumptions are LOW or NONE risk and easily adjusted during planning. None blocks Wave 1.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Route handlers, Vitest node-env | ✓ | 20 (`@types/node ^20` `[VERIFIED: package.json:32]`) | — |
| Vitest | Contract tests (D-14) | ✓ | 4.1.5 | — |
| vite-tsconfig-paths | `@/` alias resolution in tests | ✓ | 6.1.1 | — |
| Next.js 14 | Route handlers + App Router | ✓ | 14.2.35 | — |
| iron-session | Session cookie (already wired) | ✓ | 8.0.4 | — |
| @vercel/blob | Audit log persistence | ✓ | 2.3.1 | — |
| Prime API | First-miss bootstrap (rare path) | Runtime-only (production env) | — | Phase 1 D-16 degrades to `primeUser: null`; no hard block |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Runtime State Inventory

> Phase 2 is NOT a rename/refactor/migration phase. This section is included only to confirm there is no persisted state that needs migration.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Audit log blob rows** at `audit/audit-log.json` (up to 200 entries, `'login'`/`'logout'`). New `'prime_user_miss'` rows are *additive* — old rows untouched. No migration. | None — union extension is backward-compatible per Assumptions A2/A3 |
| Live service config | **iron-session cookies in flight** (8h TTL). Phase 2 does NOT change `SessionData` (D-03/D-21) — cookies stay compatible forever. | None — locked `NO` migration by D-03 |
| OS-registered state | None (Vercel serverless, no OS persistence) | None |
| Secrets/env vars | `SESSION_SECRET`, `ADMIN_EMAIL`, `PRIME_*` — all unchanged by Phase 2 | None |
| Build artifacts | Next.js `.next` build cache will invalidate on next deploy (normal CI behavior) | None |

**Nothing found in other categories:** Confirmed.

---

## Project Constraints (from CLAUDE.md)

Directives that MUST be honored by the Phase 2 plan:

- **Production product, not sandbox.** All Phase 2 edits deploy to real users; brownfield awareness matters.
- **Cache before calling Prime.** Phase 1 already owns this — Phase 2 MUST NOT add direct `/users` calls. Only `resolveByEmail`/`getAllPrimeUsers` are allowed (both cache-first).
- **Rate limits:** 60 req/min, 5000 req/24h, 5 concurrent. Phase 2 adds at most 2 calls per user session (`resolveByEmail` on login + `resolveByEmail` on session check). Both are cache reads, not Prime calls, except in rare bootstrap paths.
- **Error handling:** log internally with full detail, return generic user-facing messages — **matches D-17 `[session]` prefix convention** for Phase 2 logs.
- **`VisibilityConfig` blob schema is load-bearing.** Phase 2 does NOT touch `lib/page-visibility.ts` config shape. Only reads it via existing `getVisibilityConfig` and `isAdminEmail`. `[VERIFIED: app/api/auth/session/route.ts:21]`
- **Admin fallback email hardcoded** (`chris.freeman@techgurus.com.au` in `lib/page-visibility.ts:126`). Known issue; do not propagate. **Phase 2 does not touch this line.** `[VERIFIED: lib/page-visibility.ts:126]`
- **New pages must be registered in `lib/page-visibility.ts ALL_PAGES` AND Sidebar nav.** Phase 2 does NOT add new pages. `[VERIFIED: no new pages in CONTEXT.md]`
- **Cron jobs are live.** Phase 2 does NOT touch `vercel.json` or any cron route.
- **Page client components fetch via dedicated `/api/prime/*` routes.** Phase 2 extends `/api/auth/session` only — correct tier per Architectural Responsibility Map.
- **Utility files: kebab-case in `lib/`.** Phase 2 does not create new `lib/` files (unless planner extracts a helper per Pitfall 1 option 2 — in which case kebab-case required).
- **API routes: `app/api/[domain]/[endpoint]/route.ts`.** Phase 2 edits existing routes only — pattern preserved.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 `[VERIFIED: package.json:39]` |
| Config file | `vitest.config.ts` (currently `include: ['lib/**/*.test.ts']` — must widen OR use helper extraction, see Wave 0 gap) |
| Quick run command | `npm test` (= `vitest run`) — single pass, already in `package.json:10` |
| Full suite command | `npm test` — same command; no separate "quick" vs "full" split |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESSION-01 | `/api/auth/session` calls `resolveByEmail(session.userEmail)` | unit | `npm test -- -t "calls resolveByEmail"` | ❌ Wave 0 (new test file) |
| SESSION-01 | `/api/auth/session` returns `primeUser` from resolveByEmail | unit | `npm test -- -t "returns primeUser"` | ❌ Wave 0 |
| SESSION-01 | `/api/auth/session` returns `primeUser: null` when resolveByEmail returns null | unit | `npm test -- -t "primeUser null"` | ❌ Wave 0 |
| SESSION-02 | Login succeeds even when email is not in Prime directory | unit | `npm test -- -t "login null prime"` | ❌ Wave 0 (new test file) |
| SESSION-02 | Login writes `prime_user_miss` audit entry with `detail: 'cache_empty'` on first-miss failure | unit | `npm test -- -t "prime_user_miss cache_empty"` | ❌ Wave 0 |
| SESSION-02 | Login writes `prime_user_miss` audit entry with `detail: 'cache_hit: no match'` when directory populated but user absent | unit | `npm test -- -t "cache_hit: no match"` | ❌ Wave 0 |
| SESSION-02 | Login does NOT write `prime_user_miss` on OAuth failure (D-04 invariant) | unit | `npm test -- -t "prime_user_miss not on auth fail"` | ❌ Wave 0 |
| SESSION-03 | `/api/auth/session` response includes `primeUser` alongside existing fields | unit | covered by SESSION-01 tests | ❌ Wave 0 |
| SESSION-03 | Response shape unchanged for existing fields (`userEmail`, `isAdmin`, `hiddenPaths`, etc.) — regression guard | unit | `npm test -- -t "session response shape"` | ❌ Wave 0 |
| SESSION-04 | `AuthGuard` hydrates `primeUser` into AuthContext from session fetch | manual-smoke | browser DevTools — inspect React context after login | ❌ Deferred (no RSC/browser test harness — D-15 / Phase 1 D-21) |
| SESSION-04 | `useAuth().primeUser` is accessible from client components | manual-smoke | browser DevTools | ❌ Deferred per D-15 |
| DISPLAY-04 | TopBar renders `primeUser.fullName` when populated | manual-smoke | browser visual check (Chris's account: fullName populated) | ❌ Deferred per D-15 |
| DISPLAY-04 | TopBar falls back to `userEmail` when primeUser is null | manual-smoke | browser visual check (test with non-Prime email) | ❌ Deferred per D-15 |
| DISPLAY-04 | TopBar handles whitespace-only fullName (D-10 cascade) | unit | extract display-name helper to `lib/`, unit test cascade | ⚠️ Optional — can be covered by `.trim()` logic test if helper extracted, otherwise manual-smoke |
| D-06 | `lib/audit.ts` accepts and round-trips `prime_user_miss` entries with `detail` field | unit | `npm test -- -t "audit prime_user_miss"` | ❌ Wave 0 (new test in `lib/audit.test.ts`) |

### Sampling Rate
- **Per task commit:** `npm test` (single-pass, ~1-2 seconds for the current 20 tests; will grow to ~35-40 with Phase 2 additions — still fast enough for per-commit).
- **Per wave merge:** `npm test` — same command.
- **Phase gate:** All unit tests green + manual smoke checklist for SESSION-04 / DISPLAY-04 surfaces (login with Chris's account, log in with a non-Prime email, verify TopBar label + AuthContext shape in DevTools).

### Wave 0 Gaps

**Before any Wave 1 implementation can land, these must be resolved:**

- [ ] **Vitest glob decision** — widen `vitest.config.ts` `include` to `['lib/**/*.test.ts', 'app/**/*.test.ts']` OR extract a `lib/auth/*.ts` helper and test there. See Pitfall 1. **Without this, D-14 contract tests cannot be discovered by `vitest run`.**
- [ ] **Test file scaffolds** (one of these two shapes):
  - Option A (glob widened): `app/api/auth/session/route.test.ts`, `app/api/auth/login/route.test.ts`, `lib/audit.test.ts`
  - Option B (helper extracted): `lib/auth/session-response.test.ts`, `lib/auth/login-miss-audit.test.ts`, `lib/audit.test.ts`
- [ ] **`next/headers` mock decision** — either mock directly (verbose, needs a `next/headers` stub in every route test) or mock at `@/lib/session` boundary (cleaner, matches Phase 1 pattern). Recommend the boundary mock. Pitfall 2.
- [ ] **`ActionBadge` Phase 2 scope decision** — edit `app/admin/page.tsx:508-513` to handle `'prime_user_miss'` OR document as Phase 3 deferral. Pitfall 3.

**No framework install needed** — Vitest, vite-tsconfig-paths, and all required peers are shipped by Phase 1.

---

## Open Questions

All 4 open questions from CONTEXT.md are RESOLVED above (see Open Questions section). No new open questions surface from this research.

---

## Sources

### Primary (HIGH confidence)

- **Codebase (fully verified):**
  - `lib/prime-users.ts` — `resolveByEmail`, `PrimeUser`, `getAllPrimeUsers` contracts
  - `lib/prime-users.test.ts` — 20-case Vitest pattern for module-boundary mocks
  - `lib/session.ts` — `SessionData` shape, `getSession` wrapper
  - `lib/auth-context.tsx` — AuthContext interface + createContext default
  - `lib/audit.ts` — `AuditEntry` shape, `appendAuditLog` signature
  - `lib/page-visibility.ts` — `VisibilityConfig`, `isAdminEmail`, `getHiddenPaths`
  - `app/api/auth/session/route.ts` — current GET handler
  - `app/api/auth/login/route.ts` — current POST handler + normalisation at line 78
  - `app/api/auth/logout/route.ts` — current POST handler (confirming D-22 no-touch)
  - `app/api/audit/log/route.ts` — VALID_ACTIONS allowlist (for D-06 planning)
  - `app/api/audit/entries/route.ts` — filter allowlist (for D-06 planning)
  - `app/admin/page.tsx` — ActionBadge + audit table consumer
  - `app/layout.tsx` — AuthGuard wrapping site
  - `components/ui/AuthGuard.tsx` — AuthProvider plumbing point (Q1 answer)
  - `components/ui/TopBar.tsx` — current TopBar structure (Q3 answer)
  - `components/ui/Sidebar.tsx` — existing `useAuth` consumer pattern
  - `vitest.config.ts` — test discovery glob (Pitfall 1 source)
  - `package.json` — dep versions

- **Planning artifacts:**
  - `.planning/phases/01-prime-user-directory/01-02-SUMMARY.md` — Phase 1 module shipping
  - `.planning/phases/01-prime-user-directory/01-03-SUMMARY.md` — Phase 1 endpoint shipping
  - `.planning/phases/01-prime-user-directory/01-RESEARCH.md` — Phase 1 stack + patterns (headers read, not full)
  - `.planning/REQUIREMENTS.md` — SESSION-01..04 + DISPLAY-04 definitions
  - `.planning/phases/02-session-auth-context/02-CONTEXT.md` — 22 locked decisions
  - `CLAUDE.md` — project-level constraints

### Secondary (MEDIUM confidence)

- **Next.js 14 official docs** — [Testing: Vitest](https://nextjs.org/docs/app/guides/testing/vitest) (2026-04-21, version 16.2.4) — confirmed node-env Vitest is supported for route handler testing; module-level mocking is the recommended pattern. Used for Pitfall 2 mock strategy.

### Tertiary (LOW confidence)

- None — every claim in this research is code-verified or cited from the Phase 1 harness.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps, all versions read from `package.json` directly.
- Architecture: HIGH — all plumbing touchpoints traced through working tree.
- Pitfalls: HIGH — Pitfall 1 (vitest glob) verified against current `vitest.config.ts`; Pitfall 2 cross-checked against Next.js 16.2 testing docs; Pitfalls 3-6 verified against working tree.
- Test strategy: HIGH — existing 20-test Phase 1 suite models the approach.
- Code examples: HIGH — every example is a minimal diff against currently-verified code.

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — low volatility: no external library upgrades in scope, no framework migration, no Prime API contract change).
