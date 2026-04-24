# Phase 1: Prime User Directory - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-side fetcher + cache for Prime `/users`, exposing a reusable lookup module plus an admin-only force-refresh endpoint, with resilient failure behavior. **Pure backend infrastructure.** This phase does NOT change the iron-session cookie shape, AuthContext, `/api/auth/session`, the admin UI, or any user-facing rendering — those are Phases 2 and 3.

Downstream consumers after this phase:
- Phase 2: login resolution of `email → Prime attributes`, session carries them
- Phase 3: picker search, group/admin list rendering, audit log name display

In-scope requirements: **DIR-01, DIR-02, DIR-03, DIR-04**.

</domain>

<decisions>
## Implementation Decisions

### Cache & refresh strategy

- **D-01:** Refresh is **on-demand only** — no cron, no TTL-driven auto-refresh. An admin triggers refresh explicitly via the force-refresh endpoint (see D-07). Rationale: ~30-person business, hiring is infrequent.
- **D-02:** Storage layer is the existing `lib/blob-cache.ts` stale-while-revalidate pattern (Vercel Blob persistence + per-instance in-memory layer). Matches the operational shape of `client-analytics-v2` and `sla-predict` caches.
- **D-03:** On an empty cache (e.g. fresh deploy, wiped blob), the **first access auto-populates** the directory (one Prime call), then reverts to on-demand-only. Removes chicken-and-egg on first boot without introducing ongoing background refreshes.
- **D-04:** **30-day hard safety net** — if the cache hasn't been refreshed in 30 days (admin forgot), the next access auto-refreshes it (one Prime call). Cache is otherwise indefinite.
- **D-05:** Cache key: `shbr-admin/prime-users.json` (namespaced alongside existing `shbr-admin/page-visibility.json`, not in the `shbr-cache/` bucket used for job analytics).

### Module API & record shape

- **D-06:** Module location: **`lib/prime-users.ts`** (new file, kebab-case per convention). Not an extension of `lib/prime-auth.ts` — keeps OAuth/token concerns separate from directory concerns.
- **D-07:** Public API — two functions:
  - `getAllPrimeUsers(): Promise<PrimeUser[]>` — returns the full cached list (used by Phase 3 picker, which filters client-side since the list is small).
  - `resolveByEmail(email: string): Promise<PrimeUser | null>` — case-insensitive email lookup (used by Phase 2 login resolution).
- **D-08:** Cached record (`PrimeUser` type) fields — **extended set**:
  ```
  id, email, fullName, firstName, lastName,
  division, region, roleOrTrade, status
  ```
  Not "everything Prime returns" (avoid persisting phone/address). Not "minimum" (id and status are needed for picker grey-out of inactive users and future migrations).
- **D-09:** Email normalization on STORE — every cached record's `email` is `.trim().toLowerCase()`. Matches `app/api/auth/login/route.ts:78` and `lib/page-visibility.ts:126` patterns. `resolveByEmail()` also normalizes its input.
- **D-10:** An internal refresh function (`refreshPrimeUsers()`) is shared by (a) the admin endpoint, (b) the first-miss bootstrap, and (c) the 30-day safety-net auto-refresh — single code path, single failure-handling shape.

### Admin refresh endpoint

- **D-11:** Route: **`/api/admin/prime-users/refresh`** (POST). Creates the new `/api/admin/` namespace for future admin operations.
- **D-12:** Authentication: **admin session check only** — `getSession()` + `isAdminEmail()` from `lib/page-visibility.ts`. 401 if not logged in, 403 if logged in but not admin. No `x-refresh-secret` header needed (the UI calls it authenticated via cookie).
- **D-13:** Success response: `{ ok: true, userCount: number, durationMs: number, cachedAt: string }`. Admin UI in Phase 3 will display this as "Refreshed 28 users in 1.2s at 3:45pm".
- **D-14:** Failure response: `{ ok: false, error: string, lastSuccessAt: string | null }` with HTTP 502. Cache is **never wiped** on failure — stale data is preserved per DIR-04.
- **D-15:** Internal retry behavior is whatever `primeGet()` already provides (3× retry on 429 with `Retry-After`, one 401 token-refresh retry). No additional retry layer on top.

### Failure resilience & observability

- **D-16:** Cache empty + Prime unreachable: `getAllPrimeUsers()` returns `[]`, `resolveByEmail()` returns `null`. Dependent code (Phase 2 login) degrades gracefully per SESSION-02. Nothing throws, nothing crashes.
- **D-17:** Cache present + Prime unreachable during refresh: serve the stale cache. Do not wipe on failure.
- **D-18:** Logging: `console.error('[prime-users] …')` using the existing `[namespace]` prefix convention (matches `[prime-auth]`, `[blob-cache]`). **No entries added to `lib/audit.ts`** — audit log is for user auth events, not system events.
- **D-19:** The cache blob carries metadata alongside the user list: `{ users, lastSuccessAt, lastAttemptAt, lastError, lastErrorAt }`. This lets Phase 3's admin UI render "Last refresh: 5 days ago (last attempt failed: rate-limited)" without needing a new log stream.

### Test strategy (STATE.md open question — now closed)

- **D-20:** Introduce **Vitest** in Phase 1. Unit-test the pure logic in `lib/prime-users.ts`: email normalization, `resolveByEmail()` hit/miss, empty-cache/stale-cache/error-path branches, record-shape mapping. Prime calls mocked — tests do not hit the real API.
- **D-21:** Setup cost amortized across the milestone — Phase 2 (iron-session cookie shape change, genuinely risky) and Phase 3 (picker filter logic) both use the harness. No integration or E2E tests in this milestone.
- **D-22:** Co-located test files: `lib/prime-users.test.ts` (not a separate `__tests__` dir — smaller blast radius, kebab-case preserved).

### Claude's Discretion

- Exact Vitest config shape (probably minimal: node environment, path alias `@/` mirrored from tsconfig, coverage off initially).
- The exact Prime `q=` filter on `/users` (e.g. limit to `status=active` at fetch time, or fetch all and filter at read time). Researcher/planner decides based on what Prime's query language supports.
- Whether the existing `primeGet('/users?per_page=200')` calls in `app/api/prime/team/route.ts`, `estimators/route.ts`, and `ops/route.ts` get migrated to `getAllPrimeUsers()` as part of this phase or are left alone for a separate cleanup. Default: leave them alone — this phase builds the directory; cleanup is not in DIR-01..04.
- Exact TypeScript type for the Prime `/users` JSON:API response envelope (researcher will inspect an actual response and produce a `RawPrimeUser` interface).
- Blob metadata schema versioning (e.g. a `schemaVersion: 1` field on the blob so a future shape change can be migrated).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone requirements & roadmap
- `.planning/REQUIREMENTS.md` §"Prime User Directory (DIR)" — DIR-01..04 acceptance statements.
- `.planning/ROADMAP.md` §"Phase 1: Prime User Directory" — Goal and four success criteria.
- `.planning/PROJECT.md` §"Context" + §"Constraints" + §"Key Decisions" — Prime rate limits (5,000/day shared), "cache before you call Prime" rule, Prime-as-user-directory decision rationale.
- `.planning/STATE.md` §"Blockers/Concerns" — This phase closes the "cache refresh cadence" and "test strategy" open questions flagged at milestone init.

### Codebase maps (generated by /gsd-map-codebase)
- `.planning/codebase/STACK.md` — Next.js 14 App Router, Vercel, `@vercel/blob`, iron-session, no test harness.
- `.planning/codebase/CONVENTIONS.md` — Naming (PascalCase components, kebab-case utilities, `[namespace]` log prefix), ESLint + strict TypeScript, named exports, `@/` path alias.
- `.planning/codebase/INTEGRATIONS.md` — Prime API client shape.
- `.planning/codebase/CONCERNS.md` §"Prime API Integration — No Fallback" — Known fragility we're partly mitigating here; and §"Hardcoded Admin Email" (explicitly deferred, do NOT fix in this phase).

### Existing code (primary reference implementations)
- `lib/prime-auth.ts` — `primeGet()` + `primeGetAllPages()` already handle OAuth token cache, 429 retry with `Retry-After`, 401 token refresh, 1.1s inter-page throttle. **Reuse as-is.**
- `lib/blob-cache.ts` — Stale-while-revalidate cache backed by Vercel Blob with in-memory layer. **Reuse via `getCached()` / `setCached()` / `invalidateCache()`**, though this phase will add `lastError/lastSuccessAt` metadata on its own blob record (not a blob-cache API change).
- `lib/page-visibility.ts` — `isAdminEmail()` is the admin-gate function for D-12; `getVisibilityConfig()` demonstrates the blob-read-with-fallback pattern we'll mirror.
- `lib/session.ts` — iron-session setup. Informational only — this phase does NOT touch it.
- `app/api/auth/login/route.ts` — Email normalization pattern (D-09) and `[prime-auth]` log prefix example.
- `app/api/prime/team/route.ts` — Existing `primeGet('/users?per_page=200')` caller. Shows the `RawUser` attributes actually consumed today (fullName, firstName, lastName, email, status, roles). **Researcher must verify whether Prime `/users` also returns `division`, `region`, and `role/trade` as requirements assume** — if not, this is the first research gate.
- `app/api/cron/client-analytics-refresh/route.ts` — Reference for a Prime→Blob refresh route. This phase does NOT add a cron entry to `vercel.json`; the structure is only a model for pagination + error logging.

### No external specs or ADRs
This project has no ADR directory or formal spec folder. All requirements are captured in the `.planning/` milestone docs listed above. If any external docs emerge during research, the planner should add them here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **`lib/prime-auth.ts:primeGet()`** — All Prime OAuth, retry, and rate-limit handling is done. We just call it with `/users?per_page=200` (or paginate with `primeGetAllPages`).
- **`lib/blob-cache.ts:getCached/setCached/invalidateCache`** — Persistence + in-memory layer + SWR already implemented. We'll store our record at a dedicated key with extended metadata (users + lastError + lastSuccessAt).
- **`lib/page-visibility.ts:isAdminEmail()`** — Admin-gate for the force-refresh endpoint (D-12).
- **`lib/session.ts:getSession()`** — Session read for endpoint auth.

### Established patterns
- **`[namespace]` log prefix** on server-side console calls (`[prime-auth]`, `[blob-cache]`, etc.). D-18 adopts `[prime-users]`.
- **Email normalization** = `.trim().toLowerCase()` on store AND on compare (matches `app/api/auth/login/route.ts:78` and `lib/page-visibility.ts:isAdminEmail`).
- **JSON:API v1.0 envelope** from Prime: `{ data: [{ id, type, attributes: {...} }], meta: { pagination: {...} } }`.
- **Cron refresh secret** via `x-refresh-secret` header when an endpoint is cron-callable. D-11/D-12 intentionally skip this — the admin endpoint is session-gated only for now. If a future cron refresh is added (milestone v2+), the same internal `refreshPrimeUsers()` function can be wrapped in a cron-secret-gated route.
- **No test harness today** — this phase introduces Vitest (D-20).

### Integration points
- `/api/admin/prime-users/refresh` — net-new route. Creates `app/api/admin/` tree.
- `lib/prime-users.ts` — net-new module. Exported types (`PrimeUser`) become the shared identity shape imported by Phase 2 (`SessionData` extension) and Phase 3 (picker rendering).
- Future Phase 2 touchpoint: `app/api/auth/login/route.ts` will call `resolveByEmail()` after a successful Prime OAuth response. Not in Phase 1 scope but the API D-07 locks the signature.
- Future Phase 3 touchpoints: admin UI picker imports `getAllPrimeUsers()`; group/admin list rendering imports `resolveByEmail()` for per-row display. Not in Phase 1 scope.

### Explicitly NOT touched in this phase
- `lib/session.ts` / iron-session cookie shape (Phase 2).
- `AuthContext` / `auth-context.tsx` (Phase 2).
- `/api/auth/session` (Phase 2).
- Admin UI `/admin` page and tabs (Phase 3).
- Existing `primeGet('/users?per_page=200')` callers in `team/route.ts`, `estimators/route.ts`, `ops/route.ts` — left alone per "Claude's Discretion" note above.
- Hardcoded admin fallback in `lib/page-visibility.ts:126` (REQUIREMENTS.md v2 BOOTSTRAP-01 — deferred).

</code_context>

<specifics>
## Specific Ideas

- Admin UI feedback loop: the Phase 3 "Refresh Users" button should display `userCount` and `cachedAt` from D-13 so admins get immediate confirmation. Not in Phase 1 code, but D-13 response shape is designed for this.
- Visibility into silent failures: D-19's `lastError + lastErrorAt` lets Phase 3 show a subtle warning when the last refresh attempt failed. Prevents the classic "admin hits refresh, nothing obvious happens, directory is now silently broken" trap.

</specifics>

<deferred>
## Deferred Ideas

- **Migrate existing `primeGet('/users?per_page=200')` callers** in `team/route.ts`, `estimators/route.ts`, `ops/route.ts` to consume `getAllPrimeUsers()` — a natural cleanup that would reduce Prime load further, but outside DIR-01..04 scope. Backlog candidate for a post-milestone cleanup phase.
- **Scheduled refresh (cron)** — decided against in D-01 for this milestone; adding one later is trivial because D-10 centralizes the refresh function. If Prime user turnover ever increases, re-open.
- **Attribute-driven rule groups** (e.g. "all users in division=Estimators auto-belong") — rejected at the milestone level per PROJECT.md Key Decisions. Not re-opening here.
- **Server-side enforcement of page visibility** (ENFORCE-01..03) — v2 milestone.
- **Audit trail for admin config changes** (ADMIN-AUDIT-01..03) — v2 milestone.
- **Remove hardcoded `chris.freeman@techgurus.com.au` fallback** in `lib/page-visibility.ts:126` (BOOTSTRAP-01) — v2 milestone; CLAUDE.md explicitly says "do not propagate".

</deferred>

---

*Phase: 01-prime-user-directory*
*Context gathered: 2026-04-24*
