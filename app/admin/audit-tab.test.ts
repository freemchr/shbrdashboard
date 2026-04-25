import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuditEntry } from '@/lib/audit';
import type { PrimeUser } from '@/lib/prime-users';

// Mock the CSV helper so we can inspect the call without touching browser-only
// APIs (Blob, URL.createObjectURL, document.createElement) that aren't
// available under vitest's `node` environment.
vi.mock('@/lib/export-csv', () => ({ downloadCSV: vi.fn() }));

import { exportAuditCSV } from './audit-tab';
import { downloadCSV } from '@/lib/export-csv';

const mockedDownload = vi.mocked(downloadCSV);

beforeEach(() => { vi.resetAllMocks(); });

function pu(overrides: Partial<PrimeUser> = {}): PrimeUser {
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

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'e1',
    email: 'jane@shbr.com',
    name: undefined,
    action: 'login',
    timestamp: '2026-04-25T03:00:00.000Z',
    detail: undefined,
    ...overrides,
  };
}

describe('exportAuditCSV (D-15 cascade + D-17 column rename)', () => {
  it('uses the renamed Display Name header in third column', () => {
    exportAuditCSV([], []);
    const call = mockedDownload.mock.calls[0];
    const headers = call[1];
    expect(headers).toEqual(['Timestamp (AEDT)', 'Email', 'Display Name', 'Action']);
  });

  it('Layer 1 — entry email matches Prime user → uses live fullName', () => {
    const e = entry({ email: 'jane@shbr.com', name: 'IGNORED Snapshot' });
    const users = [pu({ email: 'jane@shbr.com', fullName: '  Jane Doe  ' })];
    exportAuditCSV([e], users);
    const rows = mockedDownload.mock.calls[0][2];
    expect(rows[0][2]).toBe('Jane Doe');
  });

  it('Layer 2 — email not in Prime but entry.name set → uses entry.name', () => {
    const e = entry({ email: 'ghost@shbr.com', name: '  Ghost Snapshot  ' });
    exportAuditCSV([e], []);
    const rows = mockedDownload.mock.calls[0][2];
    expect(rows[0][2]).toBe('Ghost Snapshot');
  });

  it('Layer 3 — email not in Prime + entry.name undefined → returns bare email', () => {
    const e = entry({ email: 'orphan@shbr.com', name: undefined });
    exportAuditCSV([e], []);
    const rows = mockedDownload.mock.calls[0][2];
    expect(rows[0][2]).toBe('orphan@shbr.com');
  });

  it('preserves the action string verbatim (login / logout / prime_user_miss)', () => {
    const entries: AuditEntry[] = [
      entry({ id: 'a', action: 'login' }),
      entry({ id: 'b', action: 'logout' }),
      entry({ id: 'c', action: 'prime_user_miss' }),
    ];
    exportAuditCSV(entries, []);
    const rows = mockedDownload.mock.calls[0][2];
    expect(rows.map(r => r[3])).toEqual(['login', 'logout', 'prime_user_miss']);
  });

  it('emits filename of shape audit-log-YYYY-MM-DD.csv', () => {
    exportAuditCSV([], []);
    const filename = mockedDownload.mock.calls[0][0];
    expect(filename).toMatch(/^audit-log-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('renders timestamp column via formatAEDT (Sydney timezone, 24h)', () => {
    // 2026-04-25 03:00 UTC = 2026-04-25 13:00 AEST (Sydney is +10 in late
    // April — DST has already ended). en-AU locale prefixes the day, so we
    // assert on the date portion only to stay locale-detail tolerant across
    // CI Node builds.
    const e = entry({ timestamp: '2026-04-25T03:00:00.000Z' });
    exportAuditCSV([e], []);
    const rows = mockedDownload.mock.calls[0][2];
    expect(rows[0][0]).toMatch(/^25\/04\/2026/);
  });
});
