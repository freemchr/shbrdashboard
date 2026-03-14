import { NextResponse } from 'next/server';
import { primeGetAllPages } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/cache';
import { isOpenJob, daysSince } from '@/lib/prime-helpers';
import type { PrimeJob } from '@/lib/prime-helpers';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cacheKey = 'aging';
    const cached = getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const jobs = (await primeGetAllPages('/jobs', 100)) as PrimeJob[];
    const openJobs = jobs.filter(isOpenJob);

    const over30: PrimeJob[] = [];
    const over60: PrimeJob[] = [];
    const over90: PrimeJob[] = [];

    for (const job of openJobs) {
      const age = daysSince(job.attributes?.createdAt);
      if (age > 90) over90.push(job);
      else if (age > 60) over60.push(job);
      else if (age > 30) over30.push(job);
    }

    const sortOldest = (a: PrimeJob, b: PrimeJob) =>
      new Date(a.attributes?.createdAt || 0).getTime() -
      new Date(b.attributes?.createdAt || 0).getTime();

    over30.sort(sortOldest);
    over60.sort(sortOldest);
    over90.sort(sortOldest);

    const result = {
      buckets: {
        over30: { count: over30.length, jobs: over30 },
        over60: { count: over60.length, jobs: over60 },
        over90: { count: over90.length, jobs: over90 },
      },
    };

    setCached(cacheKey, result, 60 * 60 * 1000); // 1h
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
