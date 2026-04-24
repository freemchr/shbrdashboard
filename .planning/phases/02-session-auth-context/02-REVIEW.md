---
phase: 02-session-auth-context
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - app/admin/page.tsx
  - app/api/audit/log/route.ts
  - app/api/auth/login/route.ts
  - app/api/auth/login/route.test.ts
  - app/api/auth/session/route.ts
  - app/api/auth/session/route.test.ts
  - components/ui/AuthGuard.tsx
  - components/ui/TopBar.tsx
  - lib/audit.test.ts
  - lib/audit.ts
  - lib/auth-context.tsx
  - vitest.config.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-04-24
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 2 (Session & Auth Context Integration) is a small, well-scoped, well-documented diff (~22 net source lines + ~500 lines of new tests). The implementation honours the locked decisions tightly:

- iron-session cookie shape unchanged (D-03 / D-21) — confirmed by `lib/session.ts` untouched.
- `/api/auth/session` is the sole client-facing delivery channel for `primeUser` (D-09) — only `components/ui/AuthGuard.tsx` fetches it (verified across `app/`, `components/`, `lib/`).
- `resolveByEmail` is NOT wrapped in try/catch (Pattern 2, Phase 1 D-16) — both call sites correctly trust the no-throw contract.
- Login ordering invariant honoured (D-04 / Pitfall 6): `resolveByEmail` runs strictly after `session.save()` and inside the post-OAuth-success branch. The 401-OAuth and 429-rate-limit branches both early-return before resolution — tests `'does NOT call resolveByEmail ... on OAuth failure'` and `'rate-limit 429 short-circuits'` lock this in.
- Audit forgery guard (`VALID_ACTIONS = ['login', 'logout']`) preserved with an inline SECURITY comment explaining why `prime_user_miss` must NEVER be added.
- TopBar identity cascade matches D-10 with whitespace defence (`.trim() || userEmail`).
- `lib/auth-context.tsx` uses `import type { PrimeUser }` so server-only `lib/blob-cache` does NOT leak into the client bundle. Verified.

No critical issues. Two warnings concern small login-budget and forward-compat surprises; four info items concern minor UX/admin observability gaps.

## Warnings

### WR-01: Login miss path issues TWO sequential `getAllPrimeUsers` calls and can chain Prime API requests on bootstrap

**File:** `app/api/auth/login/route.ts:102-117`

**Issue:** When `resolveByEmail(normalisedEmail)` returns `null`, the route immediately calls `getAllPrimeUsers()` to disambiguate `cache_empty` vs `cache_hit: no match`. But `resolveByEmail` already invokes `getAllPrimeUsers` internally (`lib/prime-users.ts:220`). On a warm in-memory cache this is fine (the second call is genuinely O(1)). However, on a cold start with no blob (D-03 first-miss), the chain is:

1. `resolveByEmail` → `getAllPrimeUsers` → `refreshPrimeUsers({reason: 'first-miss'})` → 1 paginated Prime fetch
2. If that refresh **fails** (Prime down, blob unwritten per Pitfall 1), `getAllPrimeUsers` returns `[]`
3. `resolveByEmail` returns `null`
4. The route then calls `getAllPrimeUsers()` AGAIN — and because no blob was written on first-miss failure, this second call **re-triggers** `refreshPrimeUsers({reason: 'first-miss'})` and another full paginated Prime fetch

So a Prime-down login on a cold-cache deploy can burn 2× the `/users` page count against the 5,000-req/day budget per failed login. With 50 staff retrying, that climbs fast. The inline comment ("`getAllPrimeUsers` is O(1) on the in-memory blob-cache hit path") is correct but only describes the warm path — the cold/first-miss-failure path is the one this code deliberately added.

**Fix:** Cache the directory length once and reuse it. The `getAllPrimeUsers` call exists solely to compute the `detail` string — capture the array from the first call indirectly. Either:

```ts
// Option A — fetch once, do the lookup ourselves
const allUsers = await getAllPrimeUsers();
const primeUser = allUsers.find(u => u.email === normalisedEmail) ?? null;

if (!primeUser) {
  const detail = allUsers.length === 0 ? 'cache_empty' : 'cache_hit: no match';
  await appendAuditLog({ email: normalisedEmail, name: userName, action: 'prime_user_miss', detail });
}
```

```ts
// Option B — keep resolveByEmail, only call getAllPrimeUsers when we know we missed,
// AND only when the in-memory cache is now warm (i.e. resolveByEmail succeeded in
// populating the cache). Add a public hasBootstrapped() helper to lib/prime-users.ts
// that returns whether the blob exists, so we don't re-trigger refresh.
```

Option A is the minimal change and removes the doubled refresh risk entirely. It also collapses two calls into one on every miss, not just the cold-cache miss.

---

### WR-02: `prime_user_miss` rows share the 200-entry audit ring buffer with `login` / `logout` — a misconfigured deploy can evict legitimate auth history

**File:** `lib/audit.ts:4` (constant), `lib/audit.ts:30` (truncation), `app/api/auth/login/route.ts:111-117` (new writer)

**Issue:** `MAX_ENTRIES = 200` and `appendAuditLog` truncates with `.slice(0, MAX_ENTRIES)` (newest-first). Phase 2 introduces a **new writer** that fires on every login by an email not in the Prime directory. In two realistic failure modes the ring buffer fills with `prime_user_miss` rows:

1. **First-miss bootstrap broken** (Prime down for an extended window): every login writes one `prime_user_miss` row with `detail: 'cache_empty'`. Each login now consumes **two** rows (login + miss) instead of one. Effective audit retention halves.
2. **Stale email allow-listed** (e.g. an iron-session cookie still valid for an ex-staff member, or a non-Prime account that has Prime OAuth credentials but no `/users` directory entry): every session check by AuthGuard does NOT write — only login does — but kiosks / shared accounts that re-login frequently can dominate the buffer.

Combined: a single Prime outage during business hours could push login/logout history out of the 200-row window in under a day on a 50-user tenant.

**Fix:** Cheapest mitigation — bump `MAX_ENTRIES` to e.g. 500 (or split caps per action). Storage cost is one Vercel Blob JSON write; the read path already tolerates larger arrays. Alternatively, store `prime_user_miss` in a separate blob/key so it doesn't compete with the user-visible audit log.

```ts
// lib/audit.ts
const MAX_ENTRIES = 500; // raised from 200 in Phase 2 — prime_user_miss now shares quota
```

If retention preservation is non-negotiable, split the streams:

```ts
// Two blob keys, two MAX_ENTRIES, /api/audit/entries route filters by streamKey.
```

---

## Info

### IN-01: Audit `actionFilter` UI does not include `prime_user_miss` — admins cannot filter to view miss events

**File:** `app/admin/page.tsx:496` (type), `app/admin/page.tsx:587-592` (select options)

**Issue:** Phase 2 added a `Miss` badge (`app/admin/page.tsx:512-514`) and the audit log will now contain `prime_user_miss` rows mixed in with login/logout. But the filter dropdown is hard-coded to `'all' | 'login' | 'logout'`. Admins can see miss rows in the "All" view but cannot isolate them — which is the most common reason an admin would check the audit log post-Phase-2 (debugging "why is my Prime name not showing"). The CSV export likewise omits `detail` (see IN-02), so even the workaround of filtering CSV in Excel is degraded.

**Fix:**
```ts
type ActionFilter = 'all' | 'login' | 'logout' | 'prime_user_miss';
```
And add an option:
```tsx
<option value="prime_user_miss">Prime miss</option>
```
The server-side `/api/audit/entries` route already accepts `action` as a freeform query string (per the `params.set('action', actionFilter)` call at `app/admin/page.tsx:547`); whether it filters server-side or client-side is implementation-dependent and worth confirming.

---

### IN-02: CSV export omits the `detail` column — `cache_empty` vs `cache_hit: no match` distinction is lost on export

**File:** `app/admin/page.tsx:518-531`

**Issue:** `exportCSV` headers are `['Timestamp (AEDT)', 'Email', 'Name', 'Action']`. The new `detail` field on `AuditEntry` (`lib/audit.ts:17`) is dropped. For `prime_user_miss` rows specifically, `detail` is the **only** column that distinguishes "Prime cache is broken / empty" from "this user genuinely isn't in Prime" — exactly the diagnostic value Phase 2 added.

**Fix:**
```ts
const headers = ['Timestamp (AEDT)', 'Email', 'Name', 'Action', 'Detail'];
const rows = entries.map(e => [formatAEDT(e.timestamp), e.email, e.name || '', e.action, e.detail || '']);
```

---

### IN-03: Login route response uses email as `userName` even when Prime resolution succeeds with a `fullName`

**File:** `app/api/auth/login/route.ts:80, 119`

**Issue:** `userName = normalisedEmail` is set unconditionally. The login response `{ success: true, userName }` and the login audit row's `name` field both echo the email. This was the pre-Phase-2 behaviour and is **preserved deliberately** (D-03 forbids denormalising Prime fields into the cookie / response, D-09 makes session route the sole `primeUser` channel). However, the audit log's `name` column — which the audit table renders as the primary user identifier (`app/admin/page.tsx:630`: `entry.name || entry.email`) — will continue to show the email for every login, even after Phase 2 ships. Prime fullName surfaces only in TopBar (live) and not in historical audit rows.

This is **correct per the contract** (audit rows are immutable historical records and must NOT live-read Prime), but worth flagging as an Info item so it isn't mistaken for a regression during UAT. If the team wants Prime fullName in the audit `name` column at write-time, that is an additive change inside the `if (primeUser) { … }` branch — but it is out of scope for Phase 2 and was not specified.

**Fix:** None required for Phase 2. Document the behaviour in the phase summary if not already covered. If the team later wants Prime fullName captured at write-time:

```ts
// Inside POST after resolveByEmail completes:
await appendAuditLog({
  email: normalisedEmail,
  name: primeUser?.fullName || userName,  // prefer Prime name when available
  action: 'login',
});
```
Note this would require moving the existing `appendAuditLog({action: 'login'})` block to AFTER `resolveByEmail`, slightly changing the ordering invariant.

---

### IN-04: Pre-existing duplicate-fetch and 500ms-timeout heuristic in admin page are not regressions, but worth flagging adjacent to Phase 2 changes

**File:** `app/admin/page.tsx:50-77`

**Issue:** The admin page has a pre-existing `useEffect` (lines 70-77) that issues a second `fetch('/api/auth/session')` purely to gate access — duplicating the fetch already issued by `AuthGuard`. Phase 2's D-09 establishes "AuthGuard is the ONLY fetcher of `primeUser`" but this admin-side duplicate fetch existed before Phase 2 and is unchanged by it (verified against `f80cf7e` baseline — only a +3 line `Miss` badge addition was made to this file). The duplicate fetch does not break D-09 because it never reads `primeUser` from the response — but it does double the per-page-load cost of the visibility-config blob read (called inside `/api/auth/session`) and the new Prime resolution (D-01 live-read).

Additionally, the 500ms `setTimeout` at line 65 to "wait for auth context to settle" is a fragile timing heuristic that can race with slow networks / cold starts.

Both are pre-existing — flagged here because Phase 2 amplifies their cost (every admin page load now does **two** Prime resolutions instead of one). Recommend opening a follow-up ticket; out of scope for Phase 2 verification.

**Fix:** Out of scope — track in a separate ticket. The clean fix is to read `isAdmin` directly from `useAuth()` (already done at line 48) and remove the entire belt-and-suspenders block (lines 70-77), since AuthGuard already redirects on 401.

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
