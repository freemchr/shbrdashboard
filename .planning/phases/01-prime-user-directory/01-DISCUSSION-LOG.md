# Phase 1: Prime User Directory - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 01-prime-user-directory
**Areas discussed:** Refresh cadence & storage, API surface & record shape, Admin refresh endpoint, Failure resilience & logging, Test strategy

---

## Refresh cadence & storage

### Q: Primary refresh mechanism for the Prime user directory?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: TTL + daily cron | TTL expiry with a Vercel cron pre-warm before business hours, mirrors existing analytics-refresh pattern | |
| TTL-only (lazy refresh) | TTL with SWR; first post-expiry request triggers refresh | |
| Cron-only (fixed schedule) | Scheduled cron is sole refresher; cache effectively never expires between runs | |
| On-demand only (admin-triggered) | No scheduled refresh — admin endpoint is sole trigger | ✓ |

**User's choice:** On-demand only (admin-triggered)
**Notes:** "They dont hire regularly, it can be done on a refresh / manual effort. The business is only small 30 employees."

### Q: How fresh does the directory need to be?

| Option | Description | Selected |
|--------|-------------|----------|
| 24h (daily) | New hires/leavers appear next business day | |
| 6h | Same-day responsiveness, ~4 refreshes/day | |
| 12h | Morning + evening refresh | |
| 1h (most responsive) | Near-live tracking, ~24 Prime calls + 24 Blob writes/day | |

**User's choice:** "They don't hire regularly, it can be done on a refresh / manual effort. The business is only small 30 employees." (free text — reinforces on-demand-only choice above; no scheduled cadence applies)
**Notes:** Freshness is driven by admin discretion, not a time interval.

### Q: Storage layer for the cached directory?

| Option | Description | Selected |
|--------|-------------|----------|
| blob-cache.ts SWR | Existing Vercel Blob + in-memory layered cache | ✓ |
| In-memory only (lib/cache.ts) | Simpler Map-based TTL cache; cold starts re-fetch | |
| Both layered (explicit) | Make blob + mem layers first-class in the module | |

**User's choice:** blob-cache.ts SWR (Recommended)
**Notes:** —

### Follow-up Q: First-ever boot / empty cache — what happens if someone logs in before any admin has clicked 'Refresh'?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-populate on first miss | First access auto-fetches Prime /users once, then on-demand only | ✓ |
| Return empty until admin refreshes | Fresh deploy = empty directory; login falls back to email-only per SESSION-02 | |
| Pre-seed on first deploy via build hook | Deploy hook populates the blob; complex | |

**User's choice:** Auto-populate on first miss (Recommended)
**Notes:** Resolves the chicken-and-egg without introducing background refresh.

### Follow-up Q: Safety net — should the cache have ANY maximum age, or truly never expire until admin refreshes?

| Option | Description | Selected |
|--------|-------------|----------|
| 30-day hard max | Indefinite UNLESS >30 days old, then next access auto-refreshes | ✓ |
| Truly indefinite | Admin is sole trigger; cache could be a year old | |
| 7-day safety net | Shorter guardrail; more unexpected refreshes | |

**User's choice:** 30-day hard max (Recommended)
**Notes:** Backstops "admin forgot for a month" without forfeiting on-demand semantics.

---

## API surface & record shape

### Q: What functions should the Prime user directory module expose?

| Option | Description | Selected |
|--------|-------------|----------|
| Two-function: getAll + resolveByEmail | Minimum useful surface for Phase 2 + Phase 3 | ✓ |
| Full toolkit: getAll + resolveByEmail + resolveMany + search | More surface area, more to test | |
| Minimal: resolveByEmail only | Forces consumers to re-read blob for listing | |

**User's choice:** Two-function (Recommended)
**Notes:** —

### Q: Which Prime user fields should be persisted in the cached record?

| Option | Description | Selected |
|--------|-------------|----------|
| Extended: id, email, fullName, firstName, lastName, division, region, role/trade, status | Requirements plus id + status for future-proofing and picker grey-out | ✓ |
| Minimum: email, displayName, division, region, role/trade | Exactly what REQUIREMENTS.md calls out | |
| Everything Prime returns | Whole attributes object; couples us to Prime's shape | |

**User's choice:** Extended (Recommended)
**Notes:** —

### Q: Where should the new directory module live?

| Option | Description | Selected |
|--------|-------------|----------|
| lib/prime-users.ts | New dedicated module, matches kebab-case convention | ✓ |
| lib/prime-directory.ts | More descriptive but same shape | |
| Extend lib/prime-auth.ts | Colocate with auth; makes prime-auth a grab-bag | |

**User's choice:** lib/prime-users.ts (Recommended)
**Notes:** —

---

## Admin refresh endpoint

### Q: Where should the force-refresh endpoint live?

| Option | Description | Selected |
|--------|-------------|----------|
| /api/admin/prime-users/refresh | Creates new /api/admin/ namespace for future admin ops | ✓ |
| /api/prime/users/refresh | Under existing /api/prime/ tree, colocated with reads | |
| /api/prime-users/refresh | Top-level flat route | |

**User's choice:** /api/admin/prime-users/refresh (Recommended)
**Notes:** —

### Q: How should the refresh endpoint be authenticated?

| Option | Description | Selected |
|--------|-------------|----------|
| Admin session check only — isAdminEmail() | Reuse lib/page-visibility.ts:isAdminEmail against the session cookie | ✓ |
| Session check + CRON_SECRET for automation | Hedges for future cron without rewiring | |
| CRON_SECRET header only | Would require shipping secret to client; not viable | |

**User's choice:** Admin session check only (Recommended)
**Notes:** —

### Q: What should the response body return on successful refresh?

| Option | Description | Selected |
|--------|-------------|----------|
| Detailed JSON: { ok, userCount, durationMs, cachedAt } | Admin UI can render actionable confirmation | ✓ |
| Minimal: { ok: true } | Generic toast only | |
| Full snapshot: { ok, userCount, cachedAt, users: [...] } | Returns full list; larger payload | |

**User's choice:** Detailed JSON (Recommended)
**Notes:** —

---

## Failure resilience & logging

### Q: Cache is empty AND Prime fails on first access — how should the directory behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Return empty list, log the failure | getAll returns []; resolveByEmail returns null; login degrades per SESSION-02 | ✓ |
| Return empty list + mark record with 'empty + error' flag | Same, but record carries { users: [], lastError, populated: false } | |
| Throw — block all dependent requests | Contradicts SESSION-02 | |

**User's choice:** Return empty list, log the failure (Recommended)
**Notes:** —

### Q: How should Prime fetch failures and stale-cache warnings be surfaced for admin visibility?

| Option | Description | Selected |
|--------|-------------|----------|
| console.error + record lastError on the cache blob | Existing [namespace] log prefix PLUS metadata on the blob for admin UI | ✓ |
| console.error only | Matches current codebase baseline; no admin visibility | |
| console.error + append to audit log | Muddles audit log's user-event purpose | |

**User's choice:** console.error + record lastError on the cache blob (Recommended)
**Notes:** —

### Q: On admin-triggered refresh failure, what should the endpoint do?

| Option | Description | Selected |
|--------|-------------|----------|
| Return { ok: false, error, lastSuccessAt } — preserve cache | Stale preferred to wiped; HTTP 502 | ✓ |
| Retry internally (3x) before giving up | primeGet already retries; extra layer adds latency | |
| Wipe cache + return error | Violates DIR-04 | |

**User's choice:** Return { ok: false, error, lastSuccessAt } — preserve cache (Recommended)
**Notes:** —

---

## Test strategy

### Q: How should Phase 1 (and by extension this milestone) handle testing?

| Option | Description | Selected |
|--------|-------------|----------|
| Add Vitest + unit tests for pure logic | One-time setup in Phase 1; Phases 2 & 3 inherit the harness | ✓ |
| No test framework — manual verification | Matches zero-test baseline; no safety net for cookie-shape change | |
| Vitest + unit tests + staging smoke test | Adds preview-deploy smoke; overkill now | |
| TypeScript strict only — no tests at all | Explicit no-tests rule for the milestone | |

**User's choice:** Add Vitest + unit tests for pure logic (Recommended)
**Notes:** —

---

## Claude's Discretion

- Exact Vitest config shape (node environment, `@/` path alias, coverage settings).
- Prime `q=` filter for `/users` (fetch-time vs read-time filtering of inactive users).
- Whether to migrate existing `primeGet('/users?per_page=200')` callers to the new module in this phase (default: leave them alone).
- Exact TypeScript shape for the Prime `/users` JSON:API envelope (researcher will produce `RawPrimeUser` from an actual response).
- Blob metadata schema versioning on the cache record.

## Deferred Ideas

- Migrate existing `primeGet('/users?per_page=200')` callers — backlog for post-milestone cleanup.
- Scheduled cron refresh — out of scope; revisit if user turnover increases.
- Attribute-driven rule groups, enforcement, admin config audit, hardcoded admin fallback removal — v2 milestone per REQUIREMENTS.md.
