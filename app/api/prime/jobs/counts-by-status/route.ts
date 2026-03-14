import { NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Run N async tasks with max concurrency
async function pMap<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

export async function GET() {
  try {
    const cacheKey = 'counts-by-status-v2';
    const cached = getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Step 1: Get all statuses (1 API call)
    const statusData = await primeGet('/statuses?per_page=200') as { data: { id: string; attributes: { name: string; statusType: string } }[] };
    const statuses = statusData.data || [];

    // Step 2: For each status, fetch per_page=1 just to get pagination.total (parallel, 5 at a time)
    const results = await pMap(statuses, async (s) => {
      try {
        const data = await primeGet(`/jobs?per_page=1&q='statusId'.eq('${s.id}')`) as {
          meta?: { pagination?: { total?: number } };
        };
        return {
          status: s.attributes.name,
          statusType: s.attributes.statusType,
          count: data.meta?.pagination?.total ?? 0,
        };
      } catch {
        return { status: s.attributes.name, statusType: s.attributes.statusType, count: 0 };
      }
    }, 5);

    const filtered = results.filter(r => r.count > 0).sort((a, b) => b.count - a.count);
    setCached(cacheKey, filtered, 4 * 60 * 60 * 1000);
    return NextResponse.json(filtered);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
