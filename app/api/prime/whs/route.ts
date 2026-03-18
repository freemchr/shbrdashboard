import { NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/blob-cache';
import { getAllOpenJobs } from '@/lib/prime-open-jobs';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

interface SiteForm {
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
  data?: SiteForm[];
  meta?: { pagination?: { total_pages?: number } };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET() {
  try {
    const cacheKey = 'whs-swms-v2';
    const cached = await getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const sixMonthsAgo = new Date(Date.now() - SIX_MONTHS_MS).toISOString().slice(0, 10);
    const q = encodeURIComponent(`'createdAt'.gte('${sixMonthsAgo}')`);

    interface SwmsForm {
      id: string;
      number?: string;
      label?: string;
      jobId: string;
      status: string;
      assignedContact?: string;
      assignedUser?: string;
      approvedBy?: string;
      approvedAt?: string;
      createdAt: string;
      updatedAt?: string;
    }
    const all: SwmsForm[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      await sleep(1100);
      const data = (await primeGet(
        `/site-forms?per_page=100&page=${page}&order=createdAt|DESC&q=${q}`
      )) as SiteFormData;

      for (const f of data.data || []) {
        if (f.attributes?.template !== 'Safe Work Method Statement / TMP') continue;
        const a = f.attributes;
        all.push({
          id: f.id,
          number: a.number,
          label: a.label,
          jobId: a.jobId || '',
          status: a.status || 'Unknown',
          assignedContact: a.assignedContact || '',
          assignedUser: a.assignedUser || '',
          approvedBy: a.approvedBy || '',
          approvedAt: (a.approvedAt || '').slice(0, 10),
          createdAt: (a.createdAt || '').slice(0, 10),
          updatedAt: (a.updatedAt || '').slice(0, 10),
        });
      }

      totalPages = data.meta?.pagination?.total_pages || 1;
      page++;
    } while (page <= totalPages);

    // Group by status
    const byStatus: Record<string, typeof all> = {};
    for (const f of all) {
      const s = f.status || 'Unknown';
      if (!byStatus[s]) byStatus[s] = [];
      byStatus[s].push(f);
    }

    const notStarted = byStatus['Not Started']?.length ?? 0;
    const inProgress = byStatus['In Progress']?.length ?? 0;
    const awaitingApproval = byStatus['Awaiting Approval']?.length ?? 0;
    const completed = byStatus['Completed']?.length ?? 0;
    const total = all.length;

    // Completion rate
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Approval turnaround: avg days from createdAt to approvedAt for completed forms
    const approvedForms = (byStatus['Completed'] || []).filter(
      (f) => f.approvedAt && f.createdAt
    );
    let avgApprovalDays = 0;
    if (approvedForms.length > 0) {
      const totalDays = approvedForms.reduce((sum, f) => {
        const created = new Date(f.createdAt).getTime();
        const approved = new Date(f.approvedAt!).getTime();
        return sum + Math.max(0, (approved - created) / 86400000);
      }, 0);
      avgApprovalDays = Math.round(totalDays / approvedForms.length);
    }

    // Open jobs with at least one SWMS
    const jobsWithSwms = new Set(all.map((f) => f.jobId).filter(Boolean));

    // Cross-ref open jobs to find those WITHOUT any SWMS
    const openJobs = (await getAllOpenJobs()) as Array<{
      id: string;
      attributes?: {
        jobNumber?: string;
        address?: { suburb?: string; state?: string } | string;
        jobType?: string;
        region?: string;
        primeUrl?: string;
        authorisedTotalIncludingTax?: number;
        createdAt?: string;
      };
    }>;

    const openJobsWithoutSwms = openJobs.filter((j) => !jobsWithSwms.has(j.id));
    const coverageRate =
      openJobs.length > 0
        ? Math.round(
            ((openJobs.length - openJobsWithoutSwms.length) / openJobs.length) * 100
          )
        : 100;

    // Trend: group completed forms by month (last 6 months)
    const monthlyTrend: Record<string, { completed: number; total: number }> = {};
    for (const f of all) {
      const month = (f.createdAt || '').slice(0, 7); // YYYY-MM
      if (!month) continue;
      if (!monthlyTrend[month]) monthlyTrend[month] = { completed: 0, total: 0 };
      monthlyTrend[month].total++;
      if (f.status === 'Completed') monthlyTrend[month].completed++;
    }
    const trendMonths = Object.keys(monthlyTrend).sort().slice(-6);
    const trend = trendMonths.map((m) => ({
      month: m,
      completed: monthlyTrend[m].completed,
      total: monthlyTrend[m].total,
      rate: monthlyTrend[m].total > 0
        ? Math.round((monthlyTrend[m].completed / monthlyTrend[m].total) * 100)
        : 0,
    }));

    // Awaiting approval breakdown — list the individual forms
    const awaitingList = (byStatus['Awaiting Approval'] || []).slice(0, 20).map((f) => ({
      id: f.id,
      number: f.number,
      jobId: f.jobId,
      assignedContact: f.assignedContact || f.assignedUser,
      createdAt: f.createdAt,
      daysPending: f.createdAt
        ? Math.floor((Date.now() - new Date(f.createdAt).getTime()) / 86400000)
        : 0,
    }));

    // Open jobs without SWMS — top 20 oldest
    const noSwmsList = openJobsWithoutSwms
      .sort((a, b) => {
        const aDate = a.attributes?.createdAt || '';
        const bDate = b.attributes?.createdAt || '';
        return aDate.localeCompare(bDate);
      })
      .slice(0, 20)
      .map((j) => {
        const addr = j.attributes?.address;
        const location =
          typeof addr === 'object' && addr
            ? [addr.suburb, addr.state].filter(Boolean).join(' ')
            : '';
        return {
          id: j.id,
          jobNumber: j.attributes?.jobNumber,
          location,
          jobType: j.attributes?.jobType,
          region: j.attributes?.region,
          primeUrl: j.attributes?.primeUrl,
          daysSinceCreated: j.attributes?.createdAt
            ? Math.floor(
                (Date.now() - new Date(j.attributes.createdAt).getTime()) / 86400000
              )
            : 0,
        };
      });

    const result = {
      asOf: new Date().toISOString(),
      total,
      notStarted,
      inProgress,
      awaitingApproval,
      completed,
      completionRate,
      avgApprovalDays,
      coverageRate,
      openJobsTotal: openJobs.length,
      openJobsWithSwms: openJobs.length - openJobsWithoutSwms.length,
      openJobsNoSwms: openJobsWithoutSwms.length,
      trend,
      awaitingList,
      noSwmsList,
    };

    await setCached(cacheKey, result, 30 * 60 * 1000); // 30 min cache
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
