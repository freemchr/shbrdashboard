import { NextResponse } from 'next/server';
import { primeGetAllPages } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/cache';
import { getWeekKey } from '@/lib/prime-helpers';
import type { PrimeJob } from '@/lib/prime-helpers';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cacheKey = 'pipeline';
    const cached = getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const jobs = (await primeGetAllPages('/jobs', 100)) as PrimeJob[];

    // Last 12 weeks
    const now = new Date();
    const weeks: { week: string; label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split('T')[0];
      const label = weekStart.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
      weeks.push({ week: key, label, count: 0 });
    }

    for (const job of jobs) {
      const createdAt = job.attributes?.createdAt;
      if (!createdAt) continue;
      const weekKey = getWeekKey(createdAt);
      const entry = weeks.find((w) => w.week === weekKey);
      if (entry) entry.count++;
    }

    setCached(cacheKey, weeks, 2 * 60 * 60 * 1000); // 2h
    return NextResponse.json(weeks);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
