/**
 * GET /api/prime/team/jobs?memberId=<id>&filter=<all|no_report|sla|open>
 *
 * Returns the open jobs for a specific team member, optionally filtered by
 * category (all open, no-report, or SLA-breaching).
 *
 * Reuses the same status-category logic as team/route.ts so counts are consistent.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Status sets (mirrors team/route.ts) ─────────────────────────────────────

const NO_REPORT_STATUSES = new Set([
  'new enquiry','appointment required','appointment booked','appointment completed',
  'initial attendance required','initial attendance booked','initial attendance completed',
  'assessment booking required','booking required','appt tbc','customer contacted',
  'trade/specialist report required','specialist report requested','external report pending',
  'consultant required','engineer required','secondary appointment required',
  'secondary appointment booked','secondary appointment completed',
  'return attendance to be booked','return attendance booked',
]);
const IN_PROGRESS_STATUSES = new Set([
  'preparing initial report','estimate/ report being compiled','preparing progress report',
  'preparing final report/costs','preparing return attendance report','first assessment booked',
  'first assessment completed','second assessment booked','second assessment completed',
  'third assessment booked','third assessment completed','fourth assessment booked',
  'fourth assessment completed','fifth assessment booked','fifth assessment completed',
  'plumbing check booked','plumbing check completed','plumbing install booked',
  'plumbing install completed','quality review required','peer review required',
]);
const SUBMITTED_STATUSES = new Set([
  'initial report submitted','initial report ready for submission','first assessment submitted',
  'second assessment submitted','third assessment submitted','fourth assessment submitted',
  'fifth assessment submitted','final report submitted','progress report ready for submission',
  'ready to submit','report submitted, awaiting directions','return attendance report for submission',
  'initial documents submitted','final documents submitted','plumbing check submitted',
  'plumbing install submitted','report/quote sent','ready to quote','ready to invoice',
  'preparing for invoicing','awaiting client approval','secondary approval required',
  'secondary approval received','secondary approval declined',
]);
const AUTHORISED_STATUSES = new Set([
  'works authorised','works in progress','works authorised - awaiting trade','awaiting trade',
  'trade booked','trade completed','partial works completed','waiting for materials',
  'works on hold','awaiting parts',
]);
const COMPLETED_STATUSES = new Set([
  'works completed','job completed','completed - awaiting invoice','awaiting final invoice',
  'ready to invoice','final inspection required','final inspection completed',
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawJob {
  id: string;
  attributes?: {
    assignedId?: string;
    statusId?: string;
    jobNumber?: string;
    clientReference?: string;
    address?: { addressLine1?: string; suburb?: string; state?: string } | string;
    jobType?: string;
    region?: string;
    authorisedTotalIncludingTax?: number;
    createdAt?: string;
    updatedAt?: string;
    updatedBy?: string;
    primeUrl?: string;
  };
}

export interface TeamMemberJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  jobType: string;
  region: string;
  authorisedTotal: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  daysOpen: number;
  daysSinceUpdated: number;
  primeUrl: string;
  category: StatusCategory;
  isSlaBreaching: boolean;
  daysOverdue: number;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('memberId');
  const filter   = searchParams.get('filter') ?? 'all'; // all | no_report | sla

  if (!memberId) {
    return NextResponse.json({ error: 'memberId required' }, { status: 400 });
  }

  try {
    // Use cached open jobs if available (same cache as /api/prime/jobs/open)
    type CachedFlat = { id: string; status: string; jobNumber: string; address: string; jobType: string; region: string; authorisedTotal: number; createdAt: string; updatedAt: string; updatedBy: string; primeUrl: string; };
    const cachedFlat = await getCached<CachedFlat[]>('open-jobs-flat-v3');

    const nowMs = Date.now();

    let jobs: TeamMemberJob[];

    if (cachedFlat) {
      // We don't have assignedId in the flat cache — need raw jobs for that
      // Fall through to raw fetch below
    }

    // Always use raw jobs so we have assignedId
    const [rawJobs, statusNames] = await Promise.all([
      getAllOpenJobs() as Promise<RawJob[]>,
      getStatusNameMap(),
    ]);

    const memberJobs = rawJobs.filter(j => j.attributes?.assignedId === memberId);

    jobs = memberJobs.map(j => {
      const attrs = j.attributes ?? {};
      const addr = attrs.address;
      const address = typeof addr === 'object' && addr
        ? [addr.addressLine1, addr.suburb, addr.state].filter(Boolean).join(', ')
        : String(addr || '—');

      const statusName = statusNames[attrs.statusId ?? ''] ?? '—';
      const category = categorise(statusName);
      const authorisedTotal = Number(attrs.authorisedTotalIncludingTax ?? 0);

      const createdAt = attrs.createdAt ?? '';
      const updatedAt = attrs.updatedAt ?? '';
      const daysOpen = createdAt
        ? Math.floor((nowMs - new Date(createdAt.replace(' ', 'T')).getTime()) / 86_400_000)
        : 0;
      const daysSinceUpdated = updatedAt
        ? Math.floor((nowMs - new Date(updatedAt.replace(' ', 'T')).getTime()) / 86_400_000)
        : 0;

      // SLA breach logic (mirrors team/route.ts)
      let isSlaBreaching = false;
      let daysOverdue = 0;
      if (category === 'NO_REPORT' || category === 'IN_PROGRESS') {
        daysOverdue = daysOpen - 7;
        if (daysOverdue >= 0) isSlaBreaching = true;
      } else if (category === 'AUTHORISED' || category === 'SUBMITTED') {
        const slaDays = repairCommencementDays(authorisedTotal);
        daysOverdue = daysOpen - slaDays;
        if (daysOverdue >= 0) isSlaBreaching = true;
      } else if (category === 'COMPLETED') {
        daysOverdue = daysOpen - 7;
        if (daysOverdue >= 0) isSlaBreaching = true;
      } else if (daysSinceUpdated > 14) {
        daysOverdue = daysSinceUpdated - 14;
        isSlaBreaching = true;
      }

      return {
        id: j.id,
        jobNumber: attrs.jobNumber ?? j.id,
        address,
        status: statusName,
        jobType: attrs.jobType ?? '—',
        region: attrs.region ?? '—',
        authorisedTotal,
        createdAt,
        updatedAt,
        updatedBy: attrs.updatedBy ?? '—',
        daysOpen,
        daysSinceUpdated,
        primeUrl: attrs.primeUrl ?? '',
        category,
        isSlaBreaching,
        daysOverdue,
      };
    });

    // Apply filter
    if (filter === 'no_report') {
      jobs = jobs.filter(j => j.category === 'NO_REPORT');
    } else if (filter === 'sla') {
      jobs = jobs.filter(j => j.isSlaBreaching);
    }
    // filter === 'all' → return all

    // Sort by days open descending
    jobs.sort((a, b) => b.daysOpen - a.daysOpen);

    return NextResponse.json(jobs);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
