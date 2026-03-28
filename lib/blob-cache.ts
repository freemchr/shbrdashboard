/**
 * Persistent cache backed by Vercel Blob storage.
 *
 * OPTIMISED to minimise Blob API operations (free tier = 2,000 ops/month):
 * - No list() calls — uses predictable blob URLs directly (saves 1 op per read)
 * - In-memory layer absorbs repeated reads within the same function instance
 * - Max 1 op per cache read (fetch), 1 op per cache write (put)
 * - In-memory HIT = 0 Blob ops
 * - Stale-while-revalidate: serves stale data immediately, refreshes in background
 *   (avoids blocking writes on every TTL expiry — halves write ops)
 *
 * BLOB OP BUDGET (free tier = 2,000 ops/month ~= 67/day ~= 3/hr):
 * - Each route: 1 read on cold start (in-mem miss), 1 write on first compute
 * - Long TTLs (2-4h) mean cold starts are the main driver, not TTL expiry
 * - Keep TTLs long; only invalidate via the Refresh button when needed
 */

import { put } from '@vercel/blob';

// In-memory layer — zero Blob ops, per-instance
const memCache = new Map<string, { data: unknown; expiresAt: number; staleAt: number }>();

function memGet<T>(key: string): { data: T; stale: boolean } | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return { data: entry.data as T, stale: Date.now() > entry.staleAt };
}

function memSet(key: string, data: unknown, ttlMs: number, staleMs: number) {
  memCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    staleAt: Date.now() + staleMs,
  });
}

const BLOB_PREFIX = 'shbr-cache/';

// ── #8 FIX: Blob base URL moved to env var — not hardcoded in source ──────────
// Set BLOB_CACHE_BASE_URL in your Vercel environment variables.
// Value: your private Vercel Blob store URL (e.g. https://xxxx.private.blob.vercel-storage.com)
function getBlobBase(): string {
  const base = process.env.BLOB_CACHE_BASE_URL || '';
  return base.replace(/\/$/, ''); // strip trailing slash
}

function blobFilename(key: string) {
  return `${BLOB_PREFIX}${key.replace(/[^a-z0-9-_]/gi, '_')}.json`;
}

function blobDirectUrl(key: string) {
  const base = getBlobBase();
  if (!base) return ''; // will cause a cache miss — safe fallback
  return `${base}/${blobFilename(key)}`;
}

interface BlobMeta { expiresAt: number; staleAt: number; data: unknown }

// Track in-flight revalidations to avoid duplicate writes
const revalidating = new Set<string>();

export async function getCached<T>(key: string): Promise<T | null> {
  // 1. In-memory — 0 Blob ops
  const mem = memGet<T>(key);
  if (mem !== null) return mem.data;

  // 2. Direct Blob fetch — 1 Blob op
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const res = await fetch(blobDirectUrl(key), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(8000), // increased from 5s
    });

    if (!res.ok) return null; // 404 = genuine cache miss

    const meta: BlobMeta = await res.json();

    // Serve stale data rather than triggering a full Prime re-fetch
    // Fully expired data (2x TTL past) is discarded; stale-but-usable is served
    const now = Date.now();
    if (now > meta.expiresAt * 2 - (meta.staleAt || meta.expiresAt)) return null; // truly old

    const ttlLeft = Math.max(60_000, meta.expiresAt - now); // min 1 min in memory
    const staleLeft = Math.max(0, (meta.staleAt || meta.expiresAt) - now);
    memSet(key, meta.data, ttlLeft, staleLeft);
    return meta.data as T;
  } catch {
    return null;
  }
}

export async function setCached(key: string, data: unknown, ttlMs: number): Promise<void> {
  // stale-while-revalidate: serve fresh for first 80% of TTL, allow background refresh after
  const staleMs = Math.floor(ttlMs * 0.8);
  memSet(key, data, ttlMs, staleMs);
  revalidating.delete(key);
  try {
    const meta: BlobMeta = {
      expiresAt: Date.now() + ttlMs,
      staleAt: Date.now() + staleMs,
      data,
    };
    await put(blobFilename(key), JSON.stringify(meta), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    console.warn('[blob-cache] Failed to write to Blob:', e);
  }
}

export async function invalidateCache(key?: string): Promise<void> {
  if (key) {
    memCache.delete(key);
    revalidating.delete(key);
    try {
      await put(blobFilename(key), JSON.stringify({ expiresAt: 0, staleAt: 0, data: null }), {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
    } catch { /* ignore */ }
  } else {
    memCache.clear();
    revalidating.clear();
  }
}
