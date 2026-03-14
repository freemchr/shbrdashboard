import { NextResponse } from 'next/server';
import { primeGetAllPages, sleep } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/cache';
import type { PrimeJob } from '@/lib/prime-helpers';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cacheKey = 'counts-by-status';
    const cached = getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Fetch all jobs (this may take a while with rate limiting)
    const jobs = (await primeGetAllPages('/jobs', 100)) as PrimeJob[];

    const counts: Record<string, { count: number; statusType: string }> = {};
    for (const job of jobs) {
      const status = job.attributes?.statusName || job.attributes?.status || 'Unknown';
      const statusType = job.attributes?.statusType || 'unknown';
      if (!counts[status]) {
        counts[status] = { count: 0, statusType };
      }
      counts[status].count++;
    }

    const result = Object.entries(counts)
      .map(([status, info]) => ({ status, count: info.count, statusType: info.statusType }))
      .sort((a, b) => b.count - a.count);

    setCached(cacheKey, result, 4 * 60 * 60 * 1000); // 4h
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
