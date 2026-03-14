import { NextRequest, NextResponse } from 'next/server';
import { primeGetAllPages } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/cache';
import { isOpenJob, daysSince } from '@/lib/prime-helpers';
import type { PrimeJob } from '@/lib/prime-helpers';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const days = parseInt(req.nextUrl.searchParams.get('days') || '7', 10);
    const cacheKey = `bottlenecks-${days}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const jobs = (await primeGetAllPages('/jobs', 100)) as PrimeJob[];

    const openJobs = jobs.filter(isOpenJob);
    const stuckJobs = openJobs.filter((job) => {
      const since = daysSince(job.attributes?.updatedAt);
      return since >= days;
    });

    // Group by status
    const byStatus: Record<string, PrimeJob[]> = {};
    for (const job of stuckJobs) {
      const status = job.attributes?.statusName || job.attributes?.status || 'Unknown';
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(job);
    }

    // Sort each group oldest first
    for (const status in byStatus) {
      byStatus[status].sort((a, b) => {
        const aDate = new Date(a.attributes?.updatedAt || 0).getTime();
        const bDate = new Date(b.attributes?.updatedAt || 0).getTime();
        return aDate - bDate;
      });
    }

    const result = {
      days,
      totalStuck: stuckJobs.length,
      byStatus,
    };

    setCached(cacheKey, result, 60 * 60 * 1000); // 1h
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
