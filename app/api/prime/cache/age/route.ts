import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Returns the most recent cachedAt timestamp across all known Prime cache blobs.
 * Used by DataRefreshButton to show accurate "Data as of X" info.
 */
export async function GET() {
  try {
    const base = (process.env.BLOB_CACHE_BASE_URL || '').replace(/\/$/, '');
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!base || !token) return NextResponse.json({ cachedAt: null });

    // Check the two most-used caches — whichever was written most recently wins
    const keys = ['open-jobs-flat-v3', 'ops-data-v3', 'kpis-v3'];

    const results = await Promise.allSettled(
      keys.map(key =>
        fetch(`${base}/shbr-cache/${key}.json`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        })
          .then(r => r.ok ? r.json() : null)
          .then((m: { cachedAt?: number } | null) => m?.cachedAt || 0)
          .catch(() => 0)
      )
    );

    const timestamps = results
      .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(t => t > 0);

    if (timestamps.length === 0) return NextResponse.json({ cachedAt: null, rebuilding: true });

    const cachedAt = Math.max(...timestamps);
    return NextResponse.json({ cachedAt });
  } catch {
    return NextResponse.json({ cachedAt: null });
  }
}
