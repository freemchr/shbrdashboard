import { NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  try {
    const cacheKey = 'pipeline-v2';
    const cached = await getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Build last 12 weeks
    const now = new Date();
    const weeks: { week: string; label: string; start: string; end: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const key = weekStart.toISOString().split('T')[0];
      const label = weekStart.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
      weeks.push({
        week: key,
        label,
        start: key,
        end: weekEnd.toISOString().split('T')[0],
        count: 0,
      });
    }

    // Fetch count for each week using date range query (parallel, 4 at a time)
    const pMap = async <T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> => {
      const results: R[] = [];
      let idx = 0;
      const worker = async () => {
        while (idx < items.length) {
          const i = idx++;
          results[i] = await fn(items[i]);
        }
      };
      await Promise.all(Array.from({ length: concurrency }, worker));
      return results;
    };

    const counts = await pMap(weeks, async (w) => {
      try {
        const data = await primeGet(
          `/jobs?per_page=1&q='createdAt'.gte('${w.start} 00:00:00'),'createdAt'.lte('${w.end} 23:59:59')`
        ) as { meta?: { pagination?: { total?: number } } };
        return data.meta?.pagination?.total ?? 0;
      } catch {
        return 0;
      }
    }, 4);

    weeks.forEach((w, i) => { w.count = counts[i]; });

    const result = weeks.map(({ week, label, count }) => ({ week, label, count }));
    await setCached(cacheKey, result, 2 * 60 * 60 * 1000);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
