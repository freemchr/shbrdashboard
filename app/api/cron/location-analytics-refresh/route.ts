/**
 * Vercel Cron — refreshes location analytics cache weekly.
 * Schedule: Fridays at 08:00 UTC (6 PM AEST) — see vercel.json.
 *
 * Builds the location-analytics dataset directly (same logic as the main
 * GET route's buildAnalytics) rather than calling itself via internal fetch,
 * which was broken due to auth middleware and VERCEL_URL pointing to preview
 * deployments instead of production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 300;

const CACHE_KEY = 'location-analytics-v1';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface StateRow        { state: string; jobs: number; pct: number; monthsActive: number; }
interface RegionSummaryRow { region: string; state: string; total: number; pct: number; last3: number; prior3: number; change3mo: number; last6: number; prior6: number; change6mo: number; }
interface RegionMonthRow  { month: string; [region: string]: number | string; }
interface SuburbRow       { rank: number; suburb: string; state: string; region: string; jobs: number; pct: number; }

interface LocationAnalyticsResult {
  generatedAt: string;
  periodLabel: string;
  months: string[];
  totalJobs: number;
  busiestMonth: string;
  busiestMonthJobs: number;
  topRegion: string;
  topRegionJobs: number;
  topState: string;
  regionsActive: number;
  stateBreakdown: StateRow[];
  regionSummary: RegionSummaryRow[];
  regionMonthlyTrend: RegionMonthRow[];
  topSuburbs: SuburbRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date): string { return d.toISOString().replace('T', ' ').slice(0, 19); }
function monthKey(s: string): string { return s.slice(0, 7); }
function monthLabel(k: string): string {
  const [y, m] = k.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(m,10)-1]} ${y.slice(2)}`;
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Aggregation ──────────────────────────────────────────────────────────────

async function buildAnalytics(): Promise<LocationAnalyticsResult> {
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() - 1);
  windowEnd.setHours(23, 59, 59, 999);

  const windowStart = new Date(windowEnd);
  windowStart.setFullYear(windowEnd.getFullYear() - 1);
  windowStart.setDate(1);
  windowStart.setHours(0, 0, 0, 0);

  // Build ordered 12-month list
  const orderedMonths: string[] = [];
  const cursor = new Date(windowStart);
  while (cursor <= windowEnd) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`;
    if (!orderedMonths.includes(key)) orderedMonths.push(key);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const twelveMonths = orderedMonths.slice(-12);

  const prior3Start = twelveMonths[Math.max(0, twelveMonths.length - 6)];
  const prior3End   = twelveMonths[Math.max(0, twelveMonths.length - 4)];
  const prior6Start = twelveMonths[0];
  const prior6End   = twelveMonths[Math.max(0, twelveMonths.length - 7)];

  type RawJob = {
    attributes?: {
      jobNumber?: string;
      region?: string;
      createdAt?: string;
      address?: { suburb?: string; state?: string; [k: string]: unknown } | string;
    };
  };

  const allJobs: RawJob[] = [];
  let page = 1, totalPages = 1;
  while (page <= totalPages) {
    const q = `'createdAt'.gte('${fmt(windowStart)}'),'createdAt'.lte('${fmt(windowEnd)}')`;
    const data = await primeGet(`/jobs?per_page=250&page=${page}&q=${q}&order=createdAt`) as { data?: RawJob[]; meta?: { pagination?: { total_pages?: number } } };
    allJobs.push(...(data.data || []));
    totalPages = data.meta?.pagination?.total_pages ?? 1;
    console.log(`[cron/location-analytics] Page ${page}/${totalPages} (${allJobs.length} jobs)`);
    page++;
    if (page <= totalPages) await sleep(1200);
  }

  const jobs = allJobs.filter(j => !(j.attributes?.jobNumber || '').toUpperCase().startsWith('ABE'));
  console.log(`[cron/location-analytics] ${jobs.length} jobs after ABE exclusion`);

  const byRegionMonth:  Record<string, Record<string, number>> = {};
  const bySuburb:       Record<string, { jobs: number; state: string; region: string }> = {};
  const byState:        Record<string, { jobs: number; months: Set<string> }> = {};
  const byMonth:        Record<string, number> = {};

  for (const job of jobs) {
    const region  = job.attributes?.region || 'Unknown';
    const created = job.attributes?.createdAt || '';
    const addr    = job.attributes?.address;
    const suburb  = (typeof addr === 'object' && addr ? String(addr.suburb || '') : '').trim();
    const state   = (typeof addr === 'object' && addr ? String(addr.state  || '') : '').trim().toUpperCase() || 'NSW';
    const mk      = created ? monthKey(created) : null;

    if (mk && twelveMonths.includes(mk)) {
      if (region !== 'Unknown') {
        if (!byRegionMonth[region]) byRegionMonth[region] = {};
        byRegionMonth[region][mk] = (byRegionMonth[region][mk] || 0) + 1;
      }
      byMonth[mk] = (byMonth[mk] || 0) + 1;
    }

    if (suburb && suburb.toLowerCase() !== 'unknown') {
      if (!bySuburb[suburb]) bySuburb[suburb] = { jobs: 0, state, region };
      bySuburb[suburb].jobs++;
    }

    if (state) {
      if (!byState[state]) byState[state] = { jobs: 0, months: new Set() };
      byState[state].jobs++;
      if (mk && twelveMonths.includes(mk)) byState[state].months.add(mk);
    }
  }

  const totalJobs = jobs.length;

  const busiestMonthKey = Object.entries(byMonth).sort((a,b) => b[1]-a[1])[0]?.[0] || '';
  const busiestMonthJobs = busiestMonthKey ? byMonth[busiestMonthKey] : 0;

  const regionTotals: Record<string, number> = {};
  for (const [region, monthMap] of Object.entries(byRegionMonth)) {
    regionTotals[region] = Object.values(monthMap).reduce((s, v) => s + v, 0);
  }
  const topRegion = Object.entries(regionTotals).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';
  const topRegionJobs = regionTotals[topRegion] || 0;
  const topState = Object.entries(byState).sort((a,b) => b[1].jobs-a[1].jobs)[0]?.[0] || 'NSW';

  const regionStateVotes: Record<string, Record<string, number>> = {};
  for (const { region, state } of Object.values(bySuburb)) {
    if (!regionStateVotes[region]) regionStateVotes[region] = {};
    regionStateVotes[region][state] = (regionStateVotes[region][state] || 0) + 1;
  }
  for (const job of jobs) {
    const region = job.attributes?.region || 'Unknown';
    const addr   = job.attributes?.address;
    const state  = (typeof addr === 'object' && addr ? String(addr.state || '') : '').trim().toUpperCase() || 'NSW';
    if (region === 'Unknown' || !state) continue;
    if (!regionStateVotes[region]) regionStateVotes[region] = {};
    regionStateVotes[region][state] = (regionStateVotes[region][state] || 0) + 1;
  }
  function dominantState(region: string): string {
    const votes = regionStateVotes[region] || {};
    return Object.entries(votes).sort((a,b) => b[1]-a[1])[0]?.[0] || 'NSW';
  }

  const regionSummary: RegionSummaryRow[] = Object.entries(regionTotals)
    .filter(([r]) => r !== 'Unknown')
    .sort((a, b) => b[1] - a[1])
    .map(([region, total]) => {
      const mm = byRegionMonth[region] || {};
      const last3  = twelveMonths.slice(-3).reduce((s,mk) => s + (mm[mk]||0), 0);
      const prior3 = twelveMonths.filter(mk => mk >= prior3Start && mk <= prior3End).reduce((s,mk) => s + (mm[mk]||0), 0);
      const last6  = twelveMonths.slice(-6).reduce((s,mk) => s + (mm[mk]||0), 0);
      const prior6 = twelveMonths.filter(mk => mk >= prior6Start && mk <= prior6End).reduce((s,mk) => s + (mm[mk]||0), 0);
      return {
        region,
        state:      dominantState(region),
        total,
        pct:        totalJobs > 0 ? total / totalJobs : 0,
        last3,
        prior3,
        change3mo:  prior3 > 0 ? (last3 - prior3) / prior3 : 0,
        last6,
        prior6,
        change6mo:  prior6 > 0 ? (last6 - prior6) / prior6 : 0,
      };
    });

  const allRegions = regionSummary.map(r => r.region);
  const regionMonthlyTrend: RegionMonthRow[] = twelveMonths.map(mk => {
    const row: RegionMonthRow = { month: monthLabel(mk) };
    for (const region of allRegions) {
      row[region] = (byRegionMonth[region]||{})[mk] || 0;
    }
    return row;
  });

  const stateBreakdown: StateRow[] = Object.entries(byState)
    .sort((a,b) => b[1].jobs - a[1].jobs)
    .map(([state, { jobs, months }]) => ({
      state, jobs, pct: totalJobs > 0 ? jobs/totalJobs : 0, monthsActive: months.size,
    }));

  const topSuburbs: SuburbRow[] = Object.entries(bySuburb)
    .sort((a,b) => b[1].jobs - a[1].jobs)
    .slice(0, 50)
    .map(([suburb, { jobs, state, region }], i) => ({
      rank: i+1, suburb, state, region, jobs, pct: totalJobs > 0 ? jobs/totalJobs : 0,
    }));

  const periodLabel = `${monthLabel(twelveMonths[0])} – ${monthLabel(twelveMonths[twelveMonths.length-1])}`;

  return {
    generatedAt: new Date().toISOString(),
    periodLabel,
    months: twelveMonths.map(monthLabel),
    totalJobs,
    busiestMonth: busiestMonthKey ? monthLabel(busiestMonthKey) : '—',
    busiestMonthJobs,
    topRegion,
    topRegionJobs,
    topState,
    regionsActive: regionSummary.length,
    stateBreakdown,
    regionSummary,
    regionMonthlyTrend,
    topSuburbs,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[cron/location-analytics] Weekly refresh starting');
    const result = await buildAnalytics();
    await setCached(CACHE_KEY, result, CACHE_TTL);
    console.log(`[cron/location-analytics] Done — ${result.totalJobs} jobs, ${result.periodLabel}`);
    return NextResponse.json({ ok: true, generatedAt: result.generatedAt, totalJobs: result.totalJobs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cron/location-analytics] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
