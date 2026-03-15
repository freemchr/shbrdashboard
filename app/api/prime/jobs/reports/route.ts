/**
 * Report status API — categorises all open jobs by where they sit in the report lifecycle.
 *
 * Categories:
 * - NO_REPORT:   Job exists but no report has been started. CRITICAL — no report = no payment.
 * - IN_PROGRESS: Report is being prepared or assessment is booked/underway.
 * - SUBMITTED:   Report submitted to insurer / quote sent. Waiting on response/approval.
 * - POST_REPORT: Past the report stage — works authorised, in progress, invoicing etc.
 */
import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

export type ReportCategory = 'NO_REPORT' | 'IN_PROGRESS' | 'SUBMITTED' | 'POST_REPORT';

export interface ReportJob {
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
  daysSinceCreated: number;
  daysSinceUpdated: number;
  primeUrl: string;
  category: ReportCategory;
}

export interface ReportSummary {
  total: number;
  noReport: number;
  inProgress: number;
  submitted: number;
  postReport: number;
  noReportJobs: ReportJob[];
  inProgressJobs: ReportJob[];
  submittedJobs: ReportJob[];
}

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

function categorise(status: string): ReportCategory {
  const s = status.toLowerCase().trim();
  if (NO_REPORT_STATUSES.has(s))  return 'NO_REPORT';
  if (IN_PROGRESS_STATUSES.has(s)) return 'IN_PROGRESS';
  if (SUBMITTED_STATUSES.has(s))   return 'SUBMITTED';
  return 'POST_REPORT';
}

const CACHE_KEY = 'report-status-v1';

export async function GET() {
  try {
    const cached = await getCached<ReportSummary>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const [rawJobs, statusNames] = await Promise.all([getAllOpenJobs(), getStatusNameMap()]);

    type RawJob = {
      id: string;
      attributes?: {
        statusId?: string;
        jobNumber?: string;
        address?: { addressLine1?: string; suburb?: string; state?: string } | string;
        jobType?: string;
        region?: string;
        authorisedTotalIncludingTax?: number | string;
        createdAt?: string;
        updatedAt?: string;
        updatedBy?: string;
        primeUrl?: string;
      };
    };

    const now = Date.now();

    const toJob = (j: RawJob, category: ReportCategory): ReportJob => {
      const addr = j.attributes?.address;
      const address = typeof addr === 'object' && addr
        ? [addr.addressLine1, addr.suburb, addr.state].filter(Boolean).join(', ')
        : String(addr || '—');
      const createdAt = j.attributes?.createdAt || '';
      const updatedAt = j.attributes?.updatedAt || '';
      const status = statusNames[j.attributes?.statusId || ''] || '—';
      return {
        id: j.id,
        jobNumber: j.attributes?.jobNumber || j.id,
        address,
        status,
        jobType: j.attributes?.jobType || '—',
        region: j.attributes?.region || '—',
        authorisedTotal: Number(j.attributes?.authorisedTotalIncludingTax || 0),
        createdAt,
        updatedAt,
        updatedBy: j.attributes?.updatedBy || '',
        daysSinceCreated: createdAt ? Math.floor((now - new Date(createdAt.replace(' ', 'T')).getTime()) / 86400000) : 0,
        daysSinceUpdated: updatedAt ? Math.floor((now - new Date(updatedAt.replace(' ', 'T')).getTime()) / 86400000) : 0,
        primeUrl: j.attributes?.primeUrl || '',
        category,
      };
    };

    const noReportJobs: ReportJob[] = [];
    const inProgressJobs: ReportJob[] = [];
    const submittedJobs: ReportJob[] = [];

    for (const raw of rawJobs as RawJob[]) {
      const status = statusNames[raw.attributes?.statusId || ''] || '—';
      const cat = categorise(status);
      if (cat === 'NO_REPORT')   noReportJobs.push(toJob(raw, cat));
      if (cat === 'IN_PROGRESS') inProgressJobs.push(toJob(raw, cat));
      if (cat === 'SUBMITTED')   submittedJobs.push(toJob(raw, cat));
    }

    // Sort no-report by oldest created first (most urgent)
    noReportJobs.sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);
    inProgressJobs.sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);
    submittedJobs.sort((a, b) => b.daysSinceUpdated - a.daysSinceUpdated);

    const result: ReportSummary = {
      total: (rawJobs as RawJob[]).length,
      noReport: noReportJobs.length,
      inProgress: inProgressJobs.length,
      submitted: submittedJobs.length,
      postReport: (rawJobs as RawJob[]).length - noReportJobs.length - inProgressJobs.length - submittedJobs.length,
      noReportJobs,
      inProgressJobs,
      submittedJobs,
    };

    await setCached(CACHE_KEY, result, 30 * 60 * 1000);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
