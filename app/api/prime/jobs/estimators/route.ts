/**
 * Estimator Dashboard API
 * Returns all users with open jobs, grouped by approval category:
 *   - 'atp'        : Approved / Authority to Proceed — works active
 *   - 'awaiting'   : Awaiting insurer approval / in their court
 *   - 'assessing'  : Assessment / scoping / reporting phase
 *
 * Each job now includes:
 *   - approvalCategory: 'atp' | 'awaiting' | 'assessing'
 *   - daysToFirstReport: days from createdAt → first status transition into a
 *     "submitted" state (approximated via updatedAt when status is submitted)
 *   - startDate / endDate: scheduled works dates from Prime
 */
import { NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Approval category helpers ────────────────────────────────────────────────

// Jobs where the insurer / client holds the ball
const AWAITING_APPROVAL_STATUSES = new Set([
  'awaiting approval',
  'awaiting client approval',
  'awaiting further instructions from insurer',
  'pending decision',
  'pending information',
  'pending builder',
  'pending builder strip out',
  'report submitted, awaiting directions',
  'report/quote sent',
  'secondary approval required',
  'secondary approval declined',
  'waiting atp with restoration works',
  'waiting signed sow',
  'with council',
  'on hold',
  'job on hold',
  'insured delay',
  'await sow & xs',
]);

// Jobs with ATP — active works underway
const ATP_ACTIVE_STATUSES = new Set([
  'approved job',
  'approved-awaiting maintenance',
  'approved-awaiting maintenance repairs',
  'works in progress',
  'works scheduled',
  'trades allocated',
  'trades to be allocated',
  'pending variation',
  'restoration sow approved',
  'await completion docs',
  'installation approved',
  'installation paused',
  'pending payment',
  'rectification in progress',
  'rectification required',
  'equipment onsite',
  'restorer allocated',
  'confirm repair completion',
  'satisfaction confirmed',
  'secondary approval received',
  'cash settled - prepare restoration invoice',
  'makesafe in progress',
  'makesafe only',
  'new makesafe',
  'plumbing check booked',
  'plumbing check completed',
  'plumbing check submitted',
  'plumbing install booked',
  'plumbing install completed',
  'plumbing install submitted',
]);

type ApprovalCategory = 'atp' | 'awaiting' | 'assessing';

function getApprovalCategory(statusName: string): ApprovalCategory {
  const s = statusName.toLowerCase().trim();
  if (ATP_ACTIVE_STATUSES.has(s)) return 'atp';
  if (AWAITING_APPROVAL_STATUSES.has(s)) return 'awaiting';
  return 'assessing';
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
    jobNumber?: string;
    clientReference?: string;
    description?: string;
    address?: { addressLine1?: string; suburb?: string; state?: string } | string;
    assignedId?: string;
    estimatorId?: string;
    statusId?: string;
    region?: string;
    jobType?: string;
    authorisedTotalIncludingTax?: number;
    createdAt?: string;
    updatedAt?: string;
    startDate?: string;
    endDate?: string;
    initialStartDate?: string;
    initialEndDate?: string;
    primeUrl?: string;
    filterTags?: string[];
  };
}

export interface EstimatorJob {
  id: string;
  jobNumber: string;
  clientReference: string;
  address: string;
  status: string;
  statusId: string;
  region: string;
  jobType: string;
  authorisedTotal: number;
  createdAt: string;
  updatedAt: string;
  daysOpen: number;           // days since createdAt
  daysToLastUpdate: number;   // days since last status change (updatedAt)
  startDate: string;          // scheduled works start
  endDate: string;            // scheduled works end
  primeUrl: string;
  approvalCategory: ApprovalCategory;
  tags: string[];
}

export interface EstimatorMember {
  id: string;
  name: string;
  email: string;
  totalJobs: number;
  totalValue: number;
  jobs: EstimatorJob[];
  jobsByStatus: Record<string, EstimatorJob[]>;
  // traffic light counts (by daysOpen)
  green: number;    // < 30 days
  amber: number;    // 30–59 days
  red: number;      // 60–89 days
  darkRed: number;  // 90+ days
  // approval category counts
  atpCount: number;
  awaitingCount: number;
  assessingCount: number;
  // report pipeline
  pendingReports: number;
  readyToSubmit: number;
  qualityReview: number;
  // avg days open per category
  avgDaysAtp: number;
  avgDaysAwaiting: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY = 'estimator-data-v6';

const PENDING_REPORT_STATUSES = new Set([
  'preparing initial report',
  'preparing final report',
  'preparing final report/costs',
  'preparing progress report',
  'preparing return attendance report',
  'estimate/ report being compiled',
  'initial report ready for submission',
  'progress report ready for submission',
  'return attendance report for submission',
  'ready for submission',
  'ready to submit',
  'external report pending',
  'initial documents submitted',
  'final documents submitted',
  'documents pending',
]);

const QUALITY_REVIEW_STATUSES = new Set([
  'quality review required',
  'peer review required',
]);

const READY_TO_SUBMIT_STATUSES = new Set([
  'initial report ready for submission',
  'progress report ready for submission',
  'return attendance report for submission',
  'ready for submission',
  'ready to submit',
  'final documents submitted',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr?: string): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const cached = await getCached<EstimatorMember[]>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const [usersData, openJobs, statusNames] = await Promise.all([
      primeGet('/users?per_page=200') as Promise<{ data?: RawUser[] }>,
      getAllOpenJobs() as Promise<RawJob[]>,
      getStatusNameMap(),
    ]);

    const userMap: Record<string, RawUser> = {};
    for (const u of (usersData.data || [])) userMap[u.id] = u;

    const jobsByUser: Record<string, EstimatorJob[]> = {};

    for (const job of openJobs) {
      const attrs = job.attributes as Record<string, unknown> | undefined;
      const estimatorId = attrs?.estimatorId as string | undefined;
      if (!estimatorId) continue;

      const addr = job.attributes?.address;
      const address = typeof addr === 'object' && addr
        ? [addr.addressLine1, addr.suburb, addr.state].filter(Boolean).join(', ')
        : String(addr || '—');

      const statusId = job.attributes?.statusId || '';
      const statusName = statusNames[statusId] || '—';
      const daysOpen = daysSince(job.attributes?.createdAt);
      const daysToLastUpdate = daysSince(job.attributes?.updatedAt);
      const approvalCategory = getApprovalCategory(statusName);

      const flat: EstimatorJob = {
        id: job.id,
        jobNumber: job.attributes?.jobNumber || job.id,
        clientReference: job.attributes?.clientReference || '',
        address,
        status: statusName,
        statusId,
        region: job.attributes?.region || '—',
        jobType: job.attributes?.jobType || '—',
        authorisedTotal: Number(job.attributes?.authorisedTotalIncludingTax || 0),
        createdAt: job.attributes?.createdAt || '',
        updatedAt: job.attributes?.updatedAt || '',
        daysOpen,
        daysToLastUpdate,
        startDate: job.attributes?.startDate || '',
        endDate: job.attributes?.endDate || '',
        primeUrl: job.attributes?.primeUrl || '',
        approvalCategory,
        tags: job.attributes?.filterTags || [],
      };

      if (!jobsByUser[estimatorId]) jobsByUser[estimatorId] = [];
      jobsByUser[estimatorId].push(flat);
    }

    const result: EstimatorMember[] = Object.keys(jobsByUser)
      .map(userId => {
        const u = userMap[userId];
        const name = u
          ? (u.attributes.fullName || `${u.attributes.firstName || ''} ${u.attributes.lastName || ''}`.trim())
          : userId;
        const email = u?.attributes.email || '';
        const jobs = (jobsByUser[userId] || []).sort((a, b) => b.daysOpen - a.daysOpen);

        const jobsByStatus: Record<string, EstimatorJob[]> = {};
        for (const job of jobs) {
          if (!jobsByStatus[job.status]) jobsByStatus[job.status] = [];
          jobsByStatus[job.status].push(job);
        }

        const green   = jobs.filter(j => j.daysOpen < 30).length;
        const amber   = jobs.filter(j => j.daysOpen >= 30 && j.daysOpen < 60).length;
        const red     = jobs.filter(j => j.daysOpen >= 60 && j.daysOpen < 90).length;
        const darkRed = jobs.filter(j => j.daysOpen >= 90).length;

        const atpJobs      = jobs.filter(j => j.approvalCategory === 'atp');
        const awaitingJobs = jobs.filter(j => j.approvalCategory === 'awaiting');
        const assessingJobs = jobs.filter(j => j.approvalCategory === 'assessing');

        const normalise = (s: string) => s.toLowerCase().trim();
        const pendingReports = jobs.filter(j => PENDING_REPORT_STATUSES.has(normalise(j.status))).length;
        const readyToSubmit  = jobs.filter(j => READY_TO_SUBMIT_STATUSES.has(normalise(j.status))).length;
        const qualityReview  = jobs.filter(j => QUALITY_REVIEW_STATUSES.has(normalise(j.status))).length;

        return {
          id: userId,
          name,
          email,
          totalJobs: jobs.length,
          totalValue: jobs.reduce((s, j) => s + j.authorisedTotal, 0),
          jobs,
          jobsByStatus,
          green,
          amber,
          red,
          darkRed,
          atpCount: atpJobs.length,
          awaitingCount: awaitingJobs.length,
          assessingCount: assessingJobs.length,
          pendingReports,
          readyToSubmit,
          qualityReview,
          avgDaysAtp: avg(atpJobs.map(j => j.daysOpen)),
          avgDaysAwaiting: avg(awaitingJobs.map(j => j.daysOpen)),
        };
      })
      .sort((a, b) => b.totalJobs - a.totalJobs);

    await setCached(CACHE_KEY, result, 4 * 60 * 60 * 1000);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
