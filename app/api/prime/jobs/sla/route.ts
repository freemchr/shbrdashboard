/**
 * SLA Breach Tracker API
 *
 * Analyses all open jobs against Stella's KPI SLA rules and returns a list of
 * breaches / at-risk jobs with severity ratings.
 *
 * SLA Rules:
 * - Report submission:   jobs in NO_REPORT / IN_PROGRESS categories >7 days old = BREACH
 * - Repair commencement: based on authorised value (30/40/50/70 days)
 * - Invoice submission:  completed-type jobs >7 days old = BREACH
 * - Stuck jobs:          open jobs not updated in >14 days = WARNING
 */
import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Status category sets (mirrored from reports route) ───────────────────────

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

// Statuses indicating works are authorised / in progress (post-report pre-invoice)
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

// Statuses indicating work is complete but invoice not submitted
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

/** SLA target days for repair commencement based on authorised value */
function repairCommencementDays(authorisedTotal: number): number {
  if (authorisedTotal < 10_000) return 30;
  if (authorisedTotal < 20_000) return 40;
  if (authorisedTotal < 50_000) return 50;
  return 70; // $50k–$100k+ bracket
}

export interface SlaBreachJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  jobType: string;
  region: string;
  assignee: string;
  authorisedTotal: number;
  createdAt: string;
  daysSinceCreated: number;
  daysSinceUpdated: number;
  slaRule: string;
  slaDays: number;
  daysOverdue: number;
  severity: 'critical' | 'warning' | 'at_risk';
  primeUrl: string;
  // Date fields — populated when entered in Prime
  startDate: string | null;
  endDate: string | null;
  allocatedDate: string | null;
  missingDates: boolean; // true if startDate or endDate is absent
}

export interface SlaSummary {
  totalBreaches: number;
  critical: number;
  warning: number;
  atRisk: number;
}

export interface SlaResponse {
  summary: SlaSummary;
  breaches: SlaBreachJob[];
  generatedAt: string;
}

type RawJob = {
  id: string;
  attributes?: {
    statusId?: string;
    jobNumber?: string;
    address?: { addressLine1?: string; suburb?: string; state?: string } | string;
    jobType?: string;
    region?: string;
    assignedTo?: string;
    assignee?: string;
    assignedStaff?: string;
    authorisedTotalIncludingTax?: number | string;
    createdAt?: string;
    updatedAt?: string;
    updatedBy?: string;
    primeUrl?: string;
    startDate?: string | null;
    endDate?: string | null;
    allocatedDate?: string | null;
  };
};

function severity(daysOverdue: number): 'critical' | 'warning' | 'at_risk' {
  if (daysOverdue > 14) return 'critical';
  if (daysOverdue > 0)  return 'warning';
  return 'at_risk';
}

const CACHE_KEY = 'sla-breaches-v1';

export async function GET() {
  try {
    const cached = await getCached<SlaResponse>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const [rawJobs, statusNames] = await Promise.all([getAllOpenJobs(), getStatusNameMap()]);

    const now = Date.now();
    const breaches: SlaBreachJob[] = [];

    for (const raw of rawJobs as RawJob[]) {
      const attrs = raw.attributes ?? {};
      const statusId = attrs.statusId ?? '';
      const status = statusNames[statusId] ?? '—';
      const category = categorise(status);

      const addrObj = attrs.address;
      const address = typeof addrObj === 'object' && addrObj
        ? [addrObj.addressLine1, addrObj.suburb, addrObj.state].filter(Boolean).join(', ')
        : String(addrObj ?? '—');

      const createdAt  = attrs.createdAt  ?? '';
      const updatedAt  = attrs.updatedAt  ?? '';
      const authorisedTotal = Number(attrs.authorisedTotalIncludingTax ?? 0);
      const assignee = attrs.assignedTo ?? attrs.assignee ?? attrs.assignedStaff ?? attrs.updatedBy ?? '—';

      const daysSinceCreated = createdAt
        ? Math.floor((now - new Date(createdAt.replace(' ', 'T')).getTime()) / 86_400_000)
        : 0;
      const daysSinceUpdated = updatedAt
        ? Math.floor((now - new Date(updatedAt.replace(' ', 'T')).getTime()) / 86_400_000)
        : 0;

      const startDate    = attrs.startDate    ?? null;
      const endDate      = attrs.endDate      ?? null;
      const allocatedDate = attrs.allocatedDate ?? null;
      const missingDates = !startDate || !endDate;

      const base = {
        id:            raw.id,
        jobNumber:     attrs.jobNumber ?? raw.id,
        address,
        status,
        jobType:       attrs.jobType  ?? '—',
        region:        attrs.region   ?? '—',
        assignee,
        authorisedTotal,
        createdAt,
        daysSinceCreated,
        daysSinceUpdated,
        primeUrl:      attrs.primeUrl ?? '',
        startDate,
        endDate,
        allocatedDate,
        missingDates,
      };

      // ── Rule 1: Report submission SLA (>7 calendar days) ─────────────────
      if (category === 'NO_REPORT' || category === 'IN_PROGRESS') {
        const slaDays   = 7;
        const daysOverdue = daysSinceCreated - slaDays;
        if (daysOverdue > -3) { // breach or within 3 days of breach
          breaches.push({
            ...base,
            slaRule:   `Report >7 days`,
            slaDays,
            daysOverdue: Math.max(daysOverdue, 0),
            severity:  daysOverdue >= 0 ? severity(daysOverdue) : 'at_risk',
          });
          continue;
        }
      }

      // ── Rule 2: Repair commencement SLA (value-based) ────────────────────
      if (category === 'AUTHORISED' || category === 'SUBMITTED') {
        const slaDays     = repairCommencementDays(authorisedTotal);
        const daysOverdue = daysSinceCreated - slaDays;
        const valueLabel  = authorisedTotal < 10_000 ? 'Under $10k: 30d'
                          : authorisedTotal < 20_000 ? 'Under $20k: 40d'
                          : authorisedTotal < 50_000 ? 'Under $50k: 50d'
                          : '$50k+: 70d';
        if (daysOverdue > -3) {
          breaches.push({
            ...base,
            slaRule:   `Repair ${valueLabel}`,
            slaDays,
            daysOverdue: Math.max(daysOverdue, 0),
            severity:  daysOverdue >= 0 ? severity(daysOverdue) : 'at_risk',
          });
          continue;
        }
      }

      // ── Rule 3: Invoice submission SLA (completed >7 days) ───────────────
      if (category === 'COMPLETED') {
        const slaDays   = 7;
        const daysOverdue = daysSinceCreated - slaDays;
        if (daysOverdue > -3) {
          breaches.push({
            ...base,
            slaRule:   `Invoice >7 days`,
            slaDays,
            daysOverdue: Math.max(daysOverdue, 0),
            severity:  daysOverdue >= 0 ? severity(daysOverdue) : 'at_risk',
          });
          continue;
        }
      }

      // ── Rule 4: General stuck job (not updated in >14 days) ─────────────
      if (daysSinceUpdated > 14) {
        breaches.push({
          ...base,
          slaRule:   `Stuck >14 days`,
          slaDays:   14,
          daysOverdue: daysSinceUpdated - 14,
          severity:  severity(daysSinceUpdated - 14),
        });
      }
    }

    // Sort by severity then days overdue
    const severityOrder = { critical: 0, warning: 1, at_risk: 2 };
    breaches.sort((a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      b.daysOverdue - a.daysOverdue
    );

    const summary: SlaSummary = {
      totalBreaches: breaches.length,
      critical:  breaches.filter(b => b.severity === 'critical').length,
      warning:   breaches.filter(b => b.severity === 'warning').length,
      atRisk:    breaches.filter(b => b.severity === 'at_risk').length,
    };

    const result: SlaResponse = {
      summary,
      breaches,
      generatedAt: new Date().toISOString(),
    };

    await setCached(CACHE_KEY, result, 2 * 60 * 60 * 1000); // 2 hours
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
