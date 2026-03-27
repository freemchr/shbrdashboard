/**
 * SLA Risk Predictor API
 *
 * Finds open jobs NOT yet in breach but predicted to breach within 14 days.
 * Applies the same SLA rules as the SLA Breach Tracker, then scores each job
 * 0–100 based on progress through SLA, staleness, and proximity to breach.
 */
import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Status category sets (mirrored from sla/route.ts) ──────────────────────

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

export interface SlaPredictJob {
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
  daysUntilBreach: number;
  predictedBreachDate: string;
  riskScore: number;
  riskTier: 'critical' | 'high' | 'medium' | 'low';
  primeUrl: string;
}

export interface SlaPredictResponse {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  jobs: SlaPredictJob[];
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
  };
};

function computeRiskScore(params: {
  daysOpen: number;
  slaDays: number;
  daysSinceUpdated: number;
  category: StatusCategory;
}): number {
  const { daysOpen, slaDays, daysSinceUpdated, category } = params;

  // Component 1: SLA progress (0–50)
  const slaProgress = Math.min((daysOpen / slaDays) * 50, 50);

  // Component 2: Staleness (0–25)
  const staleness = Math.min((daysSinceUpdated / 7) * 25, 25);

  // Component 3: Category bonus
  let categoryBonus = 0;
  if (category === 'NO_REPORT' && daysOpen > 4) categoryBonus = 10;

  // Component 4: Projected breach boost
  const daysUntilBreach = slaDays - daysOpen;
  let breachBoost = 0;
  if (daysUntilBreach <= 7)  breachBoost = Math.max(0, 70 - (slaProgress + staleness + categoryBonus));
  else if (daysUntilBreach <= 14) breachBoost = Math.max(0, 50 - (slaProgress + staleness + categoryBonus));

  return Math.min(Math.round(slaProgress + staleness + categoryBonus + breachBoost), 100);
}

function riskTier(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

const CACHE_KEY = 'sla-predict-v1';

export async function GET() {
  try {
    const cached = await getCached<SlaPredictResponse>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const [rawJobs, statusNames] = await Promise.all([getAllOpenJobs(), getStatusNameMap()]);

    const now = Date.now();
    const jobs: SlaPredictJob[] = [];

    for (const raw of rawJobs as RawJob[]) {
      const attrs = raw.attributes ?? {};
      const statusId = attrs.statusId ?? '';
      const status = statusNames[statusId] ?? '—';
      const category = categorise(status);

      // Skip categories we don't track
      if (category === 'OTHER') continue;

      const addrObj = attrs.address;
      const address = typeof addrObj === 'object' && addrObj
        ? [addrObj.addressLine1, addrObj.suburb, addrObj.state].filter(Boolean).join(', ')
        : String(addrObj ?? '—');

      const createdAt = attrs.createdAt ?? '';
      const updatedAt = attrs.updatedAt ?? '';
      const authorisedTotal = Number(attrs.authorisedTotalIncludingTax ?? 0);
      const assignee = attrs.assignedTo ?? attrs.assignee ?? attrs.assignedStaff ?? attrs.updatedBy ?? '—';

      const daysSinceCreated = createdAt
        ? Math.floor((now - new Date(createdAt.replace(' ', 'T')).getTime()) / 86_400_000)
        : 0;
      const daysSinceUpdated = updatedAt
        ? Math.floor((now - new Date(updatedAt.replace(' ', 'T')).getTime()) / 86_400_000)
        : 0;

      // Determine SLA rule
      let slaDays = 7;
      let slaRule = 'Report >7 days';

      if (category === 'NO_REPORT' || category === 'IN_PROGRESS') {
        slaDays = 7;
        slaRule = 'Report SLA (7d)';
      } else if (category === 'AUTHORISED' || category === 'SUBMITTED') {
        slaDays = repairCommencementDays(authorisedTotal);
        const valueLabel = authorisedTotal < 10_000 ? 'Under $10k: 30d'
          : authorisedTotal < 20_000 ? 'Under $20k: 40d'
          : authorisedTotal < 50_000 ? 'Under $50k: 50d'
          : '$50k+: 70d';
        slaRule = `Repair ${valueLabel}`;
      } else if (category === 'COMPLETED') {
        slaDays = 7;
        slaRule = 'Invoice SLA (7d)';
      }

      const daysUntilBreach = slaDays - daysSinceCreated;

      // Skip jobs already in breach (they belong in the SLA Tracker)
      if (daysUntilBreach <= 0) continue;

      // Skip if clearly outside 14-day prediction window (fast path)
      if (daysUntilBreach > 14) {
        // Still compute score, but only include if score >= 30
        const score = computeRiskScore({
          daysOpen: daysSinceCreated,
          slaDays,
          daysSinceUpdated,
          category,
        });
        if (score < 30) continue;
      }

      const score = computeRiskScore({
        daysOpen: daysSinceCreated,
        slaDays,
        daysSinceUpdated,
        category,
      });

      if (score < 30) continue;

      // Compute predicted breach date
      const createdDate = createdAt
        ? new Date(createdAt.replace(' ', 'T'))
        : new Date(now - daysSinceCreated * 86_400_000);
      const predictedBreachDate = new Date(createdDate.getTime() + slaDays * 86_400_000).toISOString();

      jobs.push({
        id: raw.id,
        jobNumber: attrs.jobNumber ?? raw.id,
        address,
        status,
        jobType: attrs.jobType ?? '—',
        region: attrs.region ?? '—',
        assignee,
        authorisedTotal,
        createdAt,
        daysSinceCreated,
        daysSinceUpdated,
        slaRule,
        slaDays,
        daysUntilBreach,
        predictedBreachDate,
        riskScore: score,
        riskTier: riskTier(score),
        primeUrl: attrs.primeUrl ?? '',
      });
    }

    // Sort by risk score descending
    jobs.sort((a, b) => b.riskScore - a.riskScore || a.daysUntilBreach - b.daysUntilBreach);

    const summary = {
      total: jobs.length,
      critical: jobs.filter(j => j.riskTier === 'critical').length,
      high: jobs.filter(j => j.riskTier === 'high').length,
      medium: jobs.filter(j => j.riskTier === 'medium').length,
      low: jobs.filter(j => j.riskTier === 'low').length,
    };

    const result: SlaPredictResponse = {
      summary,
      jobs,
      generatedAt: new Date().toISOString(),
    };

    await setCached(CACHE_KEY, result, 2 * 60 * 60 * 1000); // 2 hours
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
