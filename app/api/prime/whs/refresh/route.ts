/**
 * /api/prime/whs/refresh
 *
 * Heavy worker — called by Vercel cron nightly (3am AEDT = 4pm UTC).
 * Also callable manually via POST with the CRON_SECRET header for on-demand refresh.
 *
 * Does all the Prime API crawling here, writes result to blob cache.
 * The main /api/prime/whs route just reads from cache — instant, no timeout risk.
 */

import { NextRequest, NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { setCached } from '@/lib/blob-cache';
import { getAllOpenJobs } from '@/lib/prime-open-jobs';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — plenty of time for cron, no user waiting

const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
const WHS_CACHE_KEY = 'whs-swms-v2';

interface SiteFormRaw {
  id: string;
  attributes: {
    template?: string;
    number?: string;
    label?: string;
    jobId?: string;
    status?: string;
    assignedContact?: string;
    assignedUser?: string;
    approvedBy?: string;
    approvedAt?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

interface SiteFormData {
  data?: SiteFormRaw[];
  meta?: { pagination?: { total_pages?: number } };
}

interface SwmsForm {
  id: string;
  number?: string;
  jobId: string;
  status: string;
  assignedContact?: string;
  assignedUser?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function buildWHSData() {
  const sixMonthsAgo = new Date(Date.now() - SIX_MONTHS_MS).toISOString().slice(0, 10);
  const q = encodeURIComponent(`'createdAt'.gte('${sixMonthsAgo}')`);

  // Fetch all SWMS/TMP site forms
  const all: SwmsForm[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    if (page > 1) await sleep(700);
    const data = (await primeGet(
      `/site-forms?per_page=100&page=${page}&order=createdAt|DESC&q=${q}`
    )) as SiteFormData;

    for (const f of data.data || []) {
      if (f.attributes?.template !== 'Safe Work Method Statement / TMP') continue;
      const a = f.attributes;
      all.push({
        id: f.id,
        number: a.number,
        jobId: a.jobId || '',
        status: a.status || 'Unknown',
        assignedContact: a.assignedContact || '',
        assignedUser: a.assignedUser || '',
        approvedBy: a.approvedBy || '',
        approvedAt: (a.approvedAt || '').slice(0, 10),
        createdAt: (a.createdAt || '').slice(0, 10),
      });
    }

    totalPages = data.meta?.pagination?.total_pages || 1;
    page++;
  } while (page <= totalPages);

  // Fetch open jobs (usually cached already)
  const openJobsRaw = (await getAllOpenJobs()) as Array<{
    id: string;
    attributes?: {
      jobNumber?: string;
      address?: { suburb?: string; state?: string } | string;
      jobType?: string;
      region?: string;
      primeUrl?: string;
      createdAt?: string;
    };
  }>;

  // Group by status
  const byStatus: Record<string, SwmsForm[]> = {};
  for (const f of all) {
    if (!byStatus[f.status]) byStatus[f.status] = [];
    byStatus[f.status].push(f);
  }

  const notStarted = byStatus['Not Started']?.length ?? 0;
  const inProgress = byStatus['In Progress']?.length ?? 0;
  const awaitingApproval = byStatus['Awaiting Approval']?.length ?? 0;
  const completed = byStatus['Completed']?.length ?? 0;
  const total = all.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Avg approval turnaround
  const approvedForms = (byStatus['Completed'] || []).filter(f => f.approvedAt && f.createdAt);
  let avgApprovalDays = 0;
  if (approvedForms.length > 0) {
    const totalDays = approvedForms.reduce((sum, f) => {
      return sum + Math.max(0, (new Date(f.approvedAt!).getTime() - new Date(f.createdAt).getTime()) / 86400000);
    }, 0);
    avgApprovalDays = Math.round(totalDays / approvedForms.length);
  }

  // Coverage
  const jobsWithSwms = new Set(all.map(f => f.jobId).filter(Boolean));
  const openJobsWithoutSwms = openJobsRaw.filter(j => !jobsWithSwms.has(j.id));
  const coverageRate = openJobsRaw.length > 0
    ? Math.round(((openJobsRaw.length - openJobsWithoutSwms.length) / openJobsRaw.length) * 100)
    : 100;

  // Monthly trend (last 6 months)
  const monthlyTrend: Record<string, { completed: number; total: number }> = {};
  for (const f of all) {
    const month = f.createdAt.slice(0, 7);
    if (!month) continue;
    if (!monthlyTrend[month]) monthlyTrend[month] = { completed: 0, total: 0 };
    monthlyTrend[month].total++;
    if (f.status === 'Completed') monthlyTrend[month].completed++;
  }
  const trend = Object.keys(monthlyTrend).sort().slice(-6).map(m => ({
    month: m,
    completed: monthlyTrend[m].completed,
    total: monthlyTrend[m].total,
    rate: monthlyTrend[m].total > 0 ? Math.round((monthlyTrend[m].completed / monthlyTrend[m].total) * 100) : 0,
  }));

  // Awaiting approval list
  const awaitingList = (byStatus['Awaiting Approval'] || []).slice(0, 20).map(f => ({
    id: f.id,
    number: f.number,
    jobId: f.jobId,
    assignedContact: f.assignedContact || f.assignedUser,
    createdAt: f.createdAt,
    daysPending: f.createdAt ? Math.floor((Date.now() - new Date(f.createdAt).getTime()) / 86400000) : 0,
  }));

  // Open jobs without SWMS — oldest first
  const noSwmsList = openJobsWithoutSwms
    .sort((a, b) => (a.attributes?.createdAt || '').localeCompare(b.attributes?.createdAt || ''))
    .slice(0, 20)
    .map(j => {
      const addr = j.attributes?.address;
      const location = typeof addr === 'object' && addr ? [addr.suburb, addr.state].filter(Boolean).join(' ') : '';
      return {
        id: j.id,
        jobNumber: j.attributes?.jobNumber,
        location,
        jobType: j.attributes?.jobType,
        region: j.attributes?.region,
        primeUrl: j.attributes?.primeUrl,
        daysSinceCreated: j.attributes?.createdAt
          ? Math.floor((Date.now() - new Date(j.attributes.createdAt).getTime()) / 86400000)
          : 0,
      };
    });

  return {
    asOf: new Date().toISOString(),
    total,
    notStarted,
    inProgress,
    awaitingApproval,
    completed,
    completionRate,
    avgApprovalDays,
    coverageRate,
    openJobsTotal: openJobsRaw.length,
    openJobsWithSwms: openJobsRaw.length - openJobsWithoutSwms.length,
    openJobsNoSwms: openJobsWithoutSwms.length,
    trend,
    awaitingList,
    noSwmsList,
  };
}

// GET — called by Vercel cron
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await buildWHSData();
    await setCached(WHS_CACHE_KEY, result, 26 * 60 * 60 * 1000); // 26h — covers daily cron gap
    return NextResponse.json({ ok: true, total: result.total, asOf: result.asOf });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — manual trigger (e.g. from Refresh button or admin)
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await buildWHSData();
    await setCached(WHS_CACHE_KEY, result, 26 * 60 * 60 * 1000);
    return NextResponse.json({ ok: true, total: result.total, asOf: result.asOf });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
