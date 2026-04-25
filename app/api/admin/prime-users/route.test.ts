import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrimeUser } from '@/lib/prime-users';

// Module-boundary mocks (Pitfall 2 — mock at the @/ alias, not the underlying cookie/blob modules).
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/page-visibility', () => ({
  getVisibilityConfig: vi.fn(),
  isAdminEmail: vi.fn(() => false),
}));
vi.mock('@/lib/prime-users', () => ({
  getAllPrimeUsers: vi.fn(),
  getDirectoryMetadata: vi.fn(),
}));

import { GET } from './route';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';
import { getAllPrimeUsers, getDirectoryMetadata } from '@/lib/prime-users';

const mockedGetSession = vi.mocked(getSession);
const mockedConfig = vi.mocked(getVisibilityConfig);
const mockedIsAdmin = vi.mocked(isAdminEmail);
const mockedGetAll = vi.mocked(getAllPrimeUsers);
const mockedMeta = vi.mocked(getDirectoryMetadata);

beforeEach(() => {
  vi.resetAllMocks();
  mockedIsAdmin.mockReturnValue(false);    // restored baseline after resetAllMocks
});

function makeSession(overrides: Partial<{
  accessToken: string;
  refreshToken: string;
  userEmail: string;
  userName: string;
  expiresAt: number;
}> = {}) {
  return {
    accessToken: 'tok-x',
    refreshToken: 'r-x',
    userEmail: 'jane@shbr.com',
    userName: 'jane@shbr.com',
    expiresAt: Date.now() + 3600_000,
    save: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };
}

function makePrimeUser(overrides: Partial<PrimeUser> = {}): PrimeUser {
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

describe('GET /api/admin/prime-users (Phase 3 D-11)', () => {
  it('returns 401 when no userEmail on session and short-circuits before Gate 2', async () => {
    mockedGetSession.mockResolvedValue(makeSession({ userEmail: '' }) as never);

    const res = await GET();
    expect(res.status).toBe(401);

    expect(mockedConfig).not.toHaveBeenCalled();
    expect(mockedIsAdmin).not.toHaveBeenCalled();
    expect(mockedGetAll).not.toHaveBeenCalled();
    expect(mockedMeta).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when user is authenticated but not admin, and does not read directory', async () => {
    mockedGetSession.mockResolvedValue(makeSession() as never);
    mockedConfig.mockResolvedValue({ admins: [], groups: [], pages: [] } as never);
    mockedIsAdmin.mockReturnValue(false);

    const res = await GET();
    expect(res.status).toBe(403);

    expect(mockedGetAll).not.toHaveBeenCalled();
    expect(mockedMeta).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 200 with users + metadata + Cache-Control:no-store when admin', async () => {
    mockedGetSession.mockResolvedValue(makeSession() as never);
    mockedConfig.mockResolvedValue({ admins: ['jane@shbr.com'], groups: [], pages: [] } as never);
    mockedIsAdmin.mockReturnValue(true);
    mockedGetAll.mockResolvedValue([makePrimeUser({ email: 'jane@shbr.com', fullName: 'Jane Doe' })]);
    mockedMeta.mockResolvedValue({ lastSuccessAt: '2026-04-25T00:00:00.000Z', lastError: null });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0]).toEqual(expect.objectContaining({ email: 'jane@shbr.com', fullName: 'Jane Doe' }));
    expect(body.lastSuccessAt).toBe('2026-04-25T00:00:00.000Z');
    expect(body.lastError).toBeNull();
  });

  it('returns 200 with empty users array + surfaced lastError when Prime is unreachable (graceful degrade)', async () => {
    mockedGetSession.mockResolvedValue(makeSession() as never);
    mockedConfig.mockResolvedValue({ admins: ['jane@shbr.com'], groups: [], pages: [] } as never);
    mockedIsAdmin.mockReturnValue(true);
    mockedGetAll.mockResolvedValue([]);                  // Phase 1 D-16: empty array, not throw
    mockedMeta.mockResolvedValue({ lastSuccessAt: null, lastError: 'Prime timeout' });

    const res = await GET();
    expect(res.status).toBe(200);                         // graceful-empty, not 5xx

    const body = await res.json();
    expect(body.users).toEqual([]);
    expect(body.lastSuccessAt).toBeNull();
    expect(body.lastError).toBe('Prime timeout');
  });

  it('returns 500 with [admin-prime-users] log and empty body when getAllPrimeUsers unexpectedly throws', async () => {
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockedGetSession.mockResolvedValue(makeSession() as never);
    mockedConfig.mockResolvedValue({ admins: ['jane@shbr.com'], groups: [], pages: [] } as never);
    mockedIsAdmin.mockReturnValue(true);
    mockedGetAll.mockRejectedValue(new Error('disk full'));
    mockedMeta.mockResolvedValue({ lastSuccessAt: null, lastError: null });

    const res = await GET();
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.users).toEqual([]);
    expect(body.lastSuccessAt).toBeNull();
    expect(body.lastError).toBe('Internal error');

    expect(consoleErrSpy).toHaveBeenCalledWith('[admin-prime-users]', expect.any(Error));
    consoleErrSpy.mockRestore();
  });
});
