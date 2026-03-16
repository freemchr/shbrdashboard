import { put, list } from '@vercel/blob';

const AUDIT_BLOB_PATH = 'audit/audit-log.json';
const MAX_ENTRIES = 1000;

export interface AuditEntry {
  id: string;
  email: string;
  name?: string;
  action: 'login' | 'logout' | 'page_view';
  page?: string;
  details?: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
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
    });
  } catch (e) {
    console.warn('[audit] Failed to write audit log:', e);
  }
}

export async function readAuditLog(): Promise<AuditEntry[]> {
  try {
    const { blobs } = await list({ prefix: AUDIT_BLOB_PATH, limit: 1 });
    if (!blobs.length) return [];
    const res = await fetch(blobs[0].downloadUrl, {
      headers: process.env.BLOB_READ_WRITE_TOKEN
        ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
        : {},
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
