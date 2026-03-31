import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Returns the timestamp when the main open-jobs cache was last built.
 * Used by DataRefreshButton to show accurate "Data as of X" info.
 */
export async function GET() {
  try {
    const base = (process.env.BLOB_CACHE_BASE_URL || '').replace(/\/$/, '');
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!base || !token) return NextResponse.json({ cachedAt: null });

    const url = `${base}/shbr-cache/open-jobs-flat-v3.json`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return NextResponse.json({ cachedAt: null });

    const meta = await res.json() as { cachedAt?: number; expiresAt?: number };
    // If cachedAt is 0 or missing, cache has been invalidated and is rebuilding
    if (!meta.cachedAt || meta.cachedAt === 0) return NextResponse.json({ cachedAt: null, rebuilding: true });
    // Fall back to expiresAt - 12h if cachedAt not yet present (old cache format)
    const cachedAt = meta.cachedAt ?? (meta.expiresAt ? meta.expiresAt - 12 * 60 * 60 * 1000 : null);
    return NextResponse.json({ cachedAt });
  } catch {
    return NextResponse.json({ cachedAt: null });
  }
}
