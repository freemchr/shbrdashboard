import { NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getAllOpenJobs } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const bust = new URL(req.url).searchParams.get('bust') === '1';
        const cacheKey = 'kpis-v3';
    const cached = await getCached<unknown>(cacheKey, bust);
    if (cached) return NextResponse.json(cached);

    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);

    // Total jobs + created this week/month — fast parallel queries
    const [totalRes, weekRes, monthRes, openJobs] = await Promise.all([
      primeGet('/jobs?per_page=1') as Promise<{ meta?: { pagination?: { total?: number } } }>,
      primeGet(`/jobs?per_page=1&q='createdAt'.gte('${fmt(weekStart)}')`) as Promise<{ meta?: { pagination?: { total?: number } } }>,
      primeGet(`/jobs?per_page=1&q='createdAt'.gte('${fmt(monthStart)}')`) as Promise<{ meta?: { pagination?: { total?: number } } }>,
      getAllOpenJobs() as Promise<{ attributes?: { updatedAt?: string } }[]>,
    ]);

    const totalJobs = totalRes.meta?.pagination?.total ?? 0;
    const createdThisWeek = weekRes.meta?.pagination?.total ?? 0;
    const createdThisMonth = monthRes.meta?.pagination?.total ?? 0;

    // Stuck = open jobs not updated in >7 days
    const stuckOver7Days = openJobs.filter(j => {
      const updatedAt = j.attributes?.updatedAt;
      if (!updatedAt) return true; // no update date = assume stuck
      return new Date(updatedAt) <= sevenDaysAgo;
    }).length;

    const result = {
      totalJobs,
      openStatusCount: openJobs.length,
      createdThisWeek,
      createdThisMonth,
      stuckOver7Days,
    };

    await setCached(cacheKey, result, 4 * 60 * 60 * 1000);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
