/**
 * GET  /api/prime/jobs/client-analytics
 *   Returns pre-aggregated client analytics over the last 12 months.
 *   Cache TTL: 7 days (refreshed by the weekly cron or via ?bust=1).
 *
 * POST /api/prime/jobs/client-analytics
 *   Triggers a full rebuild — called by the weekly Vercel cron.
 *   Requires header X-Refresh-Secret matching REFRESH_SECRET env var.
 */

import { NextRequest, NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 300;

const CACHE_KEY = 'client-analytics-v2';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// ─── Insurer mapping ──────────────────────────────────────────────────────────

const KNOWN_CLIENTS = ['Suncorp', 'Youi', 'Hollard', 'Allianz', 'Guild', 'Others'] as const;
export type ClientName = typeof KNOWN_CLIENTS[number];

function deriveClient(jobNumber: string): ClientName {
  const n = (jobNumber || '').toUpperCase();
  if (n.startsWith('SUN'))  return 'Suncorp';
  if (n.startsWith('YOU'))  return 'Youi';
  if (n.startsWith('HOL'))  return 'Hollard';
  if (n.startsWith('AG'))   return 'Allianz';
  if (n.startsWith('GUI'))  return 'Guild';
  return 'Others';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientSummaryRow {
  client: ClientName;
  total: number;
  pct: number;
  last3: number;
  prior3: number;
  change: number;
}

export interface RegionRow {
  region: string;
  Suncorp: number;
  Youi: number;
  Hollard: number;
  Allianz: number;
  Guild: number;
  Others: number;
  total: number;
}

export interface RegionGrowthRow {
  region: string;
  total: number;
  last3: number;
  prior3: number;
  change3mo: number;
  last6: number;
  prior6: number;
  change6mo: number;
  pct: number;
  state: string;
}

export interface MonthlyRow {
  month: string;
  Suncorp: number;
  Youi: number;
  Hollard: number;
  Allianz: number;
  Guild: number;
  Others: number;
}

export interface RegionMonthlyRow {
  month: string;
  [region: string]: number | string;
}

export interface RegionClientMonthly {
  region: string;
  client: ClientName;
  months: number[];
}

export interface SuburbRow {
  rank: number;
  suburb: string;
  state: string;
  jobs: number;
  pct: number;
}

export interface StateRow {
  state: string;
  jobs: number;
  pct: number;
}

export interface ClientAnalyticsResult {
  generatedAt: string;
  periodLabel: string;
  months: string[];
  totalJobs: number;
  // Client tab
  clientSummary: ClientSummaryRow[];
  // Region × client
  regionData: RegionRow[];
  // Monthly by client
  monthlyTrend: MonthlyRow[];
  // Region detail (region × client × month)
  regionClientDetail: RegionClientMonthly[];
  // Location tab
  regionGrowth: RegionGrowthRow[];
  regionMonthlyTrend: RegionMonthlyRow[];
  topSuburbs: SuburbRow[];
  stateBreakdown: StateRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Main aggregation ─────────────────────────────────────────────────────────

async function buildAnalytics(): Promise<ClientAnalyticsResult> {
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() - 1);
  windowEnd.setHours(23, 59, 59, 999);

  const windowStart = new Date(windowEnd);
  windowStart.setFullYear(windowEnd.getFullYear() - 1);
  windowStart.setDate(1);
  windowStart.setHours(0, 0, 0, 0);

  console.log(`[client-analytics] Fetching ${fmt(windowStart)} → ${fmt(windowEnd)}`);

  // Build ordered 12-month list
  const orderedMonths: string[] = [];
  const cursor = new Date(windowStart);
  while (cursor <= windowEnd) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    if (!orderedMonths.includes(key)) orderedMonths.push(key);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const twelveMonths = orderedMonths.slice(-12);

  // 3/6-month window boundaries
  const prior3Start = twelveMonths[Math.max(0, twelveMonths.length - 6)];
  const prior3End   = twelveMonths[Math.max(0, twelveMonths.length - 4)];
  const prior6Start = twelveMonths[0];
  const prior6End   = twelveMonths[Math.max(0, twelveMonths.length - 7)];

  // Fetch all jobs in window, paginating
  type RawJob = {
    attributes?: {
      jobNumber?: string;
      region?: string;
      createdAt?: string;
      address?: { addressLine1?: string; suburb?: string; state?: string; postcode?: string } | string;
    };
  };

  const allJobs: RawJob[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const q = `'createdAt'.gte('${fmt(windowStart)}'),'createdAt'.lte('${fmt(windowEnd)}')`;
    const data = await primeGet(`/jobs?per_page=250&page=${page}&q=${q}&order=createdAt`) as {
      data?: RawJob[];
      meta?: { pagination?: { total_pages?: number } };
    };

    allJobs.push(...(data.data || []));
    totalPages = data.meta?.pagination?.total_pages ?? 1;
    console.log(`[client-analytics] Page ${page}/${totalPages} — ${allJobs.length} jobs`);
    page++;
    if (page <= totalPages) await sleep(1200);
  }

  // Exclude ABE jobs
  const jobs = allJobs.filter(j =>
    !(j.attributes?.jobNumber || '').toUpperCase().startsWith('ABE')
  );
  console.log(`[client-analytics] ${jobs.length} jobs after ABE exclusion`);

  // ── Aggregation structures ──────────────────────────────────────────────────

  const byClientMonth:       Record<ClientName, Record<string, number>>                         = { Suncorp: {}, Youi: {}, Hollard: {}, Allianz: {}, Guild: {}, Others: {} };
  const byRegionClient:      Record<string, Record<ClientName, number>>                         = {};
  const byRegionClientMonth: Record<string, Record<ClientName, Record<string, number>>>         = {};
  const byRegionMonth:       Record<string, Record<string, number>>                             = {};
  const bySuburb:            Record<string, { jobs: number; state: string }>                    = {};
  const byState:             Record<string, number>                                             = {};

  for (const job of jobs) {
    const jobNum  = job.attributes?.jobNumber || '';
    const region  = job.attributes?.region || 'Unknown';
    const created = job.attributes?.createdAt || '';
    const client  = deriveClient(jobNum);
    const mk      = created ? monthKey(created) : null;

    // Address extraction
    const addr = job.attributes?.address;
    const suburb = (typeof addr === 'object' && addr ? (addr.suburb || '') : '').trim();
    const state  = (typeof addr === 'object' && addr ? (addr.state  || '') : '').trim().toUpperCase();

    // Client × month
    if (mk && twelveMonths.includes(mk)) {
      byClientMonth[client][mk] = (byClientMonth[client][mk] || 0) + 1;
    }

    // Region × client
    if (!byRegionClient[region]) byRegionClient[region] = { Suncorp: 0, Youi: 0, Hollard: 0, Allianz: 0, Guild: 0, Others: 0 };
    byRegionClient[region][client]++;

    // Region × client × month
    if (mk && twelveMonths.includes(mk)) {
      if (!byRegionClientMonth[region]) byRegionClientMonth[region] = { Suncorp: {}, Youi: {}, Hollard: {}, Allianz: {}, Guild: {}, Others: {} };
      byRegionClientMonth[region][client][mk] = (byRegionClientMonth[region][client][mk] || 0) + 1;
    }

    // Region × month (for location tab)
    if (mk && twelveMonths.includes(mk)) {
      if (!byRegionMonth[region]) byRegionMonth[region] = {};
      byRegionMonth[region][mk] = (byRegionMonth[region][mk] || 0) + 1;
    }

    // Suburb
    if (suburb && suburb.toLowerCase() !== 'unknown') {
      if (!bySuburb[suburb]) bySuburb[suburb] = { jobs: 0, state: state || 'NSW' };
      bySuburb[suburb].jobs++;
      if (state && !bySuburb[suburb].state) bySuburb[suburb].state = state;
    }

    // State
    if (state) {
      byState[state] = (byState[state] || 0) + 1;
    }
  }

  const totalJobs = jobs.length;

  // ── Client summary ──────────────────────────────────────────────────────────

  const clientSummary: ClientSummaryRow[] = KNOWN_CLIENTS.map(client => {
    const total  = Object.values(byClientMonth[client]).reduce((s, v) => s + v, 0);
    const last3  = twelveMonths.slice(-3).reduce((s, mk) => s + (byClientMonth[client][mk] || 0), 0);
    const prior3 = twelveMonths.filter(mk => mk >= prior3Start && mk <= prior3End)
      .reduce((s, mk) => s + (byClientMonth[client][mk] || 0), 0);
    return { client, total, pct: totalJobs > 0 ? total / totalJobs : 0, last3, prior3, change: prior3 > 0 ? (last3 - prior3) / prior3 : 0 };
  }).sort((a, b) => b.total - a.total);

  // ── Region × client table ───────────────────────────────────────────────────

  const regionData: RegionRow[] = Object.entries(byRegionClient)
    .filter(([r]) => r && r !== 'Unknown')
    .map(([region, counts]) => ({
      region, ...counts,
      total: Object.values(counts).reduce((s, v) => s + v, 0),
    } as RegionRow))
    .sort((a, b) => b.total - a.total);

  // ── Monthly by client ───────────────────────────────────────────────────────

  const monthlyTrend: MonthlyRow[] = twelveMonths.map(mk => ({
    month: monthLabel(mk),
    Suncorp: byClientMonth.Suncorp[mk] || 0,
    Youi:    byClientMonth.Youi[mk]    || 0,
    Hollard: byClientMonth.Hollard[mk] || 0,
    Allianz: byClientMonth.Allianz[mk] || 0,
    Guild:   byClientMonth.Guild[mk]   || 0,
    Others:  byClientMonth.Others[mk]  || 0,
  }));

  // ── Region × client × month detail ─────────────────────────────────────────

  const regionClientDetail: RegionClientMonthly[] = [];
  for (const [region, clientMap] of Object.entries(byRegionClientMonth)) {
    for (const client of KNOWN_CLIENTS) {
      const monthMap = clientMap[client] || {};
      const months = twelveMonths.map(mk => monthMap[mk] || 0);
      if (months.some(v => v > 0)) regionClientDetail.push({ region, client, months });
    }
  }

  // ── Region growth analysis ──────────────────────────────────────────────────

  // Determine state per region (majority state from byRegionClient — we'll use byRegionMonth totals)
  // We compute state per region from the jobs directly
  const regionState: Record<string, Record<string, number>> = {};
  for (const job of jobs) {
    const region = job.attributes?.region || 'Unknown';
    const addr   = job.attributes?.address;
    const state  = (typeof addr === 'object' && addr ? (addr.state || '') : '').trim().toUpperCase() || 'NSW';
    if (region === 'Unknown') continue;
    if (!regionState[region]) regionState[region] = {};
    regionState[region][state] = (regionState[region][state] || 0) + 1;
  }
  function dominantState(region: string): string {
    const states = regionState[region] || {};
    return Object.entries(states).sort((a, b) => b[1] - a[1])[0]?.[0] || 'NSW';
  }

  const regionGrowth: RegionGrowthRow[] = regionData
    .filter(r => r.region !== 'Unknown')
    .map(r => {
      const monthMap = byRegionMonth[r.region] || {};
      const last3v  = twelveMonths.slice(-3).reduce((s, mk) => s + (monthMap[mk] || 0), 0);
      const prior3v = twelveMonths.filter(mk => mk >= prior3Start && mk <= prior3End)
        .reduce((s, mk) => s + (monthMap[mk] || 0), 0);
      const last6v  = twelveMonths.slice(-6).reduce((s, mk) => s + (monthMap[mk] || 0), 0);
      const prior6v = twelveMonths.filter(mk => mk >= prior6Start && mk <= prior6End)
        .reduce((s, mk) => s + (monthMap[mk] || 0), 0);
      return {
        region:     r.region,
        total:      r.total,
        last3:      last3v,
        prior3:     prior3v,
        change3mo:  prior3v > 0 ? (last3v - prior3v) / prior3v : 0,
        last6:      last6v,
        prior6:     prior6v,
        change6mo:  prior6v > 0 ? (last6v - prior6v) / prior6v : 0,
        pct:        totalJobs > 0 ? r.total / totalJobs : 0,
        state:      dominantState(r.region),
      };
    });

  // ── Region monthly trend (all regions combined) ─────────────────────────────

  const allRegions = regionGrowth.map(r => r.region);
  const regionMonthlyTrend: RegionMonthlyRow[] = twelveMonths.map(mk => {
    const row: RegionMonthlyRow = { month: monthLabel(mk) };
    for (const region of allRegions) {
      row[region] = (byRegionMonth[region] || {})[mk] || 0;
    }
    return row;
  });

  // ── Top suburbs ─────────────────────────────────────────────────────────────

  const topSuburbs: SuburbRow[] = Object.entries(bySuburb)
    .sort((a, b) => b[1].jobs - a[1].jobs)
    .slice(0, 50)
    .map(([suburb, { jobs, state }], i) => ({
      rank: i + 1,
      suburb,
      state,
      jobs,
      pct: totalJobs > 0 ? jobs / totalJobs : 0,
    }));

  // ── State breakdown ─────────────────────────────────────────────────────────

  const stateBreakdown: StateRow[] = Object.entries(byState)
    .sort((a, b) => b[1] - a[1])
    .map(([state, jobs]) => ({ state, jobs, pct: totalJobs > 0 ? jobs / totalJobs : 0 }));

  const periodLabel = `${monthLabel(twelveMonths[0])} – ${monthLabel(twelveMonths[twelveMonths.length - 1])}`;

  return {
    generatedAt: new Date().toISOString(),
    periodLabel,
    months: twelveMonths.map(monthLabel),
    totalJobs,
    clientSummary,
    regionData,
    monthlyTrend,
    regionClientDetail,
    regionGrowth,
    regionMonthlyTrend,
    topSuburbs,
    stateBreakdown,
  };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const bust = req.nextUrl.searchParams.get('bust') === '1';
    const cached = await getCached<ClientAnalyticsResult>(CACHE_KEY, bust);
    if (cached) return NextResponse.json(cached);

    const result = await buildAnalytics();
    await setCached(CACHE_KEY, result, CACHE_TTL);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-refresh-secret');
  if (!secret || secret !== process.env.REFRESH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await buildAnalytics();
    await setCached(CACHE_KEY, result, CACHE_TTL);
    return NextResponse.json({ ok: true, generatedAt: result.generatedAt, totalJobs: result.totalJobs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
