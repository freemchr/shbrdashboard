import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrimeUser } from '@/lib/prime-users';

// Module-boundary mocks (Pitfall 2 — mock @/lib/session at the import boundary, NOT the underlying request-cookie module).
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/page-visibility', () => ({
  getVisibilityConfig: vi.fn(),
  getHiddenPaths: vi.fn(() => new Set<string>()),
  isAdminEmail: vi.fn(() => false),
}));
vi.mock('@/lib/prime-users', () => ({ resolveByEmail: vi.fn() }));
vi.mock('@/lib/audit', () => ({ appendAuditLog: vi.fn() })); // D-05 guard

import { GET } from './route';
import { getSession } from '@/lib/session';
import { resolveByEmail } from '@/lib/prime-users';
import { getVisibilityConfig, getHiddenPaths, isAdminEmail } from '@/lib/page-visibility';
import { appendAuditLog } from '@/lib/audit';

const mockedGetSession = vi.mocked(getSession);
const mockedResolve = vi.mocked(resolveByEmail);
const mockedConfig = vi.mocked(getVisibilityConfig);
const mockedHidden = vi.mocked(getHiddenPaths);
const mockedIsAdmin = vi.mocked(isAdminEmail);
const mockedAppend = vi.mocked(appendAuditLog);

beforeEach(() => {
  vi.resetAllMocks();
  // Restore default page-visibility behaviours after resetAllMocks.
  mockedHidden.mockReturnValue(new Set<string>());
  mockedIsAdmin.mockReturnValue(false);
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

describe('GET /api/auth/session (SESSION-01, SESSION-03 — D-07)', () => {
  it('returns primeUser from resolveByEmail when session is valid', async () => {
    mockedGetSession.mockResolvedValue(makeSession() as never);
    mockedConfig.mockResolvedValue({ admins: [], groups: [], pages: [] } as never);
    mockedResolve.mockResolvedValue(makePrimeUser({ fullName: 'Jane Doe' }));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.primeUser).toEqual(expect.objectContaining({ fullName: 'Jane Doe' }));
  });

  it('calls resolveByEmail with the session userEmail (D-01 live-read)', async () => {
    mockedGetSession.mockResolvedValue(makeSession({ userEmail: 'jane@shbr.com' }) as never);
    mockedConfig.mockResolvedValue({ admins: [], groups: [], pages: [] } as never);
    mockedResolve.mockResolvedValue(null);

    await GET();
    expect(mockedResolve).toHaveBeenCalledTimes(1);
    expect(mockedResolve).toHaveBeenCalledWith('jane@shbr.com');
  });

  it('returns primeUser: null (not undefined / not missing) when resolveByEmail returns null', async () => {
    mockedGetSession.mockResolvedValue(makeSession({ userEmail: 'nobody@example.com' }) as never);
    mockedConfig.mockResolvedValue({ admins: [], groups: [], pages: [] } as never);
    mockedResolve.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(body).toHaveProperty('primeUser');
    expect(body.primeUser).toBeNull();
  });

  it('preserves the existing response shape (userName, userEmail, expiresAt, isAdmin, hiddenPaths)', async () => {
    const session = makeSession();
    mockedGetSession.mockResolvedValue(session as never);
    mockedConfig.mockResolvedValue({ admins: [], groups: [], pages: [] } as never);
    mockedHidden.mockReturnValue(new Set(['/secret']));
    mockedIsAdmin.mockReturnValue(true);
    mockedResolve.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(body.userName).toBe(session.userName);
    expect(body.userEmail).toBe(session.userEmail);
    expect(body.expiresAt).toBe(session.expiresAt);
    expect(body.isAdmin).toBe(true);
    expect(body.hiddenPaths).toEqual(['/secret']);
  });
});

describe('GET /api/auth/session (D-05 — does NOT write audit on miss)', () => {
  it('does NOT call appendAuditLog even when primeUser is null', async () => {
    mockedGetSession.mockResolvedValue(makeSession({ userEmail: 'ghost@shbr.com' }) as never);
    mockedConfig.mockResolvedValue({ admins: [], groups: [], pages: [] } as never);
    mockedResolve.mockResolvedValue(null);

    await GET();
    expect(mockedAppend).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/session (auth-cascade invariants — D-20)', () => {
  it('returns 401 and does NOT call resolveByEmail when accessToken is missing', async () => {
    mockedGetSession.mockResolvedValue(makeSession({ accessToken: '' }) as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Not authenticated');
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('returns 401 and does NOT call resolveByEmail when session is expired', async () => {
    const session = makeSession({ expiresAt: Date.now() - 1000 });
    mockedGetSession.mockResolvedValue(session as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Session expired');
    expect(mockedResolve).not.toHaveBeenCalled();
    expect(session.destroy).toHaveBeenCalled();
  });
});

describe('GET /api/auth/session (D-17 [session] log prefix)', () => {
  it('logs errors with [session] prefix when getSession throws', async () => {
    mockedGetSession.mockRejectedValue(new Error('boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET();
    expect(res.status).toBe(401);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[session\]/),
      expect.any(Error)
    );
    errSpy.mockRestore();
  });
});
