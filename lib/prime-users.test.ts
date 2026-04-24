// === PROBE FINDINGS (Wave 0, Task 0.4) =====================================
// One Prime /users record was inspected on <DATE>. The actual attribute keys
// returned by Prime for SHBR's account are listed below. Wave 1's
// `mapRawToPrimeUser()` MUST be written against THESE keys, not the speculative
// names in D-08 (`division`, `region`, `roleOrTrade`).
//
//   keys-present-on-attributes:  <fill in: comma-separated list>
//   division-key:                <fill in: actual key name OR "ABSENT">
//   region-key:                  <fill in: actual key name OR "ABSENT">
//   role/trade-key:              <fill in: actual key name OR "ABSENT">
//   status-values-observed:      <fill in: e.g. "active, inactive">
//
// If a field is ABSENT, the Wave 1 mapper assigns `null` to that PrimeUser
// field (per RESEARCH.md "Fallback if the probe shows fields are missing").
// ===========================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// SUT — stub imports; will be implemented in Wave 1 (plan 01-02)
// import {
//   resolveByEmail,
//   getAllPrimeUsers,
//   refreshPrimeUsers,
//   mapRawToPrimeUser,
//   type PrimeUser,
// } from './prime-users';

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

beforeEach(() => {
  vi.resetAllMocks();
});

describe('mapRawToPrimeUser (DIR-01)', () => {
  it.todo('maps a fully-populated raw JSON:API user → PrimeUser with all 9 fields populated');
  it.todo('handles missing optional attributes (division/region/roleOrTrade → null)');
  it.todo('normalises stored email .trim().toLowerCase() (D-09 STORE)');
  it.todo('falls back fullName to "firstName lastName" when fullName is absent');
  it.todo('falls back roleOrTrade to a.role then a.trade when roleOrTrade key absent');
});

describe('refreshPrimeUsers (DIR-01, DIR-04)', () => {
  it.todo('calls primeGetAllPages("/users", 100) and writes mapped users to blob (success path)');
  it.todo('on Prime failure with EXISTING blob, preserves users array and writes lastError/lastErrorAt only (D-17, D-19)');
  it.todo('on Prime failure with NO existing blob, does NOT call setCached (RESEARCH.md Pitfall 1)');
  it.todo('logs "[prime-users] refresh failed:" on error (D-18)');
  it.todo('blob written includes schemaVersion: 1');
});

describe('getAllPrimeUsers (DIR-02, DIR-04)', () => {
  it.todo('on populated fresh cache, returns blob.users WITHOUT calling primeGetAllPages (DIR-02 hot-path)');
  it.todo('on empty cache, triggers refresh once (D-03 first-miss bootstrap)');
  it.todo('on empty cache + Prime unreachable, returns [] without throwing (D-16)');
  it.todo('on cache older than 30 days, triggers refresh (D-04 stale safety net)');
  it.todo('on 30-day-stale cache + Prime failure, returns previous blob.users (D-17)');
});

describe('resolveByEmail (DIR-02, DIR-04)', () => {
  it.todo('returns matching PrimeUser for exact lowercase email');
  it.todo('normalises input email .trim().toLowerCase() before matching (D-09 COMPARE)');
  it.todo('returns null when email is empty/whitespace-only');
  it.todo('returns null when email not in cache');
  it.todo('does NOT call primeGetAllPages on a populated fresh cache');
});
