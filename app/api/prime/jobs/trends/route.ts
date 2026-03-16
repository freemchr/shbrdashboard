import { NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getAllOpenJobs } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);

export interface TrendsResult {
  // Created this week vs the same 7-day window last week
  createdThisWeek: number;
  createdLastWeek: number;

  // Created this calendar month vs the full previous calendar month
  createdThisMonth: number;
  createdLastMonth: number;

  // Stuck open jobs: current (>7d) vs last week's proxy (>14d)
  // Note: stuckLastWeek is a lower-bound proxy — jobs not updated in 14+ days
  // were definitely stuck last week. Jobs updated in the last 7 days may have
  // been stuck previously but aren't captured here.
  stuckNow: number;
  stuckLastWeek: number;

  // Open job counts — current total vs proxy for last week
  // openLastWeek = total open - jobs created in the last 7 days
  // (rough proxy: assumes open job count changes mainly via new jobs)
  openNow: number;
  openLastWeek: number;

  fetchedAt: string;
}

export async function GET() {
  try {
    const cacheKey = 'trends-v1';
    const cached = await getCached<TrendsResult>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const now = new Date();

    // ── Week windows ──────────────────────────────────────────────────
    // This week: Mon 00:00 → now
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Mon
    thisWeekStart.setHours(0, 0, 0, 0);

    // Last week: Mon 00:00 → Sun 23:59 of previous week
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(-1); // just before this week started

    // ── Month windows ─────────────────────────────────────────────────
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); // last day of prev month

    // ── Stuck thresholds ──────────────────────────────────────────────
    const sevenDaysAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // ── Parallel API calls ────────────────────────────────────────────
    const [
      thisWeekRes,
      lastWeekRes,
      thisMonthRes,
      lastMonthRes,
      openJobs,
    ] = await Promise.all([
      primeGet(`/jobs?per_page=1&q='createdAt'.gte('${fmt(thisWeekStart)}')`) as Promise<{
        meta?: { pagination?: { total?: number } };
      }>,
      primeGet(`/jobs?per_page=1&q='createdAt'.gte('${fmt(lastWeekStart)}').lte('${fmt(lastWeekEnd)}')`) as Promise<{
        meta?: { pagination?: { total?: number } };
      }>,
      primeGet(`/jobs?per_page=1&q='createdAt'.gte('${fmt(thisMonthStart)}')`) as Promise<{
        meta?: { pagination?: { total?: number } };
      }>,
      primeGet(`/jobs?per_page=1&q='createdAt'.gte('${fmt(lastMonthStart)}').lte('${fmt(lastMonthEnd)}')`) as Promise<{
        meta?: { pagination?: { total?: number } };
      }>,
      getAllOpenJobs() as Promise<{ attributes?: { updatedAt?: string; createdAt?: string } }[]>,
    ]);

    const createdThisWeek  = thisWeekRes.meta?.pagination?.total  ?? 0;
    const createdLastWeek  = lastWeekRes.meta?.pagination?.total  ?? 0;
    const createdThisMonth = thisMonthRes.meta?.pagination?.total ?? 0;
    const createdLastMonth = lastMonthRes.meta?.pagination?.total ?? 0;

    const openNow = openJobs.length;

    // Stuck now = open jobs not updated in >7 days
    const stuckNow = openJobs.filter(j => {
      const d = j.attributes?.updatedAt;
      return !d || new Date(d.replace(' ', 'T')) <= sevenDaysAgo;
    }).length;

    // Stuck last week proxy = open jobs not updated in >14 days
    // (lower bound: these were definitely stuck last week too)
    const stuckLastWeek = openJobs.filter(j => {
      const d = j.attributes?.updatedAt;
      return !d || new Date(d.replace(' ', 'T')) <= fourteenDaysAgo;
    }).length;

    // Open last week proxy = current open - jobs created in last 7 days that are open
    // (assumes newly opened jobs this week are the main driver of change)
    const newOpenThisWeek = openJobs.filter(j => {
      const d = j.attributes?.createdAt;
      return d && new Date(d.replace(' ', 'T')) >= sevenDaysAgo;
    }).length;
    const openLastWeek = Math.max(0, openNow - newOpenThisWeek);

    const result: TrendsResult = {
      createdThisWeek,
      createdLastWeek,
      createdThisMonth,
      createdLastMonth,
      stuckNow,
      stuckLastWeek,
      openNow,
      openLastWeek,
      fetchedAt: now.toISOString(),
    };

    await setCached(cacheKey, result, 30 * 60 * 1000); // 30 min cache
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
