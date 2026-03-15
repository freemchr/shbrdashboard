import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  try {
    const cacheKey = 'counts-by-status-v3';
    const cached = getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [jobs, statusNames] = await Promise.all([
      getAllOpenJobs(),
      getStatusNameMap(),
    ]);

    const counts: Record<string, number> = {};
    for (const job of jobs) {
      const j = job as { attributes?: { statusId?: string } };
      const statusId = j.attributes?.statusId || 'Unknown';
      const statusName = statusNames[statusId] || statusId;
      counts[statusName] = (counts[statusName] || 0) + 1;
    }

    const result = Object.entries(counts)
      .map(([status, count]) => ({ status, count, statusType: 'Open' }))
      .sort((a, b) => b.count - a.count);

    setCached(cacheKey, result, 30 * 60 * 1000);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
