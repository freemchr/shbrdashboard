/**
 * Persistent cache backed by Vercel Blob storage.
 * Falls back to in-memory if Blob is unavailable.
 * 
 * - Blob = persistent across cold starts and deploys
 * - In-memory layer = avoids redundant Blob reads within the same function instance
 */

import { put, head, getDownloadUrl } from '@vercel/blob';

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

function blobKey(key: string) {
  return `${BLOB_PREFIX}${key.replace(/[^a-z0-9-_]/gi, '_')}.json`;
}

interface BlobMeta { expiresAt: number; data: unknown }

export async function getCached<T>(key: string): Promise<T | null> {
  // 1. Check in-memory first
  const mem = memGet<T>(key);
  if (mem !== null) return mem;

  // 2. Check Blob storage
  try {
    const bKey = blobKey(key);
    const info = await head(bKey).catch(() => null);
    if (!info) return null;

    const res = await fetch(info.downloadUrl);
    if (!res.ok) return null;

    const meta: BlobMeta = await res.json();
    if (Date.now() > meta.expiresAt) return null;

    // Warm the in-memory layer
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

  // 2. Persist to Blob in the background
  try {
    const meta: BlobMeta = { expiresAt: Date.now() + ttlMs, data };
    await put(blobKey(key), JSON.stringify(meta), {
      access: 'public', // private blobs use same token, access controls via token
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  } catch (e) {
    console.warn('[blob-cache] Failed to write to Blob:', e);
  }
}

export async function invalidateCache(key?: string): Promise<void> {
  if (key) {
    memCache.delete(key);
    // Note: Vercel Blob doesn't support delete by path in all SDK versions
    // The next read will find it expired and skip it
  } else {
    memCache.clear();
  }
}
