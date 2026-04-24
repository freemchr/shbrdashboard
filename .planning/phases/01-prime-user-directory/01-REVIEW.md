---
phase: 01-prime-user-directory
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - app/api/admin/prime-users/refresh/route.ts
  - lib/prime-users.test.ts
  - lib/prime-users.ts
  - package.json
  - vitest.config.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-04-24
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 1 delivers a clean composition of existing primitives (`primeGetAllPages`, `blob-cache`, `isAdminEmail`, `getSession`) into a Prime user directory with on-demand refresh semantics. The implementation faithfully encodes every bound decision (D-01 through D-22) and mitigates the two RESEARCH pitfalls flagged for this phase:

- **Pitfall 1 (first-miss write-of-empty)** — correctly guarded by `if (existing)` in `refreshPrimeUsers` error path. No empty blob is persisted on first-miss + Prime-down, so the 30-day safety net cannot be falsely satisfied.
- **Pitfall 3 (401 vs 403)** — two-gate check in the admin route returns the correct status code for each failure class.

Security posture is solid: the hardcoded admin fallback (`chris.freeman@techgurus.com.au`) is NOT propagated into this module (it's only referenced transitively via `isAdminEmail`, per design). Error messages surfaced to the admin originate from `prime-auth.ts`, which already sanitises them to generic strings like `"Prime API request failed (503)"` — no stack traces, no token material, no raw Prime response bodies. `runtime = 'nodejs'` is set on the iron-session route.

Prime budget discipline is preserved: `getAllPrimeUsers()` and `resolveByEmail()` never call Prime on the hot path except at the two documented bootstrap branches (first-miss, 30-day stale). No call multipliers detected.

Test coverage is meaningful — assertions verify behavior (mock call counts, specific blob shape, preserve-on-failure semantics), not trivial truthy checks. The module boundary mocks (`./prime-auth`, `./blob-cache`) prevent accidental real Prime/Blob calls.

Two `Warning` items and five `Info` items below. No Critical findings.

## Warnings

### WR-01: `refreshPrimeUsers` caches empty `users: []` on a successful-but-empty Prime response

**File:** `lib/prime-users.ts:142-152`
**Issue:** The try-branch treats any successful `primeGetAllPages` result as a valid refresh, including `[]`. If Prime ever returns an empty `data` array (tenant misconfiguration, permission change, filter applied upstream, or Prime bug), the success path runs: `users = []`, `lastSuccessAt = now`, and `setCached` writes the empty directory. The 30-day safety net (`lastSuccessMs` fresh) then *suppresses* re-fetch for 30 days — which is precisely the symptom Pitfall 1 was designed to prevent, just via a different failure mode.

The test `'blob written includes schemaVersion: 1'` (test file:309-318) explicitly verifies this path by mocking `primeGetAllPages.mockResolvedValueOnce([])` and asserting `setCached` is called. So the behavior is intentional/tested — but it's a sharp edge that should be acknowledged and (ideally) gated.

**Fix:** Treat a zero-length Prime response as suspicious when an existing populated blob exists, and log it loudly at minimum:

```typescript
const users = raw.map(mapRawToPrimeUser);
if (users.length === 0 && existing?.users && existing.users.length > 0) {
  // Pitfall 1 analog: Prime returned empty but we had users yesterday.
  // Preserve existing; surface as a soft error on the blob.
  console.error('[prime-users] refresh returned 0 users; preserving previous', {
    previousCount: existing.users.length,
  });
  const blob: PrimeUserDirectoryBlob = {
    schemaVersion: 1,
    users: existing.users,
    lastSuccessAt: existing.lastSuccessAt,
    lastAttemptAt: attemptAt,
    lastError: 'Prime returned 0 users',
    lastErrorAt: attemptAt,
  };
  await setCached(BLOB_KEY, blob, INDEFINITE_TTL_MS);
  return { ok: false, blob, durationMs: Date.now() - t0 };
}
```

If this is too strict for first-boot (no existing blob + Prime legitimately has 0 users — very unlikely at SHBR), gate only on `existing?.users.length > 0`. Alternatively, document explicitly that "0 users = accept" is a tenant-trust assumption and add a test case that locks it in.

---

### WR-02: `opts.reason` is accepted on the signature but never used for log context (D-18 observability gap)

**File:** `lib/prime-users.ts:134-135, 155, 172`
**Issue:** `refreshPrimeUsers({ reason })` accepts three distinct trigger sources (`'admin' | 'first-miss' | 'stale-30d'`) but the error log at line 155 does not include it, and the success path doesn't log at all. The parameter is only `void opts.reason;`'d at line 172, which is a no-op. D-18 mandates `[prime-users]` log context; RESEARCH Pitfall 5 explicitly recommends logging the reason to debug "Prime called too often in prod". As-written, an operator seeing `[prime-users] refresh failed:` in logs cannot tell whether an admin clicked the button, a login triggered bootstrap, or the 30-day safety net fired.

**Fix:** Include `reason` in the error log and add a matching success log:

```typescript
} catch (err) {
  console.error(`[prime-users] refresh failed (reason=${opts.reason}):`, err);
  // ... existing error blob construction
}
```

And optionally (RESEARCH Pitfall 5 "log the reason"):

```typescript
// after successful setCached
console.info(`[prime-users] refresh ok (reason=${opts.reason}, users=${users.length}, ms=${Date.now() - t0})`);
```

The `void opts.reason;` line can then be removed. Note: the existing test `'logs "[prime-users] refresh failed:" on error'` uses `expect.stringMatching(/^\[prime-users\] refresh failed:/)` which is a prefix match — it will continue to pass after this change. No test refactor needed for the error path.

## Info

### INF-01: `RawPrimeUser.type` field is declared but never read

**File:** `lib/prime-users.ts:55-59`
**Issue:** The `type` field on the internal `RawPrimeUser` interface is optional and never consumed by `mapRawToPrimeUser`. It's documentation of the JSON:API envelope shape, which is useful, but a reviewer may mistake it for a validated field.
**Fix:** Either drop it, or add an inline comment: `type?: string; // JSON:API envelope field; not validated — mapper ignores it`.

---

### INF-02: `str()` helper duplicates `.trim()` logic used three different ways across the file

**File:** `lib/prime-users.ts:66-70, 105, 106, 218`
**Issue:** `str(v)` trims internally. At line 105, `.toLowerCase()` is chained on `(str(a.email) ?? '')`. At line 218, `resolveByEmail` does `email.trim().toLowerCase()` directly (not using `str`). At line 106, `.trim()` is re-applied to the `fullName` fallback. The logic is correct everywhere but three slightly different shapes for the same concept (normalise-string-to-non-empty-or-null) invite future drift.
**Fix:** None required — the current shape is defensible because `resolveByEmail`'s input is a `string` (not `unknown`), so `str()` would be type overkill. Leave as-is; this is flagged purely to signal that if a fourth normalisation site appears, consolidate then.

---

### INF-03: Status fallback to `'unknown'` will route those users through the inactive branch downstream

**File:** `lib/prime-users.ts:115`
**Issue:** `status: str(a.status) ?? 'unknown'` — the probe (test-file preamble) observed only `'active'` and `'inactive'` in the tenant, so the `'unknown'` branch should never fire in practice. However, `PrimeUser.status` is typed `string` (not a union), so downstream Phase 2/3 consumers that check `status === 'active'` will treat `'unknown'` as inactive. That's probably the desired conservative default, but it's implicit — a user with missing status becomes invisible in "active" pickers without any surfaced warning.
**Fix:** Consider narrowing the type to `status: 'active' | 'inactive' | 'unknown'` or logging once when `'unknown'` is mapped. Not required for this phase; flag for Phase 3 picker design.

---

### INF-04: `vitest.config.ts` `clearMocks: true` + per-test `vi.resetAllMocks()` is redundant (benign)

**File:** `vitest.config.ts:11`, `lib/prime-users.test.ts:56-58`
**Issue:** The config sets `clearMocks: true` (clears call history between tests) and the test file's `beforeEach` calls `vi.resetAllMocks()` (which is strictly stronger — clears history AND resets implementations). The latter makes the former redundant. This is benign and `resetAllMocks` is the correct choice for this test file since several tests replace implementations via `.mockResolvedValueOnce` / `.mockRejectedValueOnce`.
**Fix:** Drop `clearMocks: true` from `vitest.config.ts` for simplicity, or document that it's intentional belt-and-braces. No behavioral change either way.

---

### INF-05: `maxDuration = 60` on an endpoint whose worst-case is a single `primeGetAllPages('/users', 100)` call

**File:** `app/api/admin/prime-users/refresh/route.ts:25`
**Issue:** `maxDuration = 60` (seconds) is borrowed from `app/api/prime/team/route.ts` per the inline comment. For a ~30-user directory, worst-case is one Prime page + at most 3 x 429 retries (prime-auth retry ladder). That's well under 10s. 60s is safe but generous.
**Fix:** No change required — 60s matches the team route precedent and gives headroom if Prime is slow. Documented via inline comment. Flagged only to acknowledge the conservatism is deliberate.

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
