import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrimeUser, PrimeUserDirectoryBlob } from '@/lib/prime-users';

// Module-boundary mocks (PATTERNS Pattern: mock at the import boundary, NOT the underlying module).
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/page-visibility', () => ({
  getVisibilityConfig: vi.fn(),
  isAdminEmail: vi.fn(() => false),
}));
vi.mock('@/lib/blob-cache', () => ({
  getCached: vi.fn(),
}));

import { GET } from './route';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';
import { getCached } from '@/lib/blob-cache';

const mockedGetSession = vi.mocked(getSession);
const mockedConfig = vi.mocked(getVisibilityConfig);
const mockedIsAdmin = vi.mocked(isAdminEmail);
const mockedGetCached = vi.mocked(getCached);

function makeSession(overrides: Partial<{
  accessToken: string; refreshToken: string; userEmail: string; userName: string; expiresAt: number;
}> = {}) {
  return {
    accessToken: 'tok-x',
    refreshToken: 'r-x',
    userEmail: 'admin@shbr.com',
    userName: 'Admin',
    expiresAt: Date.now() + 3600_000,
    save: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };
}

function makeUser(overrides: Partial<PrimeUser> = {}): PrimeUser {
  return {
    id: 'u1', email: 'jane@shbr.com', fullName: 'Jane Doe',
    firstName: 'Jane', lastName: 'Doe',
    division: null, region: null, roleOrTrade: null,
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

beforeEach(() => {
  vi.resetAllMocks();
  // Re-set non-default mock returns wiped by resetAllMocks (PATTERNS module-boundary mocking convention).
  mockedIsAdmin.mockReturnValue(false);
});

describe('GET /api/admin/prime-users (D-15 — auth gating, Gate 1: session)', () => {
  it('returns 401 when session has no userEmail', async () => {
    mockedGetSession.mockResolvedValue(makeSession({ userEmail: '' }) as never);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    // Pitfall 5 negative: must NOT have called getCached (auth fails first)
    expect(mockedGetCached).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/prime-users (D-15 — auth gating, Gate 2: admin)', () => {
  it('returns 403 when session is valid but isAdminEmail returns false', async () => {
    mockedGetSession.mockResolvedValue(makeSession() as never);
    mockedConfig.mockResolvedValue({ admins: [], groups: [], pages: [] } as never);
    mockedIsAdmin.mockReturnValue(false);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
    expect(mockedGetCached).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/prime-users (D-15 — response shape)', () => {
  it('returns 200 + { users, lastSuccessAt, lastError } from a populated blob', async () => {
    mockedGetSession.mockResolvedValue(makeSession() as never);
    mockedConfig.mockResolvedValue({ admins: ['admin@shbr.com'], groups: [], pages: [] } as never);
    mockedIsAdmin.mockReturnValue(true);
    const blob = makeBlob({
      users: [makeUser({ email: 'a@x.com', fullName: 'Alice' })],
      lastSuccessAt: '2026-04-24T00:00:00.000Z',
      lastError: null,
    });
    mockedGetCached.mockResolvedValue(blob as never);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.users).toHaveLength(1);
    expect(body.users[0].email).toBe('a@x.com');
    expect(body.lastSuccessAt).toBe('2026-04-24T00:00:00.000Z');
    expect(body.lastError).toBeNull();
  });
});

describe('GET /api/admin/prime-users (D-20 — cache empty)', () => {
  it('returns 200 + { users: [], lastSuccessAt: null, lastError: null } when getCached returns null', async () => {
    mockedGetSession.mockResolvedValue(makeSession() as never);
    mockedConfig.mockResolvedValue({ admins: ['admin@shbr.com'], groups: [], pages: [] } as never);
    mockedIsAdmin.mockReturnValue(true);
    mockedGetCached.mockResolvedValue(null);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.users).toEqual([]);
    expect(body.lastSuccessAt).toBeNull();
    expect(body.lastError).toBeNull();
  });
});

describe('GET /api/admin/prime-users (Pitfall 5 — endpoint must NOT call Prime)', () => {
  it('reads via getCached only (does not import or call getAllPrimeUsers)', async () => {
    mockedGetSession.mockResolvedValue(makeSession() as never);
    mockedConfig.mockResolvedValue({ admins: ['admin@shbr.com'], groups: [], pages: [] } as never);
    mockedIsAdmin.mockReturnValue(true);
    mockedGetCached.mockResolvedValue(makeBlob() as never);
    await GET();
    // The blob key namespace is locked to 'shbr-admin/' per Phase 1 D-05
    expect(mockedGetCached).toHaveBeenCalledTimes(1);
    const callArg = mockedGetCached.mock.calls[0][0];
    expect(callArg).toMatch(/^shbr-admin\//);
    expect(callArg).toMatch(/prime-users\.json$/);
  });
});
