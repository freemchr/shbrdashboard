/**
 * Missing Build Schedules API
 *
 * Returns jobs in "repair/build phase" statuses that are missing a schedule
 * (startDate is null/empty) and have been in that status for >2 business days.
 *
 * This is a Suncorp KPI — builders must submit a schedule when works are authorised.
 */
import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Repair-phase status keywords — jobs in these statuses must have a schedule
const REPAIR_PHASE_KEYWORDS = [
  'repair',
  'build',
  'works',
  'construction',
  'in progress',
  'commenced',
  'authorised',
  'authorized',
  'trade booked',
  'trade completed',
  'awaiting trade',
  'materials',
  'partial works',
  'on hold',
  'awaiting parts',
];

function isRepairPhaseStatus(status: string): boolean {
  const lower = status.toLowerCase();
  return REPAIR_PHASE_KEYWORDS.some(kw => lower.includes(kw));
}

/** Count business days between two dates (Mon–Fri, no public holidays) */
function businessDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export interface ScheduleJobEntry {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  assignee: string;
  region: string;
  daysSinceCreated: number;
  businessDaysSinceAllocated: number;
  allocatedDate: string;
  startDate: string | null;
  primeUrl: string;
  missing: boolean; // true = definitely missing schedule, false = at risk (approaching threshold)
}

export interface SchedulesResponse {
  total: number;
  missing: ScheduleJobEntry[];
  atRisk: ScheduleJobEntry[];
  generatedAt: string;
}

type RawJob = {
  id: string;
  attributes?: {
    statusId?: string;
    jobNumber?: string;
    address?: { addressLine1?: string; suburb?: string; state?: string } | string;
    region?: string;
    assignedTo?: string;
    assignee?: string;
    assignedStaff?: string;
    updatedBy?: string;
    createdAt?: string;
    allocatedDate?: string;
    startDate?: string | null;
    primeUrl?: string;
  };
};

const CACHE_KEY = 'schedules-missing-v1';

export async function GET() {
  try {
    const cached = await getCached<SchedulesResponse>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const [rawJobs, statusNames] = await Promise.all([getAllOpenJobs(), getStatusNameMap()]);

    const now = new Date();
    const missing: ScheduleJobEntry[] = [];
    const atRisk: ScheduleJobEntry[] = [];

    for (const raw of rawJobs as RawJob[]) {
      const attrs = raw.attributes ?? {};
      const statusId = attrs.statusId ?? '';
      const status = statusNames[statusId] ?? '';

      if (!isRepairPhaseStatus(status)) continue;

      // Check if startDate is missing
      const startDate = attrs.startDate ?? null;
      const hasSchedule = startDate && startDate.trim() !== '';
      if (hasSchedule) continue;

      const addrObj = attrs.address;
      const address = typeof addrObj === 'object' && addrObj
        ? [addrObj.addressLine1, addrObj.suburb, addrObj.state].filter(Boolean).join(', ')
        : String(addrObj ?? '—');

      const createdAt = attrs.createdAt ?? '';
      const allocatedDate = attrs.allocatedDate ?? createdAt;
      const assignee = attrs.assignedTo ?? attrs.assignee ?? attrs.assignedStaff ?? attrs.updatedBy ?? '—';

      const createdDate = createdAt ? new Date(createdAt.replace(' ', 'T')) : now;
      const allocDate = allocatedDate ? new Date(allocatedDate.replace(' ', 'T')) : createdDate;

      const daysSinceCreated = Math.floor((now.getTime() - createdDate.getTime()) / 86_400_000);
      const businessDaysSinceAllocated = businessDaysBetween(allocDate, now);

      const entry: ScheduleJobEntry = {
        id: raw.id,
        jobNumber: attrs.jobNumber ?? raw.id,
        address,
        status,
        assignee,
        region: attrs.region ?? '—',
        daysSinceCreated,
        businessDaysSinceAllocated,
        allocatedDate: allocatedDate,
        startDate: startDate,
        primeUrl: attrs.primeUrl ?? '',
        missing: businessDaysSinceAllocated > 2,
      };

      if (businessDaysSinceAllocated > 2) {
        missing.push(entry);
      } else if (businessDaysSinceAllocated >= 1) {
        atRisk.push(entry);
      }
    }

    // Sort by business days descending
    missing.sort((a, b) => b.businessDaysSinceAllocated - a.businessDaysSinceAllocated);
    atRisk.sort((a, b) => b.businessDaysSinceAllocated - a.businessDaysSinceAllocated);

    const result: SchedulesResponse = {
      total: missing.length + atRisk.length,
      missing,
      atRisk,
      generatedAt: new Date().toISOString(),
    };

    await setCached(CACHE_KEY, result, 2 * 60 * 60 * 1000); // 2 hours
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
