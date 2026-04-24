// === PROBE FINDINGS (Wave 0, Task 0.4) =====================================
// 5 Prime /users records (per_page=5) inspected on 2026-04-24 against the live
// SHBR tenant at https://www.primeeco.tech/api.prime/v2. Wave 1's
// `mapRawToPrimeUser()` MUST be written against THESE keys, not the speculative
// names in D-08 (`division`, `region`, `roleOrTrade`).
//
//   keys-present-on-attributes:  contactId, email, firstName, fullName,
//                                lastName, levesysRef, permissions, roles,
//                                status, timezone, version
//                                (identical union across all 5 records)
//   relationships-block:         ABSENT on every record (no `relationships` key)
//   division-key:                ABSENT
//   region-key:                  ABSENT
//   role/trade-key:              ABSENT as a scalar; Prime exposes `roles`
//                                (string[]) — observed values: ["Administrator"],
//                                ["Management"], [] (empty for ordinary users)
//   status-values-observed:      active, inactive
//
// Wave 1 consequence (per RESEARCH.md "Fallback if the probe shows fields are
// missing"): `division` and `region` → always `null`. `roleOrTrade` → first
// element of `attributes.roles` when non-empty, else `null` (the mapper treats
// the array as an ordered list and uses `[0]`). D-08 PrimeUser shape is
// preserved; the ABSENT fields simply never receive data from Prime.
// ===========================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// SUT imports — wired up in Wave 1 now that lib/prime-users.ts exists.
import {
  resolveByEmail,
  getAllPrimeUsers,
  refreshPrimeUsers,
  mapRawToPrimeUser,
  type PrimeUser,
  type PrimeUserDirectoryBlob,
} from './prime-users';

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

// Helpers to reduce per-test boilerplate.
function makeUser(overrides: Partial<PrimeUser> = {}): PrimeUser {
  return {
    id: 'u1',
    email: 'jane@shbr.com',
    fullName: 'Jane Doe',
    firstName: 'Jane',
    lastName: 'Doe',
    division: null,
    region: null,
    roleOrTrade: null,
    status: 'active',
    ...overrides,
  };
}

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

describe('mapRawToPrimeUser (DIR-01)', () => {
  it('maps a fully-populated raw JSON:API user → PrimeUser with all 9 fields populated', () => {
    const raw = {
      id: 'u1',
      type: 'users',
      attributes: {
        fullName: 'Jane Doe',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@shbr.com',
        division: 'Estimators',
        region: 'NSW',
        roleOrTrade: 'Senior Estimator',
        status: 'active',
      },
    };
    expect(mapRawToPrimeUser(raw)).toEqual({
      id: 'u1',
      email: 'jane@shbr.com',
      fullName: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      division: 'Estimators',
      region: 'NSW',
      roleOrTrade: 'Senior Estimator',
      status: 'active',
    });
  });

  it('handles missing optional attributes (division/region/roleOrTrade → null)', () => {
    const raw = {
      id: 'u2',
      attributes: {
        email: 'bob@shbr.com',
        firstName: 'Bob',
        lastName: 'Smith',
        status: 'active',
      },
    };
    const user = mapRawToPrimeUser(raw);
    expect(user.division).toBeNull();
    expect(user.region).toBeNull();
    expect(user.roleOrTrade).toBeNull();
    expect(user.status).toBe('active');
  });

  it('normalises stored email .trim().toLowerCase() (D-09 STORE)', () => {
    const raw = {
      id: 'u3',
      attributes: {
        email: '  Jane.Doe@SHBR.COM  ',
        firstName: 'Jane',
        lastName: 'Doe',
        status: 'active',
      },
    };
    expect(mapRawToPrimeUser(raw).email).toBe('jane.doe@shbr.com');
  });

  it('falls back fullName to "firstName lastName" when fullName is absent', () => {
    const raw = {
      id: 'u4',
      attributes: {
        email: 'jane@shbr.com',
        firstName: 'Jane',
        lastName: 'Doe',
        status: 'active',
      },
    };
    expect(mapRawToPrimeUser(raw).fullName).toBe('Jane Doe');
  });

  it('falls back roleOrTrade to a.role then a.trade when roleOrTrade key absent', () => {
    // No roleOrTrade, no roles[], but has `role` scalar (safety-belt path).
    const rawWithRole = {
      id: 'u5',
      attributes: {
        email: 'a@shbr.com',
        firstName: 'A',
        lastName: 'B',
        role: 'Estimator',
        status: 'active',
      },
    };
    expect(mapRawToPrimeUser(rawWithRole).roleOrTrade).toBe('Estimator');

    // Neither roleOrTrade/roles/role — falls through to `trade`.
    const rawWithTrade = {
      id: 'u6',
      attributes: {
        email: 'c@shbr.com',
        firstName: 'C',
        lastName: 'D',
        trade: 'Plumbing',
        status: 'active',
      },
    };
    expect(mapRawToPrimeUser(rawWithTrade).roleOrTrade).toBe('Plumbing');

    // Probe-confirmed primary path: `roles: string[]` wins over role/trade.
    const rawWithRoles = {
      id: 'u7',
      attributes: {
        email: 'e@shbr.com',
        firstName: 'E',
        lastName: 'F',
        roles: ['Administrator'],
        role: 'IGNORED',
        trade: 'IGNORED',
        status: 'active',
      },
    };
    expect(mapRawToPrimeUser(rawWithRoles).roleOrTrade).toBe('Administrator');

    // Empty roles[] falls through to scalar fallbacks (probe observed []).
    const rawWithEmptyRoles = {
      id: 'u8',
      attributes: {
        email: 'g@shbr.com',
        firstName: 'G',
        lastName: 'H',
        roles: [],
        status: 'active',
      },
    };
    expect(mapRawToPrimeUser(rawWithEmptyRoles).roleOrTrade).toBeNull();
  });
});

describe('refreshPrimeUsers (DIR-01, DIR-04)', () => {
  it('calls primeGetAllPages("/users", 100) and writes mapped users to blob (success path)', async () => {
    mockedGetCached.mockResolvedValueOnce(null);
    mockedPrimeGetAllPages.mockResolvedValueOnce([
      {
        id: 'u1',
        attributes: {
          email: 'jane@shbr.com',
          firstName: 'Jane',
          lastName: 'Doe',
          fullName: 'Jane Doe',
          status: 'active',
        },
      },
    ]);

    const result = await refreshPrimeUsers({ reason: 'admin' });

    expect(mockedPrimeGetAllPages).toHaveBeenCalledWith('/users', 100);
    expect(mockedPrimeGetAllPages).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.blob.users).toHaveLength(1);
    expect(result.blob.users[0].email).toBe('jane@shbr.com');
    expect(result.blob.lastError).toBeNull();
    expect(result.blob.lastErrorAt).toBeNull();
    expect(result.blob.schemaVersion).toBe(1);

    // setCached called with BLOB_KEY, the blob, and INDEFINITE_TTL_MS.
    expect(mockedSetCached).toHaveBeenCalledTimes(1);
    const [key, data, ttl] = mockedSetCached.mock.calls[0];
    expect(key).toBe('shbr-admin/prime-users.json');
    expect(data).toMatchObject({ schemaVersion: 1, users: expect.any(Array) });
    // 50-year TTL
    expect(ttl).toBe(50 * 365 * 24 * 60 * 60 * 1000);
  });

  it('on Prime failure with EXISTING blob, preserves users array and writes lastError/lastErrorAt only (D-17, D-19)', async () => {
    const existingUsers = [
      makeUser({ id: 'a' }),
      makeUser({ id: 'b', email: 'b@shbr.com' }),
      makeUser({ id: 'c', email: 'c@shbr.com' }),
    ];
    const existingSuccessAt = '2026-04-01T00:00:00.000Z';
    mockedGetCached.mockResolvedValueOnce(
      makeBlob({ users: existingUsers, lastSuccessAt: existingSuccessAt })
    );
    mockedPrimeGetAllPages.mockRejectedValueOnce(new Error('Prime down'));

    const result = await refreshPrimeUsers({ reason: 'admin' });

    expect(result.ok).toBe(false);
    expect(result.blob.users).toHaveLength(3);
    expect(result.blob.users[0].id).toBe('a');
    expect(result.blob.lastError).toBe('Prime down');
    expect(typeof result.blob.lastErrorAt).toBe('string');
    expect(result.blob.lastErrorAt).not.toBeNull();
    expect(result.blob.lastSuccessAt).toBe(existingSuccessAt);

    // setCached IS called — to persist the error metadata alongside preserved users.
    expect(mockedSetCached).toHaveBeenCalledTimes(1);
    const persisted = mockedSetCached.mock.calls[0][1] as PrimeUserDirectoryBlob;
    expect(persisted.users).toHaveLength(3);
    expect(persisted.lastError).toBe('Prime down');
    expect(persisted.lastSuccessAt).toBe(existingSuccessAt);
  });

  it('on Prime failure with NO existing blob, does NOT call setCached (RESEARCH.md Pitfall 1)', async () => {
    mockedGetCached.mockResolvedValueOnce(null);
    mockedPrimeGetAllPages.mockRejectedValueOnce(new Error('Prime unreachable'));

    const result = await refreshPrimeUsers({ reason: 'first-miss' });

    expect(result.ok).toBe(false);
    expect(result.blob.users).toEqual([]);
    expect(mockedSetCached).not.toHaveBeenCalled();
  });

  it('logs "[prime-users] refresh failed:" on error (D-18)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedGetCached.mockResolvedValueOnce(null);
    mockedPrimeGetAllPages.mockRejectedValueOnce(new Error('boom'));

    await refreshPrimeUsers({ reason: 'admin' });

    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[prime-users\] refresh failed:/),
      expect.anything()
    );
    spy.mockRestore();
  });

  it('blob written includes schemaVersion: 1', async () => {
    mockedGetCached.mockResolvedValueOnce(null);
    mockedPrimeGetAllPages.mockResolvedValueOnce([]);

    const result = await refreshPrimeUsers({ reason: 'admin' });

    expect(result.blob.schemaVersion).toBe(1);
    const persisted = mockedSetCached.mock.calls[0][1] as PrimeUserDirectoryBlob;
    expect(persisted.schemaVersion).toBe(1);
  });
});

describe('getAllPrimeUsers (DIR-02, DIR-04)', () => {
  it('on populated fresh cache, returns blob.users WITHOUT calling primeGetAllPages (DIR-02 hot-path)', async () => {
    const freshUsers = [makeUser({ id: 'x' }), makeUser({ id: 'y', email: 'y@shbr.com' })];
    mockedGetCached.mockResolvedValueOnce(
      makeBlob({
        users: freshUsers,
        lastSuccessAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day old
      })
    );

    const users = await getAllPrimeUsers();

    expect(users).toEqual(freshUsers);
    expect(mockedPrimeGetAllPages).not.toHaveBeenCalled();
    expect(mockedSetCached).not.toHaveBeenCalled();
  });

  it('on empty cache, triggers refresh once (D-03 first-miss bootstrap)', async () => {
    mockedGetCached.mockResolvedValueOnce(null);
    mockedPrimeGetAllPages.mockResolvedValueOnce([]);

    const users = await getAllPrimeUsers();

    expect(mockedPrimeGetAllPages).toHaveBeenCalledTimes(1);
    expect(mockedPrimeGetAllPages).toHaveBeenCalledWith('/users', 100);
    expect(users).toEqual([]);
  });

  it('on empty cache + Prime unreachable, returns [] without throwing (D-16)', async () => {
    mockedGetCached.mockResolvedValueOnce(null);
    mockedPrimeGetAllPages.mockRejectedValueOnce(new Error('Prime down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const users = await getAllPrimeUsers();

    expect(users).toEqual([]);
    expect(mockedSetCached).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('on cache older than 30 days, triggers refresh (D-04 stale safety net)', async () => {
    const staleAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const oldUser = makeUser({ id: 'old', email: 'old@shbr.com' });
    mockedGetCached.mockResolvedValueOnce(
      makeBlob({ users: [oldUser], lastSuccessAt: staleAt })
    );
    mockedPrimeGetAllPages.mockResolvedValueOnce([
      {
        id: 'fresh',
        attributes: {
          email: 'fresh@shbr.com',
          firstName: 'Fresh',
          lastName: 'User',
          status: 'active',
        },
      },
    ]);

    const users = await getAllPrimeUsers();

    expect(mockedPrimeGetAllPages).toHaveBeenCalledTimes(1);
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('fresh');
    expect(users[0].email).toBe('fresh@shbr.com');
  });

  it('on 30-day-stale cache + Prime failure, returns previous blob.users (D-17)', async () => {
    const staleAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const oldUser = makeUser({ id: 'old', email: 'old@shbr.com' });
    mockedGetCached.mockResolvedValueOnce(
      makeBlob({ users: [oldUser], lastSuccessAt: staleAt })
    );
    mockedPrimeGetAllPages.mockRejectedValueOnce(new Error('rate-limited'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const users = await getAllPrimeUsers();

    expect(users).toEqual([oldUser]);
    spy.mockRestore();
  });
});

describe('resolveByEmail (DIR-02, DIR-04)', () => {
  it('returns matching PrimeUser for exact lowercase email', async () => {
    const jane = makeUser({ email: 'jane@shbr.com' });
    mockedGetCached.mockResolvedValueOnce(
      makeBlob({ users: [jane] })
    );

    const found = await resolveByEmail('jane@shbr.com');

    expect(found).not.toBeNull();
    expect(found?.email).toBe('jane@shbr.com');
  });

  it('normalises input email .trim().toLowerCase() before matching (D-09 COMPARE)', async () => {
    const jane = makeUser({ email: 'jane@shbr.com' });
    mockedGetCached.mockResolvedValueOnce(
      makeBlob({ users: [jane] })
    );

    const found = await resolveByEmail('  JANE@SHBR.COM  ');

    expect(found).not.toBeNull();
    expect(found?.email).toBe('jane@shbr.com');
  });

  it('returns null when email is empty/whitespace-only', async () => {
    const emptyResult = await resolveByEmail('');
    const wsResult = await resolveByEmail('   ');

    expect(emptyResult).toBeNull();
    expect(wsResult).toBeNull();
    // Early-return: no cache read on empty input (proxy for "no Prime hot-path").
    expect(mockedGetCached).not.toHaveBeenCalled();
    expect(mockedPrimeGetAllPages).not.toHaveBeenCalled();
  });

  it('returns null when email not in cache', async () => {
    const alice = makeUser({ id: 'a', email: 'alice@shbr.com' });
    mockedGetCached.mockResolvedValueOnce(
      makeBlob({ users: [alice] })
    );

    const found = await resolveByEmail('bob@shbr.com');

    expect(found).toBeNull();
  });

  it('does NOT call primeGetAllPages on a populated fresh cache', async () => {
    const jane = makeUser({ email: 'jane@shbr.com' });
    mockedGetCached.mockResolvedValueOnce(
      makeBlob({
        users: [jane],
        lastSuccessAt: new Date(Date.now() - 60 * 1000).toISOString(), // 1 min old
      })
    );

    await resolveByEmail('jane@shbr.com');

    expect(mockedPrimeGetAllPages).not.toHaveBeenCalled();
    // Equivalent assertion with lower-cased reference for DIR-02 hot-path grep-audit.
    expect(vi.mocked(primeGetAllPages)).not.toHaveBeenCalled();
  });
});
