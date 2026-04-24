# Phase 1: Prime User Directory — Research

**Researched:** 2026-04-24
**Domain:** Server-side Prime ERP data caching + Vitest test-harness introduction
**Confidence:** HIGH (code-level evidence for every claim about existing files; Vitest integration cross-verified against official Next.js 16.2 docs dated 2026-04-21)

## RESEARCH COMPLETE

**Phase:** 01 — Prime User Directory
**Confidence:** HIGH

### Key Findings
- Every reusable primitive (`primeGet`, `primeGetAllPages`, `getCached`/`setCached`, `isAdminEmail`, `getSession`) is ready as-is; no upstream API change needed to meet DIR-01..04.
- Prime `/users` attribute availability for `division`, `region`, `roleOrTrade` is **NOT VERIFIED from the codebase** — the three existing `/users` callers only consume `fullName/firstName/lastName/email/status/roles`. This is the one gate that cannot be closed without either (a) a live Prime call during research — not possible in this sandbox — or (b) a one-shot probe task at Plan Wave 0.
- Prime `q=` filter syntax is a **Prime-specific DSL** (`'field'.op(value)`), **NOT** JSON:API standard `filter[x]=y`. Evidence across 8 existing callers. No `status` filter pattern for `/users` observed in code → recommendation is fetch-all-then-filter-at-read-time (D-08's stored `status` field makes this cheap and matches every other `/users` caller in the repo).
- Vitest 4.1.5 + vite-tsconfig-paths 6.1.1 is the current stable combo (verified 2026-04-24 against npm registry). Since this phase tests pure Node lib functions, we can SKIP `@vitejs/plugin-react`, `jsdom`, and `@testing-library/*` — minimum viable install is 3 packages: `vitest`, `vite-tsconfig-paths`, `@types/node` (already present at v20).
- `lib/blob-cache.ts` stores arbitrary JSON via its `data: unknown` field — D-19's extended metadata (`{ users, lastSuccessAt, lastAttemptAt, lastError, lastErrorAt }`) is trivially expressible as the `data` payload. NO blob-cache API change needed.

### File Created
`.planning/phases/01-prime-user-directory/01-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Prime `/users` attribute availability | **LOW** | No live Prime call possible; no codebase evidence beyond `fullName/firstName/lastName/email/status/roles` |
| Prime `q=` filter feasibility for `/users` | MEDIUM | Prime DSL verified from 8 callers, but no `/users`-filter example exists — default = filter at read time |
| Vitest integration | HIGH | Official Next.js docs + npm registry versions cross-verified 2026-04-24 |
| Blob-cache extended metadata | HIGH | Source code inspected; `data: unknown` confirms no API change |
| Validation Architecture | HIGH | Pure-logic surface + manual smoke test — no integration harness exists or is being built |

### Open Questions (RESOLVED BY PLAN 01 TASK 0.4)
1. **Does Prime `/users` return `division`, `region`, `roleOrTrade`?** Not answerable from the repo. Plan Wave 0 should include a one-shot "probe Prime" micro-task (log raw attributes keys of one `/users` record, do not persist). **RESOLVED:** Captured by Plan 01 Task 0.4 (throwaway probe script committed then deleted). `lib/prime-users.ts` mapper falls back to `null` per field if the probed key is absent, so planning can proceed defensively.
2. **What is the Prime attribute name for "role/trade"?** Assume `roleOrTrade` per D-08, but Prime may use `role`, `trade`, `position`, or a nested relationship. Same probe task resolves this. **RESOLVED:** Same probe (Plan 01 Task 0.4). Findings written as a comment block at the top of `lib/prime-users.ts` (and/or `lib/prime-users.test.ts`) so Phase 2/3 consumers have the exact attribute source documented.

### Ready for Planning
Research complete. Planner should treat Gate 1 as a Plan Wave 0 probe and build `PrimeUser` type defensively (every extended field typed `string | null`, populated best-effort from the raw response).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cache & refresh strategy**
- **D-01:** On-demand refresh only — no cron, no TTL auto-refresh.
- **D-02:** Storage = existing `lib/blob-cache.ts` SWR pattern.
- **D-03:** Empty cache → first access auto-populates (one Prime call).
- **D-04:** 30-day hard safety net — next access auto-refreshes if cache older than 30 days.
- **D-05:** Cache key = `shbr-admin/prime-users.json` (namespaced with page-visibility, NOT in `shbr-cache/`).

**Module API & record shape**
- **D-06:** Module location = `lib/prime-users.ts` (new file).
- **D-07:** Public API = `getAllPrimeUsers(): Promise<PrimeUser[]>` + `resolveByEmail(email: string): Promise<PrimeUser | null>`.
- **D-08:** `PrimeUser` fields = `id, email, fullName, firstName, lastName, division, region, roleOrTrade, status`.
- **D-09:** Email normalization on STORE and on COMPARE = `.trim().toLowerCase()`.
- **D-10:** Internal `refreshPrimeUsers()` is the single code path for (a) admin endpoint, (b) first-miss, (c) 30-day safety-net.

**Admin refresh endpoint**
- **D-11:** Route = `POST /api/admin/prime-users/refresh` (creates `/api/admin/` tree).
- **D-12:** Auth = session check only (`getSession()` + `isAdminEmail()`). 401 if unauth, 403 if non-admin.
- **D-13:** Success response = `{ ok: true, userCount, durationMs, cachedAt }`.
- **D-14:** Failure response = `{ ok: false, error, lastSuccessAt }` HTTP 502. **Cache never wiped on failure.**
- **D-15:** Retry = whatever `primeGet()` already provides. No additional retry layer.

**Failure resilience & observability**
- **D-16:** Empty cache + Prime unreachable → `getAllPrimeUsers()` returns `[]`, `resolveByEmail()` returns `null`. Never throws.
- **D-17:** Cache present + Prime fails → serve stale. Never wipe.
- **D-18:** Logging = `console.error('[prime-users] …')`. NO `lib/audit.ts` entries.
- **D-19:** Blob record shape = `{ users, lastSuccessAt, lastAttemptAt, lastError, lastErrorAt }`.

**Test strategy**
- **D-20:** Introduce Vitest in this phase.
- **D-21:** Setup amortized across Phases 2 + 3.
- **D-22:** Co-located tests: `lib/prime-users.test.ts` (NOT `__tests__/`).

### Claude's Discretion
- Exact Vitest config shape (minimal, node env, `@/` alias).
- Exact Prime `q=` filter on `/users` (or fetch-all + filter at read time).
- Whether to migrate existing `primeGet('/users?per_page=200')` callers — default = leave alone.
- Exact TypeScript type for Prime `/users` JSON:API envelope (researcher produces `RawPrimeUser`).
- Blob metadata schema versioning (`schemaVersion: 1` field).

### Deferred Ideas (OUT OF SCOPE)
- Migrating existing `/users` callers in `team/route.ts`, `estimators/route.ts`, `ops/route.ts`.
- Scheduled refresh (cron) — may revisit post-milestone.
- Attribute-driven rule groups — rejected at milestone level.
- Server-side page visibility enforcement (v2 ENFORCE-01..03).
- Audit trail for admin config changes (v2 ADMIN-AUDIT-01..03).
- Remove hardcoded `chris.freeman@techgurus.com.au` fallback (v2 BOOTSTRAP-01) — **CLAUDE.md says do not propagate; do not fix here.**

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIR-01 | Server-side fetcher for Prime `/users` including pagination | `primeGetAllPages()` already handles pagination with 1.1s throttle (lib/prime-auth.ts:107–135); but current `/users` callers use `per_page=200` single-call. See "Fetch Strategy" below — recommendation is `primeGetAllPages('/users', 100)` for safety, since Prime page cap is unverified and SHBR is ~30 users today but may grow. |
| DIR-02 | Cached server-side with TTL keeping calls <5,000/day | Satisfied by D-02 (blob-cache SWR) + D-01 (on-demand refresh). With `resolveByEmail` reading from memory/blob only, the Prime call budget attributable to this module is O(admin-clicks) per day — well under 5,000. |
| DIR-03 | Admin-only endpoint can force-refresh | Satisfied by D-11 + D-12 + `isAdminEmail()` at lib/page-visibility.ts:121. Reference shape = `app/api/cron/client-analytics-refresh/route.ts` (minus the `x-refresh-secret` — D-12 is session-only). |
| DIR-04 | Cache failures never corrupt/crash; stale preferred | Satisfied by D-14 (never wipe on failure) + D-16/D-17 (safe empty/stale returns) + D-19 (lastError metadata so admins are aware). |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Prime `/users` fetch + pagination | API / Backend | — | Server-only; needs OAuth token from `lib/prime-auth.ts`; client never touches Prime directly |
| Directory cache persistence | Database / Storage (Vercel Blob) | API / Backend (in-mem) | SWR pattern already used elsewhere; blob survives instance restarts, in-mem absorbs same-instance reads |
| Email → user resolution | API / Backend | — | Pure server-side lookup consumed by Phase 2 login flow (also server-side); never reached from client |
| Admin force-refresh trigger | API / Backend | Frontend (Phase 3) | Route is server; Phase 3 UI button is the client caller. This phase builds the route only. |
| Auth gate on refresh endpoint | API / Backend | — | Iron-session cookie decryption + `isAdminEmail()` are both server-only |

**Tier violations to prevent:** Do NOT call Prime from client components. Do NOT call `getAllPrimeUsers()` from a React component — it's a server-only module (reads env vars, uses `@vercel/blob`). Phase 2 consumes it from `/api/auth/login/route.ts`; Phase 3 consumes it from admin API routes.

---

## Prime /users Attribute Availability

### Evidence from codebase (what we KNOW)

Three callers read `/users` today. All three define their own local `RawUser` interface with `attributes` fields limited to what they consume:

**`app/api/prime/team/route.ts:15-25`** — the most comprehensive consumer:
```typescript
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
(Usage at lines 188, 299, 310–313. Filters to `status === 'active'` at line 299.) [VERIFIED: file read]

**`app/api/prime/ops/route.ts:77-80`** — minimal consumer:
```typescript
const users = await primeGetAllPages('/users?per_page=100') as {
  id: string;
  attributes?: { fullName?: string; status?: string };
}[];
```
Only reads `fullName` and `status`. [VERIFIED: file read]

**`app/api/prime/jobs/estimators/route.ts:230`** — uses `/users?per_page=200` (snippet not fully inspected but signature matches `team/route.ts`). [VERIFIED: grep]

### What is NOT KNOWN

No file in the repo reads `division`, `region`, or `roleOrTrade` (or any plausible alias: `role`, `trade`, `position`, `department`, `office`, `state`, `branch`) from a user attributes bag. [VERIFIED: grep across lib/ and app/api/prime/]

The word `region` appears often in the codebase but **exclusively on job records** (e.g. `lib/job-snapshots.ts:159`, `app/api/prime/financial/route.ts:71`, `app/api/prime/team/route.ts:238` which reads `job.attributes.region`). **No hit on `user.attributes.region`.** [VERIFIED: grep]

### Gap analysis

D-08 locks the `PrimeUser` shape as:
```
id, email, fullName, firstName, lastName, division, region, roleOrTrade, status
```

Three of those nine fields (`division`, `region`, `roleOrTrade`) have **zero code-level evidence** they are returned by Prime `/users`. This is the CONTEXT.md-flagged "first research gate" — and it cannot be closed without a live Prime call.

### Possibilities (ordered by likelihood)

1. **[ASSUMED] Most likely:** Prime `/users` returns these as flat attribute keys (`attributes.division`, `attributes.region`, `attributes.role` or `attributes.trade`), and current callers simply don't read them because they didn't need them for `/team`. Evidence: the PROJECT.md authors explicitly designed this milestone around Prime being the user directory with these attributes (PROJECT.md §"Target features" + REQUIREMENTS.md DIR line + ROADMAP.md Success Criteria #1). SHBR staff used Prime's admin UI to inform this — the fields exist in Prime's data model somewhere.
2. **[ASSUMED] Possible:** Prime exposes some of these via `attributes.customFields` map or a nested `relationships` block (JSON:API v1.0 envelopes commonly put joined resources under `relationships.{name}.data` with a `included[]` top-level array). If so, `getAllPrimeUsers()` may need `?include=region,division` or a second endpoint call per user (expensive — must be avoided).
3. **[ASSUMED] Possible:** Prime labels the field differently (e.g. `office` instead of `region`; `trade` instead of `roleOrTrade`; `department` instead of `division`). Mapping would happen in `mapRawToPrimeUser()` inside `lib/prime-users.ts`.
4. **[ASSUMED] Least likely:** Prime does NOT expose one or more of these at `/users`. In that case, the field must either (a) be sourced from another Prime endpoint (e.g. `/teams`, `/branches` — names speculative) or (b) surface as `null` in `PrimeUser` and be flagged for milestone v2.

### Recommendation for the planner

**Plan Wave 0 must include a "Prime /users probe" micro-task** — one-shot, no persistence, no commit of raw data. The task is simply:

1. Call `primeGet('/users?per_page=1')` in a temporary script or curl command (user is dev and has credentials).
2. Log `JSON.stringify(response.data[0], null, 2)` — one record, once.
3. Document the full attribute key set in a Wave 0 completion note that the planner uses to finalize `RawPrimeUser` and the `mapRawToPrimeUser()` mapping.
4. Delete the script.

This costs **ONE Prime API call**, closes the gate, and keeps the budget impact negligible (<0.02% of 5,000/day).

### Fallback if the probe shows fields are missing

- Build `PrimeUser` defensively: `division: string | null`, `region: string | null`, `roleOrTrade: string | null` (not `| undefined` — nulls survive JSON round-trip cleanly).
- `mapRawToPrimeUser()` returns `null` for any missing attribute instead of undefined or empty string. Downstream consumers (Phase 2 session, Phase 3 display) should treat `null` as "not available" and fall back to `fullName`/`email`.
- Record the gap in `.planning/STATE.md` Deferred Items with a pointer to a v2 requirement: "if missing fields are needed, consider joining a second Prime endpoint."

### Risk if planner does NOT probe

- Phase 1 ships, Phase 2 builds session-attribute storage around the wrong shape, Phase 3 tries to render `user.division` and sees `undefined` in prod. Rework cascades across three phases.
- **Cheap up-front probe trumps expensive late rework.**

---

## Vitest Integration

### Version matrix (verified 2026-04-24 against npm registry)

| Package | Latest | Phase 1 pin | Source |
|---------|--------|-------------|--------|
| `vitest` | 4.1.5 | `^4.1.5` | `npm view vitest version` [VERIFIED] |
| `vite-tsconfig-paths` | 6.1.1 | `^6.1.1` | `npm view vite-tsconfig-paths version` [VERIFIED] |
| `vite` (peer of vitest 4.x) | 8.0.10 | (transitive — do NOT add to devDeps) | `npm view vite version` [VERIFIED] |
| `@types/node` | 20 (already present) | — | `package.json:29` [VERIFIED] |

**NOT needed for this phase** (skipped — we test pure Node lib, no React):
- `@vitejs/plugin-react`
- `jsdom` / `happy-dom`
- `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`

If Phase 2 or 3 ever test React components, add those then — not now.

### Minimal `vitest.config.ts`

Place at repo root. [CITED: nextjs.org/docs/app/guides/testing/vitest (2026-04-21)]

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    globals: false,   // explicit imports of `describe`, `it`, `expect`
    clearMocks: true,
  },
});
```

**Why `environment: 'node'` (not `jsdom`):** `lib/prime-users.ts` is pure server-side — no DOM, no React. Node env is faster and has no browser-globals leakage.

**Why `include: ['lib/**/*.test.ts']`:** D-22 locks co-location under `lib/`. Scope limits accidental pickup of random `.test.ts` files elsewhere. If Phase 2/3 add co-located tests under `app/` or `components/`, expand this include later.

**Why `tsconfigPaths()` plugin:** Resolves `@/*` imports from `tsconfig.json:20-22` automatically. Alternative approach (manual `resolve.alias`) works but duplicates config — using the plugin stays DRY with Next.js. [CITED: vercel/next.js#72424]

### Minimal `package.json` script additions

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^4.1.5",
    "vite-tsconfig-paths": "^6.1.1"
  }
}
```

**Why `vitest run` (not `vitest`) for the default `test` script:** CI/build parity — `vitest` defaults to watch mode, which hangs a CI run. `vitest run` = single-pass. `test:watch` is the interactive-dev ergonomic.

### Conflicts / incompatibilities with existing stack

- **Next.js build pipeline:** None. Vitest reads `tsconfig.json` via the plugin but runs out-of-band. `next build` / `next lint` are unaffected. [HIGH confidence — Next.js docs explicitly recommend this setup.]
- **TypeScript strict mode:** Vitest respects `tsconfig.json` strict settings. No change needed to `tsconfig.json` for Phase 1; test files will be type-checked exactly like source files. [VERIFIED: tsconfig.json `"include": ["**/*.ts"]` already catches `.test.ts`.]
- **ESLint:** `eslint-config-next` does not have a problem with `*.test.ts` files. No `.eslintrc` change required.
- **`@types/node`:** Already at v20 via `package.json:29`. Vitest peers want `^20 || ^22 || >=24` — satisfied.

### Test file shape (pattern for Phase 1 author)

```typescript
// lib/prime-users.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveByEmail, getAllPrimeUsers } from './prime-users';

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
  // … etc.
});
```

Note: `vi.mock()` with relative paths (`./prime-auth`, not `@/lib/prime-auth`) because co-located test imports the SUT by relative path. `tsconfigPaths()` handles `@/` if a test ever needs it.

---

## Filter Strategy

### Prime `q=` syntax — what the codebase proves

Prime uses a proprietary query DSL, NOT JSON:API standard `filter[field]=value`. All 8 observed callers use the same syntax shape: `'fieldName'.operator(value)`, with comma-joining for AND.

Examples [VERIFIED across 8 files]:
| File:line | Query string |
|-----------|--------------|
| `app/api/cron/client-analytics-refresh/route.ts:76` | `q='createdAt'.gte('${start}'),'createdAt'.lte('${end}')` |
| `app/api/prime/jobs/kpis/route.ts:26` | `q='createdAt'.gte('${weekStart}')` |
| `app/api/prime/jobs/trends/route.ts:140` | `q='createdAt'.gte('${start}').lte('${end}')` |
| `app/api/prime/whs/refresh/route.ts:72` | `order=createdAt\|DESC&q=${q}` |
| `lib/prime-open-jobs.ts:56` | `q='statusId'.in(${inQuery})` |

Operators observed: `.gte()`, `.lte()`, `.in()`. String values single-quoted. Multiple predicates comma-joined.

### Does this work on `/users`?

**Unknown from codebase.** Not one of the 8 callers targets `/users`. None of `/users?q=...` has been tried in this repo. [LOW confidence on whether Prime supports `q=` on the users endpoint at all.]

### Recommendation: filter at read time, not fetch time

**Decision: fetch all users; filter at read time inside `resolveByEmail()`.** Rationale:

1. **Low risk:** avoids a server-side syntax experiment against a rate-limited API during a feature build. If a `q=` filter silently returns zero rows, the cache is populated with `[]` and the whole directory breaks — and D-17 means we'd never even know (stale cache serves).
2. **D-08 makes filtering free:** the `status` field is already stored. Downstream consumers that want "active only" can `.filter(u => u.status === 'active')` in memory — O(n) over ~30 records = nanoseconds.
3. **Matches existing `/users` callers:** `app/api/prime/team/route.ts:188` and `estimators/route.ts:230` fetch all and filter client-side. Consistent pattern = lower cognitive load.
4. **SHBR scale makes fetch-all cheap:** ~30 users today. Even at 10x growth, a single `/users?per_page=200` call returns everything in one page. Pagination via `primeGetAllPages` adds zero cost when only one page exists.
5. **If Prime grows the directory to >200 users:** `primeGetAllPages('/users', 100)` handles it transparently with the built-in 1.1s inter-page throttle.

**Planner's freedom if they disagree:** Only if Plan Wave 0's Prime probe reveals `/users` responses are unexpectedly large (>500 records) AND the Prime DSL is confirmed to work on `/users`, consider `q='status'.eq('active')`. Even then, storing inactive users has value (D-08 rationale: picker grey-out of inactive users, migration of historical admin entries per ADMIN-05). So the default stands.

### Fetch implementation

```typescript
// Inside refreshPrimeUsers() — fetch all pages, no filter
const raw = await primeGetAllPages('/users', 100) as RawPrimeUser[];
const users = raw.map(mapRawToPrimeUser);
```

Note: call `primeGetAllPages` NOT `primeGet('/users?per_page=200')`. Reasons:
- Survives SHBR growing past 200 users without silent truncation.
- Matches `app/api/prime/ops/route.ts:77` existing pattern (the only `/users` caller currently using paginated fetch).
- Throttle (1.1s/page) is built-in; on one page it costs nothing.

---

## Blob-Cache Record Shape

### Confirming the claim: no `lib/blob-cache.ts` API change needed

`lib/blob-cache.ts` is value-agnostic. [VERIFIED: file read]

Key evidence:
- `lib/blob-cache.ts:58` — `interface BlobMeta { expiresAt, staleAt, cachedAt?, data: unknown }`. The `data` field is `unknown`. Anything JSON-serializable goes here.
- `lib/blob-cache.ts:63` — `getCached<T>(key, skipMem): Promise<T | null>` returns `T` of whatever shape you pass.
- `lib/blob-cache.ts:96` — `setCached(key, data, ttlMs)` accepts `data: unknown`. Wraps in `BlobMeta`, serializes, writes.

**Implication for D-19:** Our extended metadata (`{ users, lastSuccessAt, lastAttemptAt, lastError, lastErrorAt }`) becomes the `data` payload. `blob-cache.ts` doesn't know or care. We store and read our own envelope on top of theirs.

### Recommended `PrimeUserDirectoryBlob` shape

```typescript
// Inside lib/prime-users.ts
interface PrimeUserDirectoryBlob {
  schemaVersion: 1;                    // bumpable for future migrations (D-19 Discretion)
  users: PrimeUser[];                  // normalized, email-lowercased
  lastSuccessAt: string;               // ISO — null would mean "never succeeded" but we
                                       //   never persist a blob with no successful users,
                                       //   so this is always a string once written
  lastAttemptAt: string;               // ISO — when refreshPrimeUsers() last ran, pass or fail
  lastError: string | null;            // human-readable error from the last FAILED attempt;
                                       //   null means the last attempt succeeded
  lastErrorAt: string | null;          // ISO of the last-error, null if lastError is null
}

interface PrimeUser {
  id: string;
  email: string;              // always lowercased, trimmed (D-09)
  fullName: string;
  firstName: string;
  lastName: string;
  division: string | null;    // null if Prime doesn't return / probe missing
  region: string | null;
  roleOrTrade: string | null;
  status: string;             // 'active' | 'inactive' | other — Prime-native
}
```

**Why `schemaVersion: 1`:**
- D-19 Discretion note flags it as a good idea. CONCERNS.md §"No Unit Tests for Page Visibility Logic" is a cautionary tale — silent blob schema drift is hard to detect.
- Costs nothing at write time; reading code can `if (blob.schemaVersion !== 1) return null;` as a cheap future migration hook.
- Not strictly required by D-19's locked list but allowed under D-19 Discretion — include it.

**Why `lastError: string | null` and `lastErrorAt: string | null` as paired nullables:**
- Matches D-19's literal shape.
- After a successful refresh, both become `null` (so admin UI reads "no recent errors").
- After a failed refresh, both are populated and `users` is NOT overwritten (D-14, D-17).

### Cache interaction pattern

```typescript
// Pseudocode for lib/prime-users.ts — HAPPY PATH
async function getBlob(): Promise<PrimeUserDirectoryBlob | null> {
  return await getCached<PrimeUserDirectoryBlob>(BLOB_KEY);
}

async function refreshPrimeUsers(opts: { reason: 'admin' | 'first-miss' | 'stale-30d' }): Promise<{ ok: boolean; blob: PrimeUserDirectoryBlob; durationMs: number }> {
  const attemptAt = new Date().toISOString();
  const t0 = Date.now();
  const existing = await getBlob();
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
    await setCached(BLOB_KEY, blob, FIFTY_YEARS_MS); // long TTL — on-demand refresh model
    return { ok: true, blob, durationMs: Date.now() - t0 };
  } catch (err) {
    console.error('[prime-users] refresh failed:', err);
    const blob: PrimeUserDirectoryBlob = {
      ...(existing ?? { schemaVersion: 1, users: [], lastSuccessAt: '' }),
      lastAttemptAt: attemptAt,
      lastError: err instanceof Error ? err.message : String(err),
      lastErrorAt: attemptAt,
    };
    // D-14 / D-17: never wipe on failure — only write back the updated error metadata
    if (existing) await setCached(BLOB_KEY, blob, FIFTY_YEARS_MS);
    return { ok: false, blob, durationMs: Date.now() - t0 };
  }
}
```

**Key detail:** On failure with NO existing blob, we don't persist — there's nothing to preserve yet, and writing an empty-users blob would satisfy the 30-day safety net (D-04) incorrectly. Return `ok: false` and let the caller surface the error.

**TTL note:** The blob-cache `ttlMs` controls the SWR "is-stale" threshold — it does NOT auto-expire the blob file. Setting a very long TTL (50 years) is effectively "indefinite" per D-01/D-04. Freshness is managed by our `lastSuccessAt` check, not by blob-cache TTL.

**Caveat on blob-cache `getCached` truly-old check:** At `lib/blob-cache.ts:85`, there's a `if (now > meta.expiresAt * 2 - (meta.staleAt || meta.expiresAt)) return null;` — an "ultra-stale discard." With our 50-year TTL this never trips in practice. Confirmed safe.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + vite-tsconfig-paths 6.1.1 (introduced this phase per D-20) |
| Config file | `vitest.config.ts` (new — see Vitest Integration section) |
| Quick run command | `npm run test` (vitest run — single pass) |
| Full suite command | `npm run test` (same — only Phase 1 tests exist, no slow integration layer) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIR-01 | `getAllPrimeUsers` calls `primeGetAllPages('/users', 100)` and caches result | unit | `npm run test -- lib/prime-users.test.ts -t "DIR-01"` | ❌ Wave 0 |
| DIR-01 | `refreshPrimeUsers` maps raw JSON:API envelope → `PrimeUser[]` correctly | unit | same | ❌ Wave 0 |
| DIR-01 | `mapRawToPrimeUser` handles missing optional attributes (division/region/roleOrTrade → null) | unit | same | ❌ Wave 0 |
| DIR-02 | `resolveByEmail` reads from cache WITHOUT calling `primeGet` on hot path | unit | same | ❌ Wave 0 |
| DIR-02 | Empty-cache first access triggers `refreshPrimeUsers` once (D-03) | unit | same | ❌ Wave 0 |
| DIR-02 | 30-day-stale cache triggers `refreshPrimeUsers` (D-04) | unit (mock `Date.now()`) | same | ❌ Wave 0 |
| DIR-03 | `POST /api/admin/prime-users/refresh` without session → 401 | **manual smoke** | `curl -X POST http://localhost:3000/api/admin/prime-users/refresh` expect 401 | N/A — manual |
| DIR-03 | Same endpoint with non-admin session → 403 | **manual smoke** | login as non-admin user, curl → 403 | N/A — manual |
| DIR-03 | Same endpoint with admin session → 200 + fresh data | **manual smoke** | login as admin, curl → 200, verify `userCount > 0`, `cachedAt` recent | N/A — manual |
| DIR-04 | `getAllPrimeUsers` returns `[]` (not throw) on empty cache + Prime failure | unit | same | ❌ Wave 0 |
| DIR-04 | Refresh failure preserves existing cache (D-17) | unit | same | ❌ Wave 0 |
| DIR-04 | Refresh failure writes `lastError/lastErrorAt` without overwriting `users` (D-19) | unit | same | ❌ Wave 0 |
| DIR-04 | `resolveByEmail` normalizes input email (`.trim().toLowerCase()`) before matching (D-09) | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test` (full suite — it's fast; only a dozen unit tests on pure functions)
- **Per wave merge:** `npm run test` + manual smoke (DIR-03) once the admin endpoint exists
- **Phase gate:** All unit tests green + all three DIR-03 manual smoke cases pass + no `[prime-users]` error in dev-server logs during a manual login → `/admin` click-refresh cycle

### Wave 0 Gaps
- [ ] `vitest.config.ts` — repo-root config (see Vitest Integration)
- [ ] `package.json` — add `test` + `test:watch` scripts, `vitest` + `vite-tsconfig-paths` devDeps (see Vitest Integration)
- [ ] `lib/prime-users.test.ts` — covers DIR-01, DIR-02, DIR-04 unit cases
- [ ] Framework install: `npm install -D vitest@^4.1.5 vite-tsconfig-paths@^6.1.1`
- [ ] **Prime `/users` probe** (NOT a test — a one-shot discovery task per Gate 1) — documents real attribute keys before test fixtures are written

### What we deliberately do NOT test automatically

- **The Prime API contract itself** — no integration test hits real Prime. That's a different class of test; Prime rate limits make it unwise during unit runs.
- **The `blob-cache.ts` primitives** — out of scope for this phase per D-22 (tests co-located to `lib/prime-users.test.ts`, not cross-module). `blob-cache.ts` is assumed working; it's been in prod for months.
- **`iron-session` cookie decryption** — covered by DIR-03 manual smoke; no value in re-testing library internals.
- **Vercel Blob roundtrips** — we mock `blob-cache.ts` at the module boundary per the Test file shape example above. Real blob puts are validated by DIR-03 manual smoke.

### Nyquist dimensions (per $HOME/.claude/get-shit-done/references/)

For a pure backend module + one authenticated admin route, the validation surface is limited. Applicable dimensions:

1. **Pure function correctness** — unit tests (above).
2. **Branch coverage** — hit/miss/empty/stale/error paths for `resolveByEmail` and `refreshPrimeUsers` (listed in Req→Test map).
3. **Boundary conditions** — email normalization edges (`"  FOO@BAR.COM  "` → match `"foo@bar.com"`), 30-day boundary (`lastSuccessAt = now - 30d + 1s` vs `- 30d - 1s`).
4. **Auth gate** — 401/403/200 branches on the admin endpoint (manual smoke).
5. **Failure resilience** — Prime throws / Prime returns malformed / Prime returns empty (all as unit tests with mocked `primeGetAllPages`).
6. **State preservation** — failed refresh preserves users (D-14 assertion as unit test).
7. **Observability** — `lastError`/`lastErrorAt` populated on failure (unit test assertion).

Dimensions 8 (integration) and 9 (end-to-end) are intentionally deferred per D-21 (test harness amortized across milestone; no E2E). This is explicitly flagged as an accepted gap in Validation Architecture.

---

## Runtime State Inventory

Not applicable — Phase 1 is pure additive work. No renames, no migrations, no rebranding. Evaluated explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** Phase 1 creates a NEW blob key (`shbr-admin/prime-users.json`, D-05) alongside the existing `shbr-admin/page-visibility.json`. No existing blob is modified or renamed. | None |
| Live service config | **None.** No Prime-side renames. No service rebrandings. Prime still exposes `/users` at the same endpoint. | None |
| OS-registered state | **None.** No new cron entry (D-01 forbids), no new OS scheduler task. `vercel.json` is NOT modified. | None |
| Secrets/env vars | **None.** No new env var. Uses existing `PRIME_*`, `BLOB_*`, `SESSION_SECRET`. `ADMIN_EMAIL` already controls admin-gate via `isAdminEmail()`. | None |
| Build artifacts | **None.** New files created (`lib/prime-users.ts`, `lib/prime-users.test.ts`, `app/api/admin/prime-users/refresh/route.ts`, `vitest.config.ts`). No stale artifacts from prior versions. | None |

**Net:** Additive phase; no runtime-state hazards.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 18+ | Next.js build + vitest runtime | ✓ | 18+ per STACK.md | — |
| npm | Install vitest + deps | ✓ | lockfile present | — |
| Prime API | `primeGetAllPages('/users')` | ✓ (at runtime only; not in this sandbox) | N/A | `getAllPrimeUsers → []`, `resolveByEmail → null` (D-16) |
| Vercel Blob | Persist directory blob | ✓ (at runtime) | `@vercel/blob@^2.3.1` already installed | In-memory layer absorbs a cold blob; blob write failure logs and continues (lib/blob-cache.ts:114–116) |
| iron-session | Session auth on admin endpoint | ✓ | `^8.0.4` already installed | — |
| `vitest` | Test harness | ✗ | — | INSTALL required at Wave 0 (`npm install -D vitest@^4.1.5`) |
| `vite-tsconfig-paths` | Resolve `@/*` in tests | ✗ | — | INSTALL required at Wave 0 (`npm install -D vite-tsconfig-paths@^6.1.1`) |

**Missing dependencies with no fallback:** None. Everything required at runtime is already installed.

**Missing dependencies with install required:** `vitest` + `vite-tsconfig-paths` — trivial install, one `npm install -D` command.

---

## Common Pitfalls

### Pitfall 1: Writing `[]` to the blob on a first-attempt Prime failure
**What goes wrong:** `refreshPrimeUsers()` runs on first miss (D-03), Prime is down, we write `{ users: [], lastError: '...' }` to the blob. Now the blob exists. Next call to `getAllPrimeUsers()` sees it and returns `[]` — but D-04's 30-day safety net thinks the blob is "fresh" (it was written 30 seconds ago). Directory is silently empty for up to 30 days.
**Why it happens:** Conflating "first successful populate" with "first write."
**How to avoid:** On failure with no existing blob, do NOT write a blob. Return `ok: false` from `refreshPrimeUsers()` and let the caller surface the empty state. The next `getAllPrimeUsers()` call will trigger another first-miss attempt.
**Warning signs:** Unit test: "first-miss + Prime fails → blob-cache `setCached` is NOT called."

### Pitfall 2: Email case leakage between store and lookup
**What goes wrong:** Prime returns `"John.Smith@SHBR.com"`. We store as-is. `resolveByEmail("john.smith@shbr.com")` returns `null`.
**Why it happens:** D-09 says normalize on store — easy to forget at write time, easy to notice at read time only when it fails.
**How to avoid:** Centralize normalization in `mapRawToPrimeUser(raw): PrimeUser` — `email: (raw.attributes.email || '').trim().toLowerCase()`. `resolveByEmail` also normalizes input. Unit test both directions.
**Warning signs:** Unit test with raw email `"  FOO@BAR.COM  "` → stored as `"foo@bar.com"`, matched by `resolveByEmail("FOO@BAR.COM")`, `resolveByEmail("  foo@bar.com  ")`, `resolveByEmail("foo@bar.com")`.

### Pitfall 3: Admin endpoint returning 401 when it should return 403 (or vice versa)
**What goes wrong:** Non-admin user hits the endpoint; we return 401 ("not authenticated") when they ARE authenticated, just not an admin.
**Why it happens:** `getSession()` returns a session object with `accessToken/userEmail` regardless of auth validity — you have to check both "session exists" and "email is admin" separately.
**How to avoid:** Canonical pattern:
  ```typescript
  const session = await getSession();
  if (!session.userEmail) return 401;                                  // no session
  const cfg = await getVisibilityConfig();
  if (!isAdminEmail(session.userEmail, cfg)) return 403;              // session but not admin
  // ... do the refresh
  ```
**Warning signs:** Two manual smoke curls — one with no cookie (expect 401), one with a non-admin user's cookie (expect 403).

### Pitfall 4: Hot-path Prime call sneaking into `getAllPrimeUsers()` or `resolveByEmail()`
**What goes wrong:** A well-meaning refactor adds `await refreshPrimeUsers()` to either function "to keep it fresh." Every call to `/admin` or every login now hits Prime. Budget burns.
**Why it happens:** D-01 / D-03 / D-04 are nuanced — fresh eyes may "simplify" by always-refreshing.
**How to avoid:** Add explicit inline comment at the top of each function: `// DIR-02: never call Prime on the hot path. Refresh is triggered only by: (a) admin endpoint, (b) empty cache, (c) 30d stale.`. Unit test: "resolveByEmail on a populated-and-fresh cache → `primeGetAllPages` is called 0 times."
**Warning signs:** Unit test mock assertion on `primeGetAllPages.mock.calls.length`.

### Pitfall 5: Over-reading `lib/blob-cache.ts` contract
**What goes wrong:** Assuming `getCached` returns `null` means "no blob" — but the code (blob-cache.ts:85) ALSO returns null for "ultra-stale" blobs and for fetch errors. Our code reads `null` and thinks "first miss," triggers a refresh unnecessarily.
**Why it happens:** `null` return from `getCached` conflates three distinct states.
**How to avoid:** For our use case this is benign — D-03 says "first access auto-populates" — so treating any `null` as "first miss" is actually correct behavior. BUT: log the reason (`console.info('[prime-users] cache miss — refreshing')`) so debugging "Prime called too often" in prod is easy. Do NOT add extra logic to distinguish blob-missing from blob-corrupt — it's not worth it for a ~30-user directory.
**Warning signs:** Prime call volume higher than expected in production — check `[prime-users]` logs before blaming the cache.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prime OAuth + token cache + 401 refresh | Custom fetch wrapper | `primeGet` / `primeGetAllPages` from `lib/prime-auth.ts` | Already handles token refresh (line 77), 429 retry with Retry-After (line 70), inter-page throttle (line 130). Six months of production use. |
| Persistent key-value cache | Custom blob fetch + write | `getCached` / `setCached` from `lib/blob-cache.ts` | Already handles in-memory layer, direct URL avoidance of `list()` ops, SWR, truly-old discard. Budget-aware for 2,000 ops/month free tier. |
| Admin email check | Read ADMIN_EMAIL, compare | `isAdminEmail(email, config)` from `lib/page-visibility.ts:121` | Handles env-var + config-blob admins list in one call, normalizes case, has the hardcoded-fallback contract already present (DO NOT modify — CLAUDE.md forbidden). |
| Iron-session cookie decrypt | Manual cookie parse | `getSession()` from `lib/session.ts:24` | Already returns typed `SessionData`. D-12 explicitly states "do NOT modify `lib/session.ts`". |
| Email normalization | Scattered `.toLowerCase().trim()` | One helper OR inline both places (keep D-09 contract loud in both `mapRawToPrimeUser` and `resolveByEmail`) | Matches `app/api/auth/login/route.ts:78` + `lib/page-visibility.ts:125` pattern. No new util; drift risk if you DRY it up. |
| Pagination loop with rate limiting | Manual `fetch` + sleep loop | `primeGetAllPages('/users', 100)` | Built-in 1.1s throttle (lib/prime-auth.ts:130), stops on `total_pages` reached. One call. |
| Logging helper | Custom logger | `console.error('[prime-users] …')` inline | Matches entire codebase convention (CONVENTIONS.md §Logging). No logging framework exists; adding one is out of scope. |

**Key insight:** This phase is architecturally thin. Every Prime/cache/auth primitive exists. The phase's job is COMPOSITION, not invention. Anything that smells like a new utility should be scrutinized — is there already one five lines away?

---

## Code Examples

### The happy-path read (Phase 2 will call this from `/api/auth/login/route.ts`)

```typescript
// lib/prime-users.ts — sketch
import { primeGetAllPages } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/blob-cache';

export interface PrimeUser {
  id: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  division: string | null;
  region: string | null;
  roleOrTrade: string | null;
  status: string;
}

interface PrimeUserDirectoryBlob {
  schemaVersion: 1;
  users: PrimeUser[];
  lastSuccessAt: string;
  lastAttemptAt: string;
  lastError: string | null;
  lastErrorAt: string | null;
}

const BLOB_KEY = 'shbr-admin/prime-users.json';
const INDEFINITE_TTL_MS = 50 * 365 * 24 * 60 * 60 * 1000; // effectively never expires
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;      // D-04

export async function getAllPrimeUsers(): Promise<PrimeUser[]> {
  // DIR-02: NEVER call Prime on the hot path except in the two bootstrap branches below.
  let blob = await getCached<PrimeUserDirectoryBlob>(BLOB_KEY);

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

export async function resolveByEmail(email: string): Promise<PrimeUser | null> {
  // D-09: normalize input
  const needle = email.trim().toLowerCase();
  if (!needle) return null;
  const users = await getAllPrimeUsers();
  return users.find(u => u.email === needle) ?? null;
}
```

### The mapping (critical — depends on Wave 0 probe results)

```typescript
// lib/prime-users.ts — sketch, post-probe
interface RawPrimeUser {
  id: string;
  type?: string;
  attributes?: Record<string, unknown>;  // defensive — probe will narrow this
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapRawToPrimeUser(raw: RawPrimeUser): PrimeUser {
  const a = raw.attributes ?? {};
  const firstName = str(a.firstName) ?? '';
  const lastName = str(a.lastName) ?? '';
  return {
    id: raw.id,
    email: ((str(a.email) ?? '')).toLowerCase(),                   // D-09 on store
    fullName: str(a.fullName) ?? `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    division: str(a.division),                                     // Wave 0 may rename key
    region: str(a.region),                                         // Wave 0 may rename key
    roleOrTrade: str(a.roleOrTrade) ?? str(a.role) ?? str(a.trade), // safety belt
    status: str(a.status) ?? 'unknown',
  };
}
```

### The admin refresh endpoint (skeleton)

```typescript
// app/api/admin/prime-users/refresh/route.ts
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

  const result = await refreshPrimeUsers({ reason: 'admin' });
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

  return NextResponse.json({
    ok: true,
    userCount: result.blob.users.length,
    durationMs: result.durationMs,
    cachedAt: result.blob.lastSuccessAt,
  });
}
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Prime `/users` returns `division`, `region`, `roleOrTrade` (or alias keys) in the `attributes` bag | Prime /users Attribute Availability | Phase 2/3 build against a shape Prime doesn't expose. **Mitigation: Wave 0 probe.** |
| A2 | Prime's `q=` filter DSL may or may not work on `/users` | Filter Strategy | Low — recommendation avoids `q=` on `/users` altogether. Only relevant if planner chooses to experiment. |
| A3 | SHBR's user directory fits in a single `/users?per_page=200` page today | Filter Strategy + DIR-01 Test Map | `primeGetAllPages` is used instead, so wrong page-count does not break anything — only adds negligible throttle cost. |
| A4 | Prime `/users` response uses JSON:API v1.0 envelope matching the rest of the Prime API | Code Examples | CONTEXT.md L119 states this is the envelope for Prime. Same verb/path convention as `/jobs`, `/statuses`, `/perils` (all already working in this codebase). High confidence. |
| A5 | 30-day stale threshold is correct for SHBR's hiring cadence | lib/prime-users.ts stale check | Low — admin can force-refresh any time. 30 days is a backstop, not a policy. |

---

## Risks & Open Questions

### High-risk open questions (block planning until resolved or planned-for)

1. **Prime `/users` attribute names** — see Gate 1 above. **Must be a Plan Wave 0 micro-task.** Without this, `mapRawToPrimeUser()` is written against speculation.

### Medium-risk open questions (can be handled in plan or during execution)

2. **Does Prime return a `status` field worth grey-out logic?** — Hint from `app/api/prime/team/route.ts:299` (`u.attributes.status === 'active'`) suggests yes, and value `'active'` is expected. Wave 0 probe will also confirm the value set (probably `active`/`inactive`, maybe `archived`).
3. **Admin endpoint return body shape consumed by Phase 3** — D-13 locks the success shape, D-14 locks the failure shape. Phase 3 picker UI must match. No risk if Phase 3 reads this RESEARCH.md.

### Low-risk open questions

4. **`@/lib/...` vs `./` in test file imports** — cosmetic. `./prime-users` is conventional for co-located tests; `@/lib/prime-users` also works via tsconfigPaths plugin. Pick one, be consistent.
5. **Whether `50 * 365 * 24 * 60 * 60 * 1000` TTL is a code smell** — functionally correct (D-01 says indefinite), but a named constant `INDEFINITE_TTL_MS` with a comment explaining D-01/D-04 separation is kinder to future readers.

---

## Sources

### Primary (HIGH confidence)
- `/mnt/d/Github/shbrdashboard/CLAUDE.md` — project constraints, known-issue flag on hardcoded admin email
- `/mnt/d/Github/shbrdashboard/lib/prime-auth.ts` (full file read) — retry, throttle, pagination contract
- `/mnt/d/Github/shbrdashboard/lib/blob-cache.ts` (full file read) — SWR + `data: unknown` confirmation
- `/mnt/d/Github/shbrdashboard/lib/page-visibility.ts` (full file read) — `isAdminEmail` signature, hardcoded-fallback location
- `/mnt/d/Github/shbrdashboard/lib/session.ts` (full file read) — `SessionData` shape
- `/mnt/d/Github/shbrdashboard/app/api/prime/team/route.ts` lines 1–334 — `RawUser` interface evidence for `/users` attributes
- `/mnt/d/Github/shbrdashboard/app/api/prime/ops/route.ts` lines 1–120 — `primeGetAllPages('/users', 100)` precedent
- `/mnt/d/Github/shbrdashboard/app/api/prime/jobs/estimators/route.ts` lines 1–80 + grep — `/users?per_page=200` precedent
- `/mnt/d/Github/shbrdashboard/app/api/cron/client-analytics-refresh/route.ts` lines 1–80 — Prime `q=` DSL evidence
- `/mnt/d/Github/shbrdashboard/app/api/auth/login/route.ts` full file — email normalization pattern at line 78
- `/mnt/d/Github/shbrdashboard/lib/prime-open-jobs.ts` line 56 — `q='statusId'.in(…)` DSL confirmation
- [nextjs.org/docs/app/guides/testing/vitest (last updated 2026-04-21)](https://nextjs.org/docs/app/guides/testing/vitest) — Vitest manual setup for Next.js 14+ with TypeScript paths
- `npm view` live registry checks on 2026-04-24 — `vitest@4.1.5`, `vite-tsconfig-paths@6.1.1`, `vite@8.0.10`

### Secondary (MEDIUM confidence)
- [Vercel/Next.js discussion #72424](https://github.com/vercel/next.js/discussions/72424) — confirms `vite-tsconfig-paths` is the recommended path-alias bridge for Vitest
- Cross-reference of 8 Prime `q=` callers in codebase — confirms Prime-specific DSL (not JSON:API standard)

### Tertiary (LOW confidence — flagged for planner)
- Assumption that Prime `/users` returns `division`, `region`, `roleOrTrade` keys (see Gate 1, A1 in Assumptions Log). **Recommendation: Wave 0 probe.**

---

## Metadata

**Confidence breakdown:**
- Standard stack (vitest + existing libs): HIGH — all versions verified against live npm registry and official docs
- Architecture (composition of existing primitives): HIGH — every primitive has source-code evidence
- Pitfalls: HIGH — rooted in concrete D-XX decisions and existing-code patterns
- Prime `/users` attribute availability: LOW — code evidence is silent on the three extended fields

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — stable-ish, but the Wave 0 probe may close or reshape Gate 1 earlier)
