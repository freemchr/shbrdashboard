/**
 * Persistent cache backed by Vercel Blob storage.
 * Falls back gracefully to in-memory if Blob is unavailable or misconfigured.
 *
 * - Blob = persistent across cold starts and deploys
 * - In-memory layer = avoids redundant Blob reads within the same instance
 * - Supports both public and private blob stores (auto-detects via env)
 */

import { put, list, del } from '@vercel/blob';

// In-memory layer (fast, per-instance)
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

function blobFilename(key: string) {
  return `${BLOB_PREFIX}${key.replace(/[^a-z0-9-_]/gi, '_')}.json`;
}

interface BlobMeta { expiresAt: number; data: unknown }

function blobAccess(): 'public' | 'private' {
  // Use 'private' when the store is configured with private access (Vercel project default)
  return 'private';
}

export async function getCached<T>(key: string): Promise<T | null> {
  // 1. Check in-memory first
  const mem = memGet<T>(key);
  if (mem !== null) return mem;

  // 2. Check Blob storage via list (works for both public/private stores)
  try {
    const filename = blobFilename(key);
    const { blobs } = await list({ prefix: filename, limit: 1 });
    if (!blobs.length) return null;

    const blob = blobs[0];
    // Use the blob URL to fetch — for private stores this requires token in env
    const res = await fetch(blob.downloadUrl, {
      headers: process.env.BLOB_READ_WRITE_TOKEN
        ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
        : {},
    });
    if (!res.ok) return null;

    const meta: BlobMeta = await res.json();
    if (Date.now() > meta.expiresAt) {
      // Stale — clean up in background
      del(blob.url).catch(() => null);
      return null;
    }

    const ttlLeft = meta.expiresAt - Date.now();
    memSet(key, meta.data, ttlLeft);
    return meta.data as T;
  } catch {
    return null;
  }
}

export async function setCached(key: string, data: unknown, ttlMs: number): Promise<void> {
  // 1. Always set in-memory
  memSet(key, data, ttlMs);

  // 2. Persist to Blob
  try {
    const meta: BlobMeta = { expiresAt: Date.now() + ttlMs, data };
    await put(blobFilename(key), JSON.stringify(meta), {
      access: blobAccess(),
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  } catch (e) {
    // Non-fatal — in-memory cache still works within the same instance
    console.warn('[blob-cache] Failed to write to Blob:', e);
  }
}

export async function invalidateCache(key?: string): Promise<void> {
  if (key) {
    memCache.delete(key);
    try {
      const filename = blobFilename(key);
      const { blobs } = await list({ prefix: filename, limit: 1 });
      if (blobs.length) await del(blobs[0].url);
    } catch {
      // ignore
    }
  } else {
    memCache.clear();
    try {
      const { blobs } = await list({ prefix: BLOB_PREFIX });
      if (blobs.length) await del(blobs.map(b => b.url));
    } catch {
      // ignore
    }
  }
}
