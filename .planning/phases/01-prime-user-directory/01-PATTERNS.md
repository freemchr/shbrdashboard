# Phase 1: Prime User Directory — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 5 new + 1 modified (+ 2 read-only references)
**Analogs found:** 5 / 5 (config file has no exact analog — sourced from RESEARCH.md + Next.js docs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/prime-users.ts` (new) | module (server-only library) | request-response + cache-backed read | `lib/page-visibility.ts` (blob-read + admin-gate helpers) + `lib/blob-cache.ts` (SWR pattern) + `lib/prime-auth.ts` (log prefix + error shape) | composite — best analog per concern |
| `lib/prime-users.test.ts` (new) | test | in-memory pure-logic (mocked boundaries) | **No codebase analog** — first test file in repo | none (use Vitest docs + RESEARCH.md §"Test file shape") |
| `app/api/admin/prime-users/refresh/route.ts` (new) | route (API, POST, admin-gated) | request-response (Prime→Blob refresh) | `app/api/cron/client-analytics-refresh/route.ts` (Prime→Blob refresh) + `app/api/auth/login/route.ts` (session + error-body shape) | role-match (cron auth swapped for session auth) |
| `vitest.config.ts` (new) | config | — | **No codebase analog** — first Vitest config | none (RESEARCH.md §"Vitest Integration" provides verbatim) |
| `package.json` (modified) | config | — | existing `scripts` + `devDependencies` blocks at lines 5-10, 28-37 | same file (additive edit) |
| `app/api/prime/team/route.ts` (read-only reference) | — | — | — | shows `RawUser` attribute surface consumed today (lines 15-25) |
| `app/api/auth/login/route.ts` (read-only reference) | — | — | — | email normalization at line 78 |

## Pattern Assignments

### `lib/prime-users.ts` (module, cache-backed Prime directory)

**Analog (primary):** `lib/page-visibility.ts` — same storage family (`shbr-admin/` blob keyspace per D-05), same admin-gate companion, same in-memory + blob pattern.
**Analog (secondary):** `lib/blob-cache.ts` — provides `getCached<T>` / `setCached` primitives we wrap (per D-02 and RESEARCH.md §"Blob-Cache Record Shape").
**Analog (tertiary):** `lib/prime-auth.ts` — log-prefix convention (`[namespace] …`) and the "log full detail, throw/return generic" error shape.

**Why this analog:**
- `lib/page-visibility.ts` is the closest semantically: also a Prime-informed directory artefact stored at `shbr-admin/*.json`, with an in-memory layer and a graceful fallback when the blob is missing. Its shape is the single best model for the module's public surface.
- `lib/blob-cache.ts` is the persistence primitive per D-02 — we consume its API, not reimplement its internals.
- `lib/prime-auth.ts` is referenced for observability conventions only (log prefix, `console.error('[ns] message:', err)` form).

---

**Imports pattern** (adapted from `lib/blob-cache.ts:18` + `lib/page-visibility.ts:13` + `app/api/prime/team/route.ts:8`):
```typescript
// lib/prime-users.ts — top of file
import { primeGetAllPages } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/blob-cache';
```
Named-export style, `@/` path alias per CONVENTIONS.md §"Import Organization" + `tsconfig.json:20-22`.

---

**Blob key + constants pattern** (from `lib/page-visibility.ts:79`):
```typescript
// lib/page-visibility.ts:79
const BLOB_KEY = 'shbr-admin/page-visibility.json';
```
**Replicate for prime-users:**
```typescript
const BLOB_KEY = 'shbr-admin/prime-users.json';          // D-05
const INDEFINITE_TTL_MS = 50 * 365 * 24 * 60 * 60 * 1000; // D-01 — never auto-expires
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;      // D-04 — 30-day safety net
```
Key namespace MUST be `shbr-admin/` (not `shbr-cache/`) per D-05.

---

**Blob read with graceful fallback** (from `lib/page-visibility.ts:90-116`):
```typescript
export async function getVisibilityConfig(): Promise<VisibilityConfig> {
  // 1. In-memory hit
  if (memConfig && Date.now() - memConfigAt < MEM_TTL) {
    return memConfig;
  }

  // 2. Blob fetch
  try {
    const base = getBlobBase();
    if (!base) return DEFAULT_CONFIG;

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const res = await fetch(`${base}/${BLOB_KEY}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return DEFAULT_CONFIG;

    const config: VisibilityConfig = await res.json();
    memConfig = config;
    memConfigAt = Date.now();
    return config;
  } catch {
    return DEFAULT_CONFIG;
  }
}
```
**What to replicate:**
- Try/catch-with-fallback shape: never throw, always return a safe default.
- `if (!res.ok) return DEFAULT_CONFIG;` — null-blob is a normal state, not an error.
- In-memory layer caching.

**What to NOT copy:**
- Do NOT replicate the hand-rolled `fetch` — `lib/blob-cache.ts` already does this and wraps `BlobMeta` metadata around our payload. Use `getCached<PrimeUserDirectoryBlob>(BLOB_KEY)` instead (D-02 + RESEARCH.md §"Blob-Cache Record Shape").
- `page-visibility.ts` keeps its own `memConfig` — `getCached` already provides in-memory layering at `lib/blob-cache.ts:21-36`, so do NOT add a second in-memory cache here.
- Its 1-minute mem TTL is irrelevant to us (we want indefinite).

---

**Email normalization — STORE** (from `app/api/auth/login/route.ts:77-78`):
```typescript
// Normalise email — always lowercase + trimmed so admin checks are reliable
const normalisedEmail = email.trim().toLowerCase();
```
**Email normalization — COMPARE** (from `lib/page-visibility.ts:125`):
```typescript
const normalised = email.toLowerCase().trim();
```
**Replicate in both places** — `mapRawToPrimeUser()` applies it on write (D-09, on STORE), `resolveByEmail()` applies it on read (D-09, on COMPARE). Do NOT DRY this into a helper — RESEARCH.md §"Don't Hand-Roll" explicitly notes the drift risk is lower when both call sites spell it out.

---

**Core module pattern — `getAllPrimeUsers()` with bootstrap + stale logic** (composed from D-03/D-04 + RESEARCH.md §"Code Examples"):
```typescript
export async function getAllPrimeUsers(): Promise<PrimeUser[]> {
  // DIR-02: NEVER call Prime on the hot path except in the two bootstrap branches below.
  const blob = await getCached<PrimeUserDirectoryBlob>(BLOB_KEY);

  // D-03: first-miss bootstrap
  if (!blob) {
    const result = await refreshPrimeUsers({ reason: 'first-miss' });
    return result.ok ? result.blob.users : [];                      // D-16: never throw
  }

  // D-04: 30-day safety net
  const lastSuccess = blob.lastSuccessAt ? new Date(blob.lastSuccessAt).getTime() : 0;
  if (Date.now() - lastSuccess > STALE_THRESHOLD_MS) {
    const result = await refreshPrimeUsers({ reason: 'stale-30d' });
    return result.ok ? result.blob.users : blob.users;              // D-17: serve stale on fail
  }

  return blob.users;
}
```
**What to replicate:**
- Three explicit branches: fresh hit, first-miss, 30-day stale.
- `D-16: never throw` — both fallback returns are safe (`[]` or previous `blob.users`).
- Inline comments referencing D-XX decisions so future refactors can't silently drop them (RESEARCH.md §"Pitfall 4").

---

**Refresh function with preserve-on-failure** (composed from D-14/D-17/D-19 + RESEARCH.md §"Blob-Cache Record Shape"):
```typescript
export async function refreshPrimeUsers(
  opts: { reason: 'admin' | 'first-miss' | 'stale-30d' }
): Promise<{ ok: boolean; blob: PrimeUserDirectoryBlob; durationMs: number }> {
  const attemptAt = new Date().toISOString();
  const t0 = Date.now();
  const existing = await getCached<PrimeUserDirectoryBlob>(BLOB_KEY);
  try {
    const raw = await primeGetAllPages('/users', 100) as RawPrimeUser[];
    const users = raw.map(mapRawToPrimeUser);
    const blob: PrimeUserDirectoryBlob = {
      schemaVersion: 1,
      users,
      lastSuccessAt: new Date().toISOString(),
      lastAttemptAt: attemptAt,
      lastError: null,
      lastErrorAt: null,
    };
    await setCached(BLOB_KEY, blob, INDEFINITE_TTL_MS);
    return { ok: true, blob, durationMs: Date.now() - t0 };
  } catch (err) {
    console.error('[prime-users] refresh failed:', err);            // D-18 log prefix
    const blob: PrimeUserDirectoryBlob = {
      ...(existing ?? { schemaVersion: 1, users: [], lastSuccessAt: '' }),
      lastAttemptAt: attemptAt,
      lastError: err instanceof Error ? err.message : String(err),
      lastErrorAt: attemptAt,
    };
    // D-14 / D-17: never wipe on failure — only write back updated error metadata if blob exists
    if (existing) await setCached(BLOB_KEY, blob, INDEFINITE_TTL_MS);
    return { ok: false, blob, durationMs: Date.now() - t0 };
  }
}
```
**What to replicate:**
- `[prime-users]` log prefix on `console.error` — matches `[prime-auth]` at `lib/prime-auth.ts:43, 88, 97` and `[blob-cache]` at `lib/blob-cache.ts:115`.
- Preserve-on-failure: only write error metadata back when `existing` is non-null (RESEARCH.md §"Pitfall 1"). A first-attempt Prime failure MUST NOT write an empty-users blob.
- `err instanceof Error ? err.message : String(err)` — idiomatic unknown-catch shape matching `app/api/cron/client-analytics-refresh/route.ts:183`.
- `schemaVersion: 1` field (per D-19 Discretion + RESEARCH.md recommendation) — cheap migration hook.

**What to NOT copy:**
- Do NOT add a `try/catch` around `setCached` — `lib/blob-cache.ts:114-116` already catches its own blob-put failures. Re-wrapping hides bugs.
- Do NOT call `primeGet('/users?per_page=200')` single-page — use `primeGetAllPages('/users', 100)` per RESEARCH.md §"Filter Strategy" / §"Fetch Implementation" (future-proof against >200 users).
- Do NOT replicate `client-analytics-refresh`'s `'createdAt'.gte(…)` Prime `q=` DSL — Prime's DSL support on `/users` is unverified and RESEARCH.md explicitly recommends fetch-all + filter-at-read-time.

---

**Mapper pattern — JSON:API envelope unwrap** (adapted from `app/api/prime/team/route.ts:15-25` `RawUser` shape, augmented per D-08 + Wave 0 probe):
```typescript
// app/api/prime/team/route.ts:15-25 — EXISTING consumed surface
interface RawUser {
  id: string;
  attributes: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    status?: string;
    roles?: string[];
  };
}
```
**Replicate the shape, extend with D-08's three new keys (subject to Wave 0 probe):**
```typescript
interface RawPrimeUser {
  id: string;
  type?: string;
  attributes?: Record<string, unknown>;  // defensive — probe will narrow
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function mapRawToPrimeUser(raw: RawPrimeUser): PrimeUser {
  const a = raw.attributes ?? {};
  const firstName = str(a.firstName) ?? '';
  const lastName  = str(a.lastName)  ?? '';
  return {
    id: raw.id,
    email: (str(a.email) ?? '').toLowerCase(),                       // D-09 on STORE
    fullName: str(a.fullName) ?? `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    division:    str(a.division),                                    // nullable per RESEARCH.md
    region:      str(a.region),                                      // nullable per RESEARCH.md
    roleOrTrade: str(a.roleOrTrade) ?? str(a.role) ?? str(a.trade),  // safety belt per RESEARCH.md
    status: str(a.status) ?? 'unknown',
  };
}
```
**What to replicate:**
- `attributes?: { …optional fields… }` pattern — the `?` on every attribute key matches team/route.ts because Prime's JSON:API envelope is not strict.
- `id: raw.id` at the top level — JSON:API v1.0 puts `id` outside `attributes` per RESEARCH.md §"Code Examples" A4.

**What to NOT copy:**
- Do NOT hardcode `attributes` as required (non-optional) — team/route.ts happens to get away with it because the endpoint always returns these specific keys, but D-08's new fields are unverified (RESEARCH.md Gate 1).
- Do NOT reuse `roles?: string[]` — out of D-08 scope.

---

### `app/api/admin/prime-users/refresh/route.ts` (route, admin-gated Prime→Blob refresh)

**Analog (primary):** `app/api/cron/client-analytics-refresh/route.ts` — same overall shape (Prime fetch → cache write → structured success/error JSON), but swap the `Bearer ${CRON_SECRET}` gate for a session + `isAdminEmail()` gate.
**Analog (secondary):** `app/api/auth/login/route.ts` — canonical session-read pattern and 401/500 JSON error-body shape.

**Why this analog:** The structural DNA (route handler + Prime fetch + blob write + structured response) is identical. D-11/D-12 change only the auth gate and the HTTP verb (POST vs GET).

---

**Runtime directive pattern** (from `app/api/cron/client-analytics-refresh/route.ts:11-12`):
```typescript
// app/api/cron/client-analytics-refresh/route.ts:11-12
export const runtime = 'nodejs';
export const maxDuration = 300;
```
**Replicate with shorter max duration** (no job-list pagination — ~30 users max today):
```typescript
export const runtime = 'nodejs';
export const maxDuration = 60;    // match app/api/prime/team/route.ts:13 — a similar /users fetch
```

---

**Session + admin-gate pattern** (new composition — session read from `lib/session.ts:24` + visibility config from `lib/page-visibility.ts:90` + admin check from `lib/page-visibility.ts:121`):
```typescript
// CANONICAL 401/403 gate for admin endpoints — RESEARCH.md §"Pitfall 3"
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';
import { refreshPrimeUsers } from '@/lib/prime-users';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  const session = await getSession();
  if (!session.userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const config = await getVisibilityConfig();
  if (!isAdminEmail(session.userEmail, config)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // …proceed to refresh
}
```
**What to replicate:**
- Two distinct gates (401 no-session vs 403 non-admin) — RESEARCH.md §"Pitfall 3" warns these are easy to conflate.
- Error body `{ error: string }` JSON shape — matches `app/api/auth/login/route.ts:67, 74` and `app/api/cron/client-analytics-refresh/route.ts:173`.
- `getSession()` direct call — no helper wrapping, per D-12 ("do NOT modify `lib/session.ts`").

**What to NOT copy:**
- Do NOT include the `req.headers.get('authorization')` cron-secret check from `client-analytics-refresh:171-174` — D-12 explicitly replaces it with session auth.
- Do NOT read `req.headers.get('x-forwarded-for')` / rate-limit pattern from `login/route.ts:11-29` — admin endpoints are session-gated; anonymous brute force isn't the threat model here.

---

**Success response shape** (per D-13; pattern-match body format from `client-analytics-refresh:181`):
```typescript
// app/api/cron/client-analytics-refresh/route.ts:181 — existing success shape
return NextResponse.json({ ok: true, generatedAt: result.generatedAt, totalJobs: result.totalJobs });
```
**Replicate with D-13 keys:**
```typescript
return NextResponse.json({
  ok: true,
  userCount: result.blob.users.length,
  durationMs: result.durationMs,
  cachedAt: result.blob.lastSuccessAt,
});
```

---

**Failure response shape** (per D-14, 502 status):
```typescript
if (!result.ok) {
  return NextResponse.json(
    {
      ok: false,
      error: result.blob.lastError ?? 'Unknown error',
      lastSuccessAt: result.blob.lastSuccessAt || null,
    },
    { status: 502 }
  );
}
```
**What to replicate:**
- HTTP 502 "Bad Gateway" is semantically correct (upstream Prime failure) and matches D-14.
- `lastSuccessAt` in the failure body lets Phase 3 UI render "Last successful refresh: 5 days ago" on failure.

**What to NOT copy:**
- The `client-analytics-refresh` uses HTTP 500 at line 185 — do NOT reuse; D-14 locks 502 for this endpoint.
- Do NOT wrap the entire handler in a try/catch that swallows everything like `login/route.ts:99` — `refreshPrimeUsers()` already returns `{ ok: false, blob }` on Prime failure; no outer catch needed (the try/catch lives inside `refreshPrimeUsers`).

---

### `lib/prime-users.test.ts` (test, unit)

**Analog:** **None in codebase** — this is the first test file. Pattern sourced from RESEARCH.md §"Test file shape" + Vitest official docs.

**Why no analog:** Repo has no existing Vitest/Jest/Mocha harness (STACK.md §"Testing" line 44-46 confirms only ESLint). D-20 introduces Vitest in this phase.

---

**File-shape pattern** (from RESEARCH.md §"Test file shape", verbatim-equivalent):
```typescript
// lib/prime-users.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveByEmail, getAllPrimeUsers, refreshPrimeUsers } from './prime-users';

// Mock module boundaries — NEVER hit real Prime
vi.mock('./prime-auth', () => ({
  primeGet: vi.fn(),
  primeGetAllPages: vi.fn(),
}));
vi.mock('./blob-cache', () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  invalidateCache: vi.fn(),
}));

describe('resolveByEmail', () => {
  beforeEach(() => vi.resetAllMocks());

  it('normalizes input email before matching', async () => { /* … */ });
  it('returns null on empty cache + Prime unreachable', async () => { /* … */ });
});
```
**What to replicate:**
- Named imports of `describe/it/expect/vi/beforeEach` — `vitest.config.ts` uses `globals: false` per RESEARCH.md so imports are explicit.
- Relative path imports (`./prime-users`, `./prime-auth`, `./blob-cache`) — co-located file pattern per D-22.
- Mock the module boundary, NOT the HTTP layer — mock `primeGetAllPages` (not `fetch`), mock `getCached`/`setCached` (not `@vercel/blob`).
- `beforeEach(() => vi.resetAllMocks())` — isolates test state.
- Test IDs matching DIR-01/02/03/04 per RESEARCH.md §"Phase Requirements → Test Map" (lines 460-473) so `npm run test -- -t "DIR-01"` works.

**What to NOT copy / do NOT do:**
- Do NOT use `@/lib/prime-users` — co-located tests use relative imports per RESEARCH.md "Note" at line 296.
- Do NOT hit real Prime (RESEARCH.md line 276 + §"What we deliberately do NOT test automatically").
- Do NOT test `blob-cache.ts` internals (mocked boundary, per D-22).
- Do NOT test iron-session decryption (covered by DIR-03 manual smoke).

---

**Required test coverage** (from RESEARCH.md §"Phase Requirements → Test Map" lines 460-473):

| Test ID | Behaviour |
|---------|-----------|
| DIR-01 | `getAllPrimeUsers` calls `primeGetAllPages('/users', 100)` and caches result |
| DIR-01 | `refreshPrimeUsers` maps raw JSON:API envelope → `PrimeUser[]` correctly |
| DIR-01 | `mapRawToPrimeUser` handles missing optional attributes (division/region/roleOrTrade → `null`) |
| DIR-02 | `resolveByEmail` reads from cache WITHOUT calling `primeGet` on hot path |
| DIR-02 | Empty-cache first access triggers `refreshPrimeUsers` once (D-03) |
| DIR-02 | 30-day-stale cache triggers `refreshPrimeUsers` (D-04; mock `Date.now()`) |
| DIR-04 | `getAllPrimeUsers` returns `[]` on empty cache + Prime failure |
| DIR-04 | Refresh failure preserves existing cache users (D-17) |
| DIR-04 | Refresh failure writes `lastError`/`lastErrorAt` without overwriting `users` (D-19) |
| DIR-04 | `resolveByEmail` normalizes input `.trim().toLowerCase()` before matching (D-09) |
| DIR-04 | First-miss + Prime fails → `setCached` is NOT called (RESEARCH.md §"Pitfall 1") |

---

### `vitest.config.ts` (config, new)

**Analog:** **None in codebase.** Full config from RESEARCH.md §"Vitest Integration" + Next.js 14 docs (nextjs.org/docs/app/guides/testing/vitest dated 2026-04-21).

**Verbatim content from RESEARCH.md:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    globals: false,       // explicit imports of describe, it, expect
    clearMocks: true,
  },
});
```

**What to replicate (verbatim):** All of the above.

**What to NOT copy / do NOT do:**
- Do NOT add `@vitejs/plugin-react`, `jsdom`, or `@testing-library/*` — Phase 1 tests pure Node lib only (RESEARCH.md line 208-213).
- Do NOT set `globals: true` — explicit imports are CONVENTIONS.md §"Module Design" "named exports preferred" compatible.
- Do NOT expand `include` beyond `lib/**/*.test.ts` — Phase 2/3 can expand later (RESEARCH.md line 237).
- Do NOT add `resolve.alias` manually — `tsconfigPaths()` reads `tsconfig.json:20-22` automatically.

---

### `package.json` (modified, additive)

**Analog:** The existing `scripts` block at `package.json:5-10` and `devDependencies` block at `package.json:28-37`.

**Current scripts block** (`package.json:5-10`):
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
},
```

**Additive change — append two scripts** (per RESEARCH.md §"Vitest Integration"):
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest"
},
```

**Current devDependencies** (`package.json:28-37`):
```json
"devDependencies": {
  "@types/node": "^20",
  "@types/react": "^18",
  "@types/react-dom": "^18",
  "eslint": "^8",
  "eslint-config-next": "14.2.35",
  "postcss": "^8",
  "tailwindcss": "^3.4.1",
  "typescript": "^5"
}
```

**Additive change — append two devDeps:**
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

**What to replicate:**
- Preserve alphabetical-ish ordering (existing block is roughly alphabetical — new entries fit at the end naturally).
- Use `vitest run` (not bare `vitest`) for the default `test` script — CI parity (RESEARCH.md line 260).

**What to NOT copy / do NOT do:**
- Do NOT add `vite` to devDeps — it is a transitive peer of vitest 4.x (RESEARCH.md line 205).
- Do NOT bump existing deps — additive only.
- Do NOT edit `dependencies` (runtime deps) — vitest and vite-tsconfig-paths are dev-only.

---

## Shared Patterns (cross-cutting)

### Log prefix convention
**Source:** `lib/prime-auth.ts:43, 88, 97`; `lib/blob-cache.ts:115`; `app/api/cron/client-analytics-refresh/route.ts:81, 177, 180, 184`.
**Apply to:** `lib/prime-users.ts` and `app/api/admin/prime-users/refresh/route.ts`.

Representative excerpt from `lib/prime-auth.ts:43`:
```typescript
console.error('[prime-auth] Token request failed:', res.status, text);
```

From `lib/blob-cache.ts:115`:
```typescript
console.warn('[blob-cache] Failed to write to Blob:', e);
```

**Required prefix for this phase (D-18):** `[prime-users]`
**Shape:** `console.error('[prime-users] <short human phrase>:', <error-or-value>)`

**What to NOT copy:** Do NOT add entries to `lib/audit.ts` — D-18 explicitly scopes that module to user auth events, not system events.

---

### Email normalization
**Source:** `app/api/auth/login/route.ts:77-78` and `lib/page-visibility.ts:125`.
**Apply to:** `mapRawToPrimeUser()` on STORE, `resolveByEmail()` on COMPARE.

From `app/api/auth/login/route.ts:77-78`:
```typescript
// Normalise email — always lowercase + trimmed so admin checks are reliable
const normalisedEmail = email.trim().toLowerCase();
```

From `lib/page-visibility.ts:125`:
```typescript
const normalised = email.toLowerCase().trim();
```

**Pattern:** Both places inline the two-call chain literally. Method order (`.trim().toLowerCase()` vs `.toLowerCase().trim()`) is equivalent for ASCII email chars; match the login-route order in new code for consistency with the codebase's canonical call site.

**What to NOT copy:** Do NOT DRY this into `lib/normalize.ts` — RESEARCH.md §"Don't Hand-Roll" notes that loud inline duplication is intentional here (drift risk is lower than a mis-imported helper).

---

### JSON:API v1.0 envelope unwrap
**Source:** `app/api/prime/team/route.ts:188-299` (filters `user.attributes.status === 'active'`); `lib/prime-auth.ts:117-122` (`primeGetAllPages` unwraps `data.data[]`).
**Apply to:** `mapRawToPrimeUser()` inside `lib/prime-users.ts`.

From `lib/prime-auth.ts:117-122`:
```typescript
const data = (await primeGet(`${path}${sep}per_page=${perPage}&page=${page}`)) as {
  data?: unknown[];
  meta?: { last_page?: number; current_page?: number; total?: number };
};

const items = data?.data || [];
```
**Implication:** `primeGetAllPages()` already unwraps the outer envelope and returns the `data[]` array to us. Our mapper receives `{ id, type, attributes }`-shaped items — no need to unwrap further.

---

### Admin session gate (401 vs 403)
**Source:** `lib/session.ts:24` + `lib/page-visibility.ts:90, 121`.
**Apply to:** `app/api/admin/prime-users/refresh/route.ts`.

Full canonical pattern (see "Session + admin-gate pattern" above for the code block). Two imports:
```typescript
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';
```

**What to NOT copy:**
- Do NOT touch `lib/session.ts` (D-12 + PROJECT.md "Explicitly NOT touched").
- Do NOT touch the hardcoded `chris.freeman@techgurus.com.au` fallback at `lib/page-visibility.ts:126` (CLAUDE.md "do not propagate" + CONTEXT.md Deferred Ideas + REQUIREMENTS.md v2 BOOTSTRAP-01).

---

### Error body JSON shape
**Source:** `app/api/auth/login/route.ts:35, 67, 74, 100`; `app/api/cron/client-analytics-refresh/route.ts:173, 185`.
**Apply to:** `app/api/admin/prime-users/refresh/route.ts`.

Representative excerpts:
```typescript
// login/route.ts:35
return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });

// login/route.ts:67
return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

// cron/client-analytics-refresh/route.ts:173
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```
**Pattern:** `{ error: <string> }` for simple auth errors. For this phase's D-14 **refresh failure** body, extend to `{ ok: false, error, lastSuccessAt }` — a deliberate enrichment, not a deviation.

---

### "Log internally, return generic to client"
**Source:** CLAUDE.md §"Code Conventions" line 31 + `app/api/auth/login/route.ts:62-67` + `lib/prime-auth.ts:41-44`.

From `app/api/auth/login/route.ts:62-67`:
```typescript
if (!tokenResponse.ok) {
  // ── #7 FIX: Log internally, return generic message to client ─────────────
  const errorText = await tokenResponse.text();
  console.error('Prime OAuth error:', tokenResponse.status, errorText);
  await new Promise(r => setTimeout(r, 1000));
  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
```
**Apply to:** Any `console.error('[prime-users] …', err)` log must NOT leak `err.stack` into the HTTP response. For D-14's failure body, the user-facing `error: string` should be `err.message` (short, already-sanitized via Prime) — full error detail stays in server logs.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/prime-users.test.ts` | test | in-memory | First test file in repo; sourced from RESEARCH.md §"Test file shape" + Vitest official docs |
| `vitest.config.ts` | config | — | First Vitest config; sourced from RESEARCH.md §"Vitest Integration" (Next.js 14 docs 2026-04-21) |

---

## Metadata

**Analog search scope:**
- `/mnt/d/Github/shbrdashboard/lib/` — utility & service modules (inspected: prime-auth.ts, blob-cache.ts, page-visibility.ts, session.ts)
- `/mnt/d/Github/shbrdashboard/app/api/` — route handlers (inspected: cron/client-analytics-refresh, auth/login, prime/team)
- `/mnt/d/Github/shbrdashboard/package.json` — scripts + devDeps blocks
- `/mnt/d/Github/shbrdashboard/tsconfig.json` — path alias + strict mode confirmation
- `.planning/codebase/STACK.md` — confirmed no existing test harness
- `.planning/codebase/CONVENTIONS.md` — confirmed kebab-case lib + `[namespace]` log prefix + named exports

**Files scanned:** 10 (5 full reads: prime-auth.ts, blob-cache.ts, page-visibility.ts, session.ts, auth/login/route.ts, cron/client-analytics-refresh/route.ts; 3 partial reads: team/route.ts, package.json, tsconfig.json; 2 planning-doc reads: STACK.md, CONVENTIONS.md)

**Pattern extraction date:** 2026-04-24
