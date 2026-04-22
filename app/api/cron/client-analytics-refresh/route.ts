/**
 * Vercel Cron endpoint — refreshes client analytics cache weekly.
 * Schedule: Fridays at 6 PM AEST (08:00 UTC) — see vercel.json.
 * Protected by CRON_SECRET header injected automatically by Vercel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 300;

const CACHE_KEY = 'client-analytics-v1';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const KNOWN_CLIENTS = ['Suncorp', 'Youi', 'Hollard', 'Allianz', 'Guild', 'Others'] as const;
type ClientName = typeof KNOWN_CLIENTS[number];

function deriveClient(jobNumber: string): ClientName {
  const n = (jobNumber || '').toUpperCase();
  if (n.startsWith('SUN'))  return 'Suncorp';
  if (n.startsWith('YOU'))  return 'Youi';
  if (n.startsWith('HOL'))  return 'Hollard';
  if (n.startsWith('AG'))   return 'Allianz';
  if (n.startsWith('GUI'))  return 'Guild';
  return 'Others';
}

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

async function buildAnalytics() {
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() - 1);
  windowEnd.setHours(23, 59, 59, 999);

  const windowStart = new Date(windowEnd);
  windowStart.setFullYear(windowEnd.getFullYear() - 1);
  windowStart.setDate(1);
  windowStart.setHours(0, 0, 0, 0);

  // Build 12-month list
  const orderedMonths: string[] = [];
  const cursor = new Date(windowStart);
  while (cursor <= windowEnd) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    if (!orderedMonths.includes(key)) orderedMonths.push(key);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const twelveMonths = orderedMonths.slice(-12);

  // Pagination
  type RawJob = { attributes?: { jobNumber?: string; region?: string; createdAt?: string } };
  const allJobs: RawJob[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const q = `'createdAt'.gte('${fmt(windowStart)}').lte('${fmt(windowEnd)}')`;
    const data = await primeGet(
      `/jobs?per_page=250&page=${page}&q=${encodeURIComponent(q)}&sort=createdAt&order=asc`
    ) as { data?: RawJob[]; meta?: { pagination?: { total_pages?: number } } };

    allJobs.push(...(data.data || []));
    totalPages = data.meta?.pagination?.total_pages ?? 1;
    console.log(`[cron/client-analytics] Page ${page}/${totalPages} (${allJobs.length} so far)`);
    page++;
    if (page <= totalPages) await sleep(1200);
  }

  // Exclude ABE
  const jobs = allJobs.filter(j => !(j.attributes?.jobNumber || '').toUpperCase().startsWith('ABE'));

  // Aggregation
  const byClientMonth: Record<ClientName, Record<string, number>> = {
    Suncorp: {}, Youi: {}, Hollard: {}, Allianz: {}, Guild: {}, Others: {},
  };
  const byRegionClient: Record<string, Record<ClientName, number>> = {};
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

    if (!byRegionClient[region]) {
      byRegionClient[region] = { Suncorp: 0, Youi: 0, Hollard: 0, Allianz: 0, Guild: 0, Others: 0 };
    }
    byRegionClient[region][client]++;

    if (mk && twelveMonths.includes(mk)) {
      if (!byRegionClientMonth[region]) {
        byRegionClientMonth[region] = { Suncorp: {}, Youi: {}, Hollard: {}, Allianz: {}, Guild: {}, Others: {} };
      }
      byRegionClientMonth[region][client][mk] = (byRegionClientMonth[region][client][mk] || 0) + 1;
    }
  }

  const totalJobs = jobs.length;
  const last3Start  = twelveMonths[twelveMonths.length - 3];
  const prior3Start = twelveMonths[Math.max(0, twelveMonths.length - 6)];
  const prior3End   = twelveMonths[Math.max(0, twelveMonths.length - 4)];

  const clientSummary = KNOWN_CLIENTS.map(client => {
    const total  = Object.values(byClientMonth[client]).reduce((s, v) => s + v, 0);
    const last3  = twelveMonths.slice(-3).reduce((s, mk) => s + (byClientMonth[client][mk] || 0), 0);
    const prior3 = twelveMonths
      .filter(mk => mk >= prior3Start && mk <= prior3End)
      .reduce((s, mk) => s + (byClientMonth[client][mk] || 0), 0);
    return { client, total, pct: totalJobs > 0 ? total / totalJobs : 0, last3, prior3, change: prior3 > 0 ? (last3 - prior3) / prior3 : 0 };
  }).sort((a, b) => b.total - a.total);

  const regionData = Object.entries(byRegionClient)
    .filter(([r]) => r && r !== 'Unknown')
    .map(([region, counts]) => ({ region, ...counts, total: Object.values(counts).reduce((s, v) => s + v, 0) }))
    .sort((a, b) => (b as { total: number }).total - (a as { total: number }).total);

  const monthlyTrend = twelveMonths.map(mk => ({
    month:   monthLabel(mk),
    Suncorp: byClientMonth.Suncorp[mk] || 0,
    Youi:    byClientMonth.Youi[mk]    || 0,
    Hollard: byClientMonth.Hollard[mk] || 0,
    Allianz: byClientMonth.Allianz[mk] || 0,
    Guild:   byClientMonth.Guild[mk]   || 0,
    Others:  byClientMonth.Others[mk]  || 0,
  }));

  const regionClientDetail: { region: string; client: ClientName; months: number[] }[] = [];
  for (const [region, clientMap] of Object.entries(byRegionClientMonth)) {
    for (const client of KNOWN_CLIENTS) {
      const monthMap = clientMap[client] || {};
      const months = twelveMonths.map(mk => monthMap[mk] || 0);
      if (months.some(v => v > 0)) regionClientDetail.push({ region, client, months });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    periodLabel: `${monthLabel(twelveMonths[0])} – ${monthLabel(twelveMonths[twelveMonths.length - 1])}`,
    months: twelveMonths.map(monthLabel),
    totalJobs,
    clientSummary,
    regionData,
    monthlyTrend,
    regionClientDetail,
  };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization');
  if (!secret || secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[cron/client-analytics] Weekly refresh starting');
    const result = await buildAnalytics();
    await setCached(CACHE_KEY, result, CACHE_TTL);
    console.log(`[cron/client-analytics] Done — ${result.totalJobs} jobs, ${result.periodLabel}`);
    return NextResponse.json({ ok: true, generatedAt: result.generatedAt, totalJobs: result.totalJobs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cron/client-analytics] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


