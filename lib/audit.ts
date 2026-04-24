import { put } from '@vercel/blob';

const AUDIT_BLOB_PATH = 'audit/audit-log.json';
// WR-02: raised from 200 in Phase 2. The ring buffer is now shared with the
// new prime_user_miss writer (app/api/auth/login/route.ts), so a Prime outage
// can quickly evict legitimate login/logout history under the previous cap —
// every miss costs an extra row on top of the existing login row. 500 keeps
// audit blob writes cheap (single Vercel Blob JSON put) while restoring
// effective retention closer to the pre-Phase-2 behaviour. If retention
// pressure persists, split the streams to per-action keys.
const MAX_ENTRIES = 500;

function getAuditBlobUrl(): string {
  const base = process.env.BLOB_BASE_URL || '';
  return `${base}/${AUDIT_BLOB_PATH}`;
}

export interface AuditEntry {
  id: string;
  email: string;
  name?: string;
  action: 'login' | 'logout' | 'prime_user_miss';
  timestamp: string;
  detail?: string;
}

export async function appendAuditLog(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
  try {
    const existing = await readAuditLog();

    const newEntry: AuditEntry = {
      ...entry,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
    };

    const updated = [newEntry, ...existing].slice(0, MAX_ENTRIES);

    await put(AUDIT_BLOB_PATH, JSON.stringify(updated), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    console.warn('[audit] Failed to write audit log:', e);
  }
}

export async function readAuditLog(): Promise<AuditEntry[]> {
  try {
    const url = getAuditBlobUrl();
    if (!url || url === '/audit/audit-log.json') {
      const { list } = await import('@vercel/blob');
      const { blobs } = await list({ prefix: AUDIT_BLOB_PATH, limit: 1 });
      if (!blobs.length) return [];
      const res = await fetch(blobs[0].downloadUrl, {
        headers: process.env.BLOB_READ_WRITE_TOKEN
          ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
          : {},
        cache: 'no-store',
      });
      if (!res.ok) return [];
      return await res.json();
    }

    const res = await fetch(url, {
      headers: process.env.BLOB_READ_WRITE_TOKEN
        ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
        : {},
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
