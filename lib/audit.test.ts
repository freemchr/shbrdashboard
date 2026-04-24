import { describe, it, expect, vi, beforeEach } from 'vitest';

// Module-boundary mocks — never hit real Vercel Blob.
vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  list: vi.fn(),
}));

import { put, list } from '@vercel/blob';
import { appendAuditLog, readAuditLog, type AuditEntry } from './audit';

const mockedPut = vi.mocked(put);
const mockedList = vi.mocked(list);

beforeEach(() => {
  vi.resetAllMocks();
  // Force readAuditLog to take the `list()` branch by leaving BLOB_BASE_URL unset.
  delete process.env.BLOB_BASE_URL;
});

function makeEntry(overrides: Partial<Omit<AuditEntry, 'id' | 'timestamp'>> = {}): Omit<AuditEntry, 'id' | 'timestamp'> {
  return {
    email: 'jane@shbr.com',
    name: 'jane@shbr.com',
    action: 'login',
    ...overrides,
  };
}

describe('AuditEntry type (D-06)', () => {
  it('accepts the prime_user_miss literal with optional detail', () => {
    const e: AuditEntry = {
      id: '1',
      email: 'jane@shbr.com',
      name: 'jane@shbr.com',
      action: 'prime_user_miss',
      timestamp: '2026-04-24T00:00:00.000Z',
      detail: 'cache_empty',
    };
    expect(e.action).toBe('prime_user_miss');
    expect(e.detail).toBe('cache_empty');
  });

  it('accepts the prime_user_miss literal without detail (detail is optional)', () => {
    const e: AuditEntry = {
      id: '2',
      email: 'jane@shbr.com',
      action: 'prime_user_miss',
      timestamp: '2026-04-24T00:00:00.000Z',
    };
    expect(e.action).toBe('prime_user_miss');
    expect(e.detail).toBeUndefined();
  });
});

describe('appendAuditLog round-trip (D-06)', () => {
  it('persists prime_user_miss with detail="cache_hit: no match" and reads it back unchanged', async () => {
    // First call inside appendAuditLog → readAuditLog → list({prefix}) → no blobs (clean state)
    mockedList.mockResolvedValueOnce({ blobs: [] } as never);
    mockedPut.mockResolvedValueOnce({ url: 'https://blob.test/audit/audit-log.json' } as never);

    await appendAuditLog(makeEntry({ action: 'prime_user_miss', detail: 'cache_hit: no match' }));

    expect(mockedPut).toHaveBeenCalledTimes(1);
    const [path, payload] = mockedPut.mock.calls[0];
    expect(path).toBe('audit/audit-log.json');
    const stored = JSON.parse(payload as string) as AuditEntry[];
    expect(stored).toHaveLength(1);
    expect(stored[0].action).toBe('prime_user_miss');
    expect(stored[0].detail).toBe('cache_hit: no match');
    expect(stored[0].email).toBe('jane@shbr.com');
    expect(stored[0].id).toMatch(/^\d+/); // existing id-format invariant
    expect(stored[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('persists prime_user_miss with detail="cache_empty" symmetric to cache_hit', async () => {
    mockedList.mockResolvedValueOnce({ blobs: [] } as never);
    mockedPut.mockResolvedValueOnce({ url: 'https://blob.test/x' } as never);

    await appendAuditLog(makeEntry({ action: 'prime_user_miss', detail: 'cache_empty' }));

    const [, payload] = mockedPut.mock.calls[0];
    const stored = JSON.parse(payload as string) as AuditEntry[];
    expect(stored[0].detail).toBe('cache_empty');
  });

  it('does not throw if blob put fails (silent-fail invariant preserved for new action)', async () => {
    mockedList.mockResolvedValueOnce({ blobs: [] } as never);
    mockedPut.mockRejectedValueOnce(new Error('blob put failed'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      appendAuditLog(makeEntry({ action: 'prime_user_miss', detail: 'cache_empty' }))
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[audit\]/),
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });
});

describe('readAuditLog backward compat (A3)', () => {
  it('deserialises a legacy row (no detail field) without throwing; detail becomes undefined', async () => {
    const legacyRow: AuditEntry = {
      id: 'legacy-1',
      email: 'old@shbr.com',
      action: 'login',
      timestamp: '2026-04-01T00:00:00.000Z',
      // NOTE: no detail field — pre-Phase-2 row
    };
    // Stub the list+fetch path used by readAuditLog when BLOB_BASE_URL is unset.
    mockedList.mockResolvedValueOnce({
      blobs: [{ downloadUrl: 'https://blob.test/audit/audit-log.json' }],
    } as never);
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as never).mockResolvedValueOnce({
      ok: true,
      json: async () => [legacyRow],
    } as never);

    const result = await readAuditLog();
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('login');
    expect(result[0].detail).toBeUndefined();
    fetchSpy.mockRestore();
  });
});
