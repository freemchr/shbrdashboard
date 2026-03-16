/**
 * Persistent cache backed by Vercel Blob storage.
 *
 * OPTIMISED to minimise Blob API operations (free tier = 2,000 ops/month):
 * - No list() calls — uses predictable blob URLs directly (saves 1 op per read)
 * - In-memory layer absorbs repeated reads within the same function instance  
 * - Max 1 op per cache read (fetch), 1 op per cache write (put)
 * - In-memory HIT = 0 Blob ops
 */

import { put } from '@vercel/blob';

// In-memory layer — zero Blob ops, per-instance
const memCache = new Map<string, { data: unknown; expiresAt: number }>();

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.data as T;
}

function memSet(key: string, data: unknown, ttlMs: number) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

const BLOB_PREFIX = 'shbr-cache/';
// Predictable base URL — avoids list() calls entirely
const BLOB_BASE = 'https://4sgwpkfrmhyjifry.private.blob.vercel-storage.com';

function blobFilename(key: string) {
  return `${BLOB_PREFIX}${key.replace(/[^a-z0-9-_]/gi, '_')}.json`;
}

function blobDirectUrl(key: string) {
  return `${BLOB_BASE}/${blobFilename(key)}`;
}

interface BlobMeta { expiresAt: number; data: unknown }

export async function getCached<T>(key: string): Promise<T | null> {
  // 1. In-memory — 0 Blob ops
  const mem = memGet<T>(key);
  if (mem !== null) return mem;

  // 2. Direct Blob fetch — 1 Blob op, no list() needed
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const res = await fetch(blobDirectUrl(key), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null; // 404 = cache miss

    const meta: BlobMeta = await res.json();
    if (Date.now() > meta.expiresAt) return null; // stale

    const ttlLeft = meta.expiresAt - Date.now();
    memSet(key, meta.data, ttlLeft);
    return meta.data as T;
  } catch {
    return null;
  }
}

export async function setCached(key: string, data: unknown, ttlMs: number): Promise<void> {
  memSet(key, data, ttlMs);
  try {
    const meta: BlobMeta = { expiresAt: Date.now() + ttlMs, data };
    await put(blobFilename(key), JSON.stringify(meta), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false, allowOverwrite: true,
    });
  } catch (e) {
    console.warn('[blob-cache] Failed to write to Blob:', e);
  }
}

export async function invalidateCache(key?: string): Promise<void> {
  if (key) {
    memCache.delete(key);
    try {
      await put(blobFilename(key), JSON.stringify({ expiresAt: 0, data: null }), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
      });
    } catch { /* ignore */ }
  } else {
    memCache.clear();
  }
}
