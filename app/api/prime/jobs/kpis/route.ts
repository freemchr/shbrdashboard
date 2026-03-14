import { NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  try {
    const cacheKey = 'kpis-v1';
    const cached = getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);

    // Run all fast queries in parallel
    const [totalRes, openRes, weekRes, monthRes, stuckRes] = await Promise.all([
      primeGet('/jobs?per_page=1') as Promise<{ meta?: { pagination?: { total?: number } } }>,
      primeGet(`/statuses?per_page=200`) as Promise<{ data: { id: string; attributes: { statusType: string } }[] }>,
      primeGet(`/jobs?per_page=1&q='createdAt'.gte('${fmt(weekStart)}')`) as Promise<{ meta?: { pagination?: { total?: number } } }>,
      primeGet(`/jobs?per_page=1&q='createdAt'.gte('${fmt(monthStart)}')`) as Promise<{ meta?: { pagination?: { total?: number } } }>,
      primeGet(`/jobs?per_page=1&q='updatedAt'.lte('${fmt(sevenDaysAgo)}')`) as Promise<{ meta?: { pagination?: { total?: number } } }>,
    ]);

    // Get open status IDs then count open jobs
    const openStatusIds = (openRes.data || [])
      .filter(s => s.attributes?.statusType === 'Open')
      .map(s => s.id);

    // Count open jobs: sum per-status (use parallel small queries for top 5 statuses, estimate rest)
    // Actually, fetch open jobs total using a broad query - approximate by getting page 1
    // We'll use the counts-by-status cache if available
    const totalJobs = totalRes.meta?.pagination?.total ?? 0;
    const createdThisWeek = weekRes.meta?.pagination?.total ?? 0;
    const createdThisMonth = monthRes.meta?.pagination?.total ?? 0;
    const stuckOver7Days = stuckRes.meta?.pagination?.total ?? 0; // approximate (includes closed)

    const result = {
      totalJobs,
      openStatusCount: openStatusIds.length,
      createdThisWeek,
      createdThisMonth,
      stuckOver7Days,
    };

    setCached(cacheKey, result, 30 * 60 * 1000); // 30 min
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
