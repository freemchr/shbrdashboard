import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const bust = new URL(req.url).searchParams.get('bust') === '1';
        const cacheKey = 'counts-by-status-v5';
    const cached = await getCached<unknown>(cacheKey, bust);
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

    await setCached(cacheKey, result, 4 * 60 * 60 * 1000);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
