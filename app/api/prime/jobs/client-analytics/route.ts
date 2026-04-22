/**
 * GET  /api/prime/jobs/client-analytics
 *   Returns pre-aggregated client analytics over the last 12 months.
 *   Cache TTL: 7 days (refreshed by the weekly cron or via ?bust=1).
 *
 * POST /api/prime/jobs/client-analytics
 *   Triggers a full rebuild — called by the weekly Vercel cron.
 *   Requires header X-Refresh-Secret matching REFRESH_SECRET env var.
 *
 * The heavy lifting: fetches ALL jobs created in the last 12 months from
 * Prime, pages through them, derives client/insurer from job number prefix,
 * and builds aggregations for the 4 dashboard tabs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — Vercel Pro limit; plenty for this pull

const CACHE_KEY = 'client-analytics-v1';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Insurer mapping ──────────────────────────────────────────────────────────
// Must stay in sync with MEMORY.md and ops/route.ts

const KNOWN_CLIENTS = ['Suncorp', 'Youi', 'Hollard', 'Allianz', 'Guild', 'Others'] as const;
export type ClientName = typeof KNOWN_CLIENTS[number];

function deriveClient(jobNumber: string): ClientName {
  const n = (jobNumber || '').toUpperCase();
  if (n.startsWith('SUN'))  return 'Suncorp';
  if (n.startsWith('YOU'))  return 'Youi';
  if (n.startsWith('HOL'))  return 'Hollard';
  if (n.startsWith('AG'))   return 'Allianz';   // Auto & General maps to Allianz in the report
  if (n.startsWith('GUI'))  return 'Guild';
  if (n.startsWith('ABE'))  return 'Others';     // excluded division, but bucket it
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

export interface MonthlyRow {
  month: string;   // "Apr 25"
  Suncorp: number;
  Youi: number;
  Hollard: number;
  Allianz: number;
  Guild: number;
  Others: number;
}

export interface RegionClientMonthly {
  region: string;
  client: ClientName;
  months: number[]; // 12 values, oldest first
}

export interface ClientAnalyticsResult {
  generatedAt: string;
  periodLabel: string;      // e.g. "May 2025 – Apr 2026"
  months: string[];         // 12 month labels e.g. ["May 25", ..., "Apr 26"]
  totalJobs: number;
  clientSummary: ClientSummaryRow[];
  regionData: RegionRow[];
  monthlyTrend: MonthlyRow[];
  regionClientDetail: RegionClientMonthly[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function monthKey(dateStr: string): string {
  // "2025-08-14 09:00:00" → "2025-08"
  return dateStr.slice(0, 7);
}

function monthLabel(key: string): string {
  // "2025-08" → "Aug 25"
  const [y, m] = key.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Main aggregation ─────────────────────────────────────────────────────────

async function buildAnalytics(): Promise<ClientAnalyticsResult> {
  // 12-month window ending at end of yesterday (AEST)
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() - 1);
  windowEnd.setHours(23, 59, 59, 999);

  const windowStart = new Date(windowEnd);
  windowStart.setFullYear(windowEnd.getFullYear() - 1);
  windowStart.setDate(1);
  windowStart.setHours(0, 0, 0, 0);

  console.log(`[client-analytics] Fetching jobs from ${fmt(windowStart)} → ${fmt(windowEnd)}`);

  // Build ordered list of months in the window
  const orderedMonths: string[] = [];
  const cursor = new Date(windowStart);
  while (cursor <= windowEnd) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    if (!orderedMonths.includes(key)) orderedMonths.push(key);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  // Trim to at most 12 months
  const twelveMonths = orderedMonths.slice(-12);

  // 3-month windows for the summary table
  const last3Start = twelveMonths[twelveMonths.length - 3];
  const prior3Start = twelveMonths[twelveMonths.length - 6];
  const prior3End = twelveMonths[twelveMonths.length - 4];

  // Fetch all jobs in window, paginating
  type RawJob = {
    attributes?: {
      jobNumber?: string;
      region?: string;
      createdAt?: string;
    };
  };

  const allJobs: RawJob[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const q = `'createdAt'.gte('${fmt(windowStart)}').lte('${fmt(windowEnd)}')`;
    const data = await primeGet(
      `/jobs?per_page=250&page=${page}&q=${encodeURIComponent(q)}&sort=createdAt&order=asc`
    ) as {
      data?: RawJob[];
      meta?: { pagination?: { total_pages?: number; total?: number } };
    };

    const items = data.data || [];
    allJobs.push(...items);
    totalPages = data.meta?.pagination?.total_pages ?? 1;

    console.log(`[client-analytics] Page ${page}/${totalPages} — ${allJobs.length} jobs so far`);
    page++;

    if (page <= totalPages) await sleep(1200); // ~50 req/min, well under the 60/min limit
  }

  // Exclude ABE jobs
  const jobs = allJobs.filter(j => {
    const n = (j.attributes?.jobNumber || '').toUpperCase();
    return !n.startsWith('ABE');
  });

  console.log(`[client-analytics] ${jobs.length} jobs after ABE exclusion`);

  // ── Aggregation structures ──────────────────────────────────────────────────

  // client → month → count
  const byClientMonth: Record<ClientName, Record<string, number>> = {
    Suncorp: {}, Youi: {}, Hollard: {}, Allianz: {}, Guild: {}, Others: {},
  };

  // region → client → count
  const byRegionClient: Record<string, Record<ClientName, number>> = {};

  // region → client → month → count
  const byRegionClientMonth: Record<string, Record<ClientName, Record<string, number>>> = {};

  for (const job of jobs) {
    const jobNum  = job.attributes?.jobNumber || '';
    const region  = job.attributes?.region || 'Unknown';
    const created = job.attributes?.createdAt || '';
    const client  = deriveClient(jobNum);
    const mk      = created ? monthKey(created) : null;

    if (mk && twelveMonths.includes(mk)) {
      byClientMonth[client][mk] = (byClientMonth[client][mk] || 0) + 1;
    }

    if (!byRegionClient[region]) byRegionClient[region] = { Suncorp: 0, Youi: 0, Hollard: 0, Allianz: 0, Guild: 0, Others: 0 };
    byRegionClient[region][client]++;

    if (mk && twelveMonths.includes(mk)) {
      if (!byRegionClientMonth[region]) byRegionClientMonth[region] = { Suncorp: {}, Youi: {}, Hollard: {}, Allianz: {}, Guild: {}, Others: {} };
      byRegionClientMonth[region][client][mk] = (byRegionClientMonth[region][client][mk] || 0) + 1;
    }
  }

  // ── Client summary ──────────────────────────────────────────────────────────

  const totalJobs = jobs.length;

  const clientSummary: ClientSummaryRow[] = KNOWN_CLIENTS.map(client => {
    const total = Object.values(byClientMonth[client]).reduce((s, v) => s + v, 0);

    const last3 = twelveMonths.slice(-3).reduce((s, mk) => s + (byClientMonth[client][mk] || 0), 0);

    const prior3 = twelveMonths
      .filter(mk => mk >= prior3Start && mk <= prior3End)
      .reduce((s, mk) => s + (byClientMonth[client][mk] || 0), 0);

    const change = prior3 > 0 ? (last3 - prior3) / prior3 : 0;

    return { client, total, pct: totalJobs > 0 ? total / totalJobs : 0, last3, prior3, change };
  }).sort((a, b) => b.total - a.total);

  // ── Region data ─────────────────────────────────────────────────────────────

  const regionData: RegionRow[] = Object.entries(byRegionClient)
    .filter(([r]) => r && r !== 'Unknown')
    .map(([region, counts]) => ({
      region,
      ...counts,
      total: Object.values(counts).reduce((s, v) => s + v, 0),
    } as RegionRow))
    .sort((a, b) => b.total - a.total);

  // ── Monthly trend ───────────────────────────────────────────────────────────

  const monthlyTrend: MonthlyRow[] = twelveMonths.map(mk => ({
    month:   monthLabel(mk),
    Suncorp: byClientMonth.Suncorp[mk] || 0,
    Youi:    byClientMonth.Youi[mk]    || 0,
    Hollard: byClientMonth.Hollard[mk] || 0,
    Allianz: byClientMonth.Allianz[mk] || 0,
    Guild:   byClientMonth.Guild[mk]   || 0,
    Others:  byClientMonth.Others[mk]  || 0,
  }));

  // ── Region × client monthly detail ─────────────────────────────────────────

  const regionClientDetail: RegionClientMonthly[] = [];
  for (const [region, clientMap] of Object.entries(byRegionClientMonth)) {
    for (const client of KNOWN_CLIENTS) {
      const monthMap = clientMap[client] || {};
      const months = twelveMonths.map(mk => monthMap[mk] || 0);
      if (months.some(v => v > 0)) {
        regionClientDetail.push({ region, client, months });
      }
    }
  }

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
  };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const bust = req.nextUrl.searchParams.get('bust') === '1';
    const cached = await getCached<ClientAnalyticsResult>(CACHE_KEY, bust);
    if (cached) return NextResponse.json(cached);

    // Cache miss — build fresh (may be slow; Vercel will time out on hobby plan)
    // For production use the POST /refresh endpoint triggered by cron
    const result = await buildAnalytics();
    await setCached(CACHE_KEY, result, CACHE_TTL);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Verify refresh secret
  const secret = req.headers.get('x-refresh-secret');
  if (!secret || secret !== process.env.REFRESH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[client-analytics] Refresh triggered');
    const result = await buildAnalytics();
    await setCached(CACHE_KEY, result, CACHE_TTL);
    return NextResponse.json({
      ok: true,
      generatedAt: result.generatedAt,
      totalJobs: result.totalJobs,
      periodLabel: result.periodLabel,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[client-analytics] Refresh failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
