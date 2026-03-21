/**
 * Team API — fetches active users + their open job workloads.
 * 
 * assignedId on a job = the user responsible for it.
 * We join users → open jobs by user.id === job.assignedId.
 */
import { NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface RawUser {
  id: string;
  attributes: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    status?: string;
    roles?: string[];
  };
}

interface RawJob {
  id: string;
  attributes?: {
    assignedId?: string;
    updatedBy?: string;
    updatedAt?: string;
    createdAt?: string;
    statusId?: string;
    region?: string;
    jobType?: string;
    authorisedTotalIncludingTax?: number;
  };
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  status: string;
  roles: string[];
  openJobs: number;
  totalAuthorisedValue: number;
  updatedThisWeek: number;
  updatedThisMonth: number;
  regions: string[];
  noReportCount: number;
  slaBreachCount: number;
  criticalSlaCount: number;
  avgDaysOpen: number;
  oldestJobDays: number;
}

// ─── Status category sets (mirrored from reports/sla routes) ──────────────────

const NO_REPORT_STATUSES = new Set([
  'new enquiry',
  'appointment required',
  'appointment booked',
  'appointment completed',
  'initial attendance required',
  'initial attendance booked',
  'initial attendance completed',
  'assessment booking required',
  'booking required',
  'appt tbc',
  'customer contacted',
  'trade/specialist report required',
  'specialist report requested',
  'external report pending',
  'consultant required',
  'engineer required',
  'secondary appointment required',
  'secondary appointment booked',
  'secondary appointment completed',
  'return attendance to be booked',
  'return attendance booked',
]);

const IN_PROGRESS_STATUSES = new Set([
  'preparing initial report',
  'estimate/ report being compiled',
  'preparing progress report',
  'preparing final report/costs',
  'preparing return attendance report',
  'first assessment booked',
  'first assessment completed',
  'second assessment booked',
  'second assessment completed',
  'third assessment booked',
  'third assessment completed',
  'fourth assessment booked',
  'fourth assessment completed',
  'fifth assessment booked',
  'fifth assessment completed',
  'plumbing check booked',
  'plumbing check completed',
  'plumbing install booked',
  'plumbing install completed',
  'quality review required',
  'peer review required',
]);

const SUBMITTED_STATUSES = new Set([
  'initial report submitted',
  'initial report ready for submission',
  'first assessment submitted',
  'second assessment submitted',
  'third assessment submitted',
  'fourth assessment submitted',
  'fifth assessment submitted',
  'final report submitted',
  'progress report ready for submission',
  'ready to submit',
  'report submitted, awaiting directions',
  'return attendance report for submission',
  'initial documents submitted',
  'final documents submitted',
  'plumbing check submitted',
  'plumbing install submitted',
  'report/quote sent',
  'ready to quote',
  'ready to invoice',
  'preparing for invoicing',
  'awaiting client approval',
  'secondary approval required',
  'secondary approval received',
  'secondary approval declined',
]);

const AUTHORISED_STATUSES = new Set([
  'works authorised',
  'works in progress',
  'works authorised - awaiting trade',
  'awaiting trade',
  'trade booked',
  'trade completed',
  'partial works completed',
  'waiting for materials',
  'works on hold',
  'awaiting parts',
]);

const COMPLETED_STATUSES = new Set([
  'works completed',
  'job completed',
  'completed - awaiting invoice',
  'awaiting final invoice',
  'ready to invoice',
  'final inspection required',
  'final inspection completed',
  'awaiting sign-off',
]);

type StatusCategory = 'NO_REPORT' | 'IN_PROGRESS' | 'SUBMITTED' | 'AUTHORISED' | 'COMPLETED' | 'OTHER';

function categorise(status: string): StatusCategory {
  const s = status.toLowerCase().trim();
  if (NO_REPORT_STATUSES.has(s))   return 'NO_REPORT';
  if (IN_PROGRESS_STATUSES.has(s)) return 'IN_PROGRESS';
  if (SUBMITTED_STATUSES.has(s))   return 'SUBMITTED';
  if (AUTHORISED_STATUSES.has(s))  return 'AUTHORISED';
  if (COMPLETED_STATUSES.has(s))   return 'COMPLETED';
  return 'OTHER';
}

function repairCommencementDays(authorisedTotal: number): number {
  if (authorisedTotal < 10_000) return 30;
  if (authorisedTotal < 20_000) return 40;
  if (authorisedTotal < 50_000) return 50;
  return 70;
}

const CACHE_KEY = 'team-data-v2';

export async function GET() {
  try {
    const cached = await getCached<TeamMember[]>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    // Fetch users, open jobs, and status names in parallel
    const [usersData, openJobs, statusNames] = await Promise.all([
      primeGet('/users?per_page=200') as Promise<{ data?: RawUser[] }>,
      getAllOpenJobs() as Promise<RawJob[]>,
      getStatusNameMap(),
    ]);

    const users = usersData.data || [];

    const now = new Date();
    const nowMs = now.getTime();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Build per-user stats from open jobs
    const stats: Record<string, {
      openJobs: number;
      totalValue: number;
      updatedThisWeek: number;
      updatedThisMonth: number;
      regions: Set<string>;
      noReportCount: number;
      slaBreachCount: number;
      criticalSlaCount: number;
      daysOpenArr: number[];
    }> = {};

    for (const job of openJobs) {
      const assignedId = job.attributes?.assignedId;
      if (!assignedId) continue;

      if (!stats[assignedId]) {
        stats[assignedId] = {
          openJobs: 0,
          totalValue: 0,
          updatedThisWeek: 0,
          updatedThisMonth: 0,
          regions: new Set(),
          noReportCount: 0,
          slaBreachCount: 0,
          criticalSlaCount: 0,
          daysOpenArr: [],
        };
      }

      const s = stats[assignedId];
      s.openJobs++;
      s.totalValue += Number(job.attributes?.authorisedTotalIncludingTax || 0);

      if (job.attributes?.region) {
        s.regions.add(job.attributes.region);
      }

      if (job.attributes?.updatedAt) {
        const updatedAt = new Date(job.attributes.updatedAt);
        if (updatedAt >= weekStart) s.updatedThisWeek++;
        if (updatedAt >= monthStart) s.updatedThisMonth++;
      }

      // ── Age calculations ─────────────────────────────────────────────────
      const createdAt = job.attributes?.createdAt ?? '';
      const updatedAt = job.attributes?.updatedAt ?? '';
      const daysSinceCreated = createdAt
        ? Math.floor((nowMs - new Date(createdAt.replace(' ', 'T')).getTime()) / 86_400_000)
        : 0;
      const daysSinceUpdated = updatedAt
        ? Math.floor((nowMs - new Date(updatedAt.replace(' ', 'T')).getTime()) / 86_400_000)
        : 0;

      s.daysOpenArr.push(daysSinceCreated);

      // ── No-report check ──────────────────────────────────────────────────
      const statusId = job.attributes?.statusId ?? '';
      const statusName = statusNames[statusId] ?? '—';
      const category = categorise(statusName);

      if (category === 'NO_REPORT') {
        s.noReportCount++;
      }

      // ── SLA breach check (inline, mirrored from sla/route.ts) ────────────
      const authorisedTotal = Number(job.attributes?.authorisedTotalIncludingTax ?? 0);
      let isBreach = false;
      let daysOverdue = 0;

      if (category === 'NO_REPORT' || category === 'IN_PROGRESS') {
        daysOverdue = daysSinceCreated - 7;
        if (daysOverdue >= 0) isBreach = true;
      } else if (category === 'AUTHORISED' || category === 'SUBMITTED') {
        const slaDays = repairCommencementDays(authorisedTotal);
        daysOverdue = daysSinceCreated - slaDays;
        if (daysOverdue >= 0) isBreach = true;
      } else if (category === 'COMPLETED') {
        daysOverdue = daysSinceCreated - 7;
        if (daysOverdue >= 0) isBreach = true;
      } else if (daysSinceUpdated > 14) {
        // Stuck job rule
        daysOverdue = daysSinceUpdated - 14;
        isBreach = true;
      }

      if (isBreach) {
        s.slaBreachCount++;
        if (daysOverdue > 14) {
          s.criticalSlaCount++;
        }
      }
    }

    // Merge users with stats — only show active users OR users with open jobs
    const team: TeamMember[] = users
      .filter(u => u.attributes.status === 'active' || stats[u.id])
      .map(u => {
        const s = stats[u.id];
        const daysArr = s?.daysOpenArr ?? [];
        const avgDaysOpen = daysArr.length > 0
          ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length)
          : 0;
        const oldestJobDays = daysArr.length > 0 ? Math.max(...daysArr) : 0;

        return {
          id: u.id,
          name: u.attributes.fullName || `${u.attributes.firstName || ''} ${u.attributes.lastName || ''}`.trim(),
          email: u.attributes.email || '',
          status: u.attributes.status || 'unknown',
          roles: u.attributes.roles || [],
          openJobs: s?.openJobs || 0,
          totalAuthorisedValue: s?.totalValue || 0,
          updatedThisWeek: s?.updatedThisWeek || 0,
          updatedThisMonth: s?.updatedThisMonth || 0,
          regions: s ? Array.from(s.regions).sort() : [],
          noReportCount: s?.noReportCount || 0,
          slaBreachCount: s?.slaBreachCount || 0,
          criticalSlaCount: s?.criticalSlaCount || 0,
          avgDaysOpen,
          oldestJobDays,
        };
      })
      .sort((a, b) => b.openJobs - a.openJobs);

    await setCached(CACHE_KEY, team, 30 * 60 * 1000);
    return NextResponse.json(team);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
