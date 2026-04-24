import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { PrimeUser } from '@/lib/prime-users';

// Module-boundary mocks.
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/audit', () => ({ appendAuditLog: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, resetAt: 0 })),
}));
vi.mock('@/lib/prime-users', () => ({
  getAllPrimeUsers: vi.fn(),
}));

import { POST } from './route';
import { getSession } from '@/lib/session';
import { appendAuditLog } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { getAllPrimeUsers } from '@/lib/prime-users';

const mockedGetSession = vi.mocked(getSession);
const mockedAppend = vi.mocked(appendAuditLog);
const mockedRateLimit = vi.mocked(checkRateLimit);
const mockedGetAll = vi.mocked(getAllPrimeUsers);

beforeEach(() => {
  vi.resetAllMocks();
  mockedRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: 0 });
  process.env.PRIME_BASE_URL = 'https://prime.test';
  process.env.PRIME_CLIENT_ID = 'cid';
  process.env.PRIME_CLIENT_SECRET = 'csec';
  // default session shim
  mockedGetSession.mockResolvedValue({
    accessToken: '',
    refreshToken: '',
    expiresAt: 0,
    userName: '',
    userEmail: '',
    save: vi.fn(),
    destroy: vi.fn(),
  } as never);
});

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

function makeOAuthOk(
  overrides: Partial<{ access_token: string; refresh_token: string; expires_in: number }> = {}
) {
  return {
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({
      access_token: 'tok-x',
      refresh_token: 'r-x',
      expires_in: 28800,
      ...overrides,
    }),
  } as Response;
}

function makeOAuthFail(status = 401) {
  return {
    ok: false,
    status,
    text: async () => 'invalid_grant',
    json: async () => ({}),
  } as Response;
}

function makeReq(body: unknown = { email: 'Jane@SHBR.com', password: 'pw' }) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login (SESSION-02, D-04, D-06)', () => {
  it('writes ONE "login" audit and ZERO "prime_user_miss" audits when Prime resolves', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValueOnce(makeOAuthOk() as never);
    mockedGetAll.mockResolvedValue([makePrimeUser()]);

    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const actions = mockedAppend.mock.calls.map(c => (c[0] as { action: string }).action);
    expect(actions.filter(a => a === 'login')).toHaveLength(1);
    expect(actions.filter(a => a === 'prime_user_miss')).toHaveLength(0);
  });

  it('writes prime_user_miss with detail="cache_empty" when directory is empty', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValueOnce(makeOAuthOk() as never);
    mockedGetAll.mockResolvedValue([]);

    await POST(makeReq({ email: 'ghost@shbr.com', password: 'pw' }));

    expect(mockedAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'prime_user_miss',
        detail: 'cache_empty',
        email: 'ghost@shbr.com',
      })
    );
  });

  it('writes prime_user_miss with detail="cache_hit: no match" when directory populated but user absent', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValueOnce(makeOAuthOk() as never);
    mockedGetAll.mockResolvedValue([
      makePrimeUser({ id: 'u-other', email: 'someone-else@shbr.com' }),
    ]);

    await POST(makeReq({ email: 'ghost@shbr.com', password: 'pw' }));

    expect(mockedAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'prime_user_miss',
        detail: 'cache_hit: no match',
        email: 'ghost@shbr.com',
      })
    );
  });

  it('does NOT call getAllPrimeUsers or write prime_user_miss on OAuth failure (D-04 / Pitfall 6)', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValueOnce(makeOAuthFail() as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(mockedGetAll).not.toHaveBeenCalled();
    expect(mockedAppend).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'prime_user_miss' })
    );
    errSpy.mockRestore();
  });

  it('looks up the directory exactly ONCE per login on the miss path (WR-01: no doubled getAllPrimeUsers calls)', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValueOnce(makeOAuthOk() as never);
    mockedGetAll.mockResolvedValue([]); // forces the miss + cache_empty branch

    await POST(makeReq({ email: '  Jane@SHBR.com  ', password: 'pw' }));

    // Pre-WR-01 this path called getAllPrimeUsers twice (once via resolveByEmail,
    // once for cache_empty detection). Single-fetch guarantee protects the daily
    // 5,000-req Prime budget on cold-cache + Prime-down login storms.
    expect(mockedGetAll).toHaveBeenCalledTimes(1);
  });

  it('matches Prime users using the lowercased+trimmed email (normalisation invariant)', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValueOnce(makeOAuthOk() as never);
    // Directory holds the canonical lowercase form; the route must match against it
    // using the normalised email derived from the (mixed-case + padded) login input.
    mockedGetAll.mockResolvedValue([makePrimeUser({ email: 'jane@shbr.com' })]);

    const res = await POST(makeReq({ email: '  Jane@SHBR.com  ', password: 'pw' }));
    expect(res.status).toBe(200);

    // No prime_user_miss → confirms the find() compared against the normalised email.
    expect(mockedAppend).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'prime_user_miss' })
    );
  });

  it('login response shape stays {success: true, userName} — primeUser NOT in response (D-04)', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValueOnce(makeOAuthOk() as never);
    mockedGetAll.mockResolvedValue([makePrimeUser({ fullName: 'Jane Doe' })]);

    const res = await POST(makeReq());
    const body = await res.json();

    expect(body).toEqual({ success: true, userName: 'jane@shbr.com' });
    expect(body).not.toHaveProperty('primeUser');
  });

  it('login still writes the "login" audit exactly once even on miss (existing audit invariant)', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValueOnce(makeOAuthOk() as never);
    mockedGetAll.mockResolvedValue([]);

    await POST(makeReq({ email: 'ghost@shbr.com', password: 'pw' }));
    const loginAudits = mockedAppend.mock.calls.filter(
      c => (c[0] as { action: string }).action === 'login'
    );
    expect(loginAudits).toHaveLength(1);
  });

  it('rate-limit 429 short-circuits — getAllPrimeUsers NEVER called', async () => {
    mockedRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    expect(mockedGetAll).not.toHaveBeenCalled();
  });
});
