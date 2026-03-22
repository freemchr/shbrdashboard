/**
 * Escape of Liquid / Flexi Hose Dashboard API
 *
 * Surfaces all jobs related to escape of liquid / water damage / flexi hose.
 * SHBR's competitive advantage is EOL expertise — this is Suncorp's #1 risk focus.
 */
import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { primeGet } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Keywords to match for EOL jobs (checked against peril name, description, notes)
const EOL_KEYWORDS = [
  'escape of liquid',
  'water damage',
  'water leak',
  'flood',
  'flexi hose',
  'flexi-hose',
  'flexihose',
  'plumbing',
  'burst pipe',
  'burst water',
  'eol',
  'leaking pipe',
  'pipe burst',
  'water ingress',
  'storm water',
  'stormwater',
  'sewage',
  'sewer',
];

// Statuses that indicate a completed job (for "completed this month" count)
const COMPLETED_STATUS_KEYWORDS = [
  'completed',
  'invoiced',
  'invoice',
  'closed',
  'finalised',
  'finalized',
];

export interface EolJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  assignee: string;
  region: string;
  daysOpen: number;
  createdAt: string;
  perilName: string;
  matchedOn: string; // 'peril' | 'description' | 'notes'
  primeUrl: string;
}

export interface EolStats {
  total: number;
  totalOpen: number;
  completedThisMonth: number;
  avgDaysOpen: number;
  percentOfPortfolio: number;
  byRegion: Record<string, number>;
}

export interface EolResponse {
  stats: EolStats;
  openJobs: EolJob[];
  generatedAt: string;
}

function isEolKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  for (const kw of EOL_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

function isCompletedStatus(status: string): boolean {
  const lower = status.toLowerCase();
  return COMPLETED_STATUS_KEYWORDS.some(kw => lower.includes(kw));
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
    perilId?: string;
    description?: string;
    notes?: string;
    primeUrl?: string;
  };
};

interface PerilData {
  data: { id: string; attributes: { name: string } }[];
}

async function getPerilNames(): Promise<Record<string, string>> {
  const cacheKey = 'peril-names-v1';
  const cached = await getCached<Record<string, string>>(cacheKey);
  if (cached) return cached;

  try {
    const data = await primeGet('/perils?per_page=200') as PerilData;
    const map: Record<string, string> = {};
    for (const p of data.data ?? []) {
      map[p.id] = p.attributes?.name ?? '';
    }
    await setCached(cacheKey, map, 24 * 60 * 60 * 1000); // 24h
    return map;
  } catch {
    return {};
  }
}

const CACHE_KEY = 'eol-jobs-v1';

export async function GET() {
  try {
    const cached = await getCached<EolResponse>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const [rawJobs, statusNames, perilNames] = await Promise.all([
      getAllOpenJobs(),
      getStatusNameMap(),
      getPerilNames(),
    ]);

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const openJobs: EolJob[] = [];
    let completedThisMonth = 0;
    const totalJobCount = rawJobs.length;

    for (const raw of rawJobs as RawJob[]) {
      const attrs = raw.attributes ?? {};
      const statusId = attrs.statusId ?? '';
      const status = statusNames[statusId] ?? '—';

      const perilId = attrs.perilId ?? '';
      const perilName = perilNames[perilId] ?? '';
      const description = attrs.description ?? '';
      const notes = attrs.notes ?? '';

      // Determine if this is an EOL job
      let matchedOn = '';
      if (isEolKeyword(perilName)) {
        matchedOn = 'peril';
      } else if (isEolKeyword(description)) {
        matchedOn = 'description';
      } else if (isEolKeyword(notes)) {
        matchedOn = 'notes';
      }

      if (!matchedOn) continue;

      const addrObj = attrs.address;
      const address = typeof addrObj === 'object' && addrObj
        ? [addrObj.addressLine1, addrObj.suburb, addrObj.state].filter(Boolean).join(', ')
        : String(addrObj ?? '—');

      const createdAt = attrs.createdAt ?? '';
      const createdDate = createdAt ? new Date(createdAt.replace(' ', 'T')) : now;
      const daysOpen = Math.floor((now.getTime() - createdDate.getTime()) / 86_400_000);
      const assignee = attrs.assignedTo ?? attrs.assignee ?? attrs.assignedStaff ?? attrs.updatedBy ?? '—';

      // Count completed this month
      if (isCompletedStatus(status) && createdDate >= firstOfMonth) {
        completedThisMonth++;
        continue; // don't add to open jobs
      }

      // Only add non-completed to openJobs
      if (!isCompletedStatus(status)) {
        openJobs.push({
          id: raw.id,
          jobNumber: attrs.jobNumber ?? raw.id,
          address,
          status,
          assignee,
          region: attrs.region ?? '—',
          daysOpen,
          createdAt,
          perilName,
          matchedOn,
          primeUrl: attrs.primeUrl ?? '',
        });
      }
    }

    // Sort open jobs by days open descending
    openJobs.sort((a, b) => b.daysOpen - a.daysOpen);

    // Compute stats
    const avgDaysOpen = openJobs.length > 0
      ? Math.round(openJobs.reduce((sum, j) => sum + j.daysOpen, 0) / openJobs.length)
      : 0;

    const byRegion: Record<string, number> = {};
    for (const job of openJobs) {
      byRegion[job.region] = (byRegion[job.region] ?? 0) + 1;
    }

    const total = openJobs.length + completedThisMonth;
    const percentOfPortfolio = totalJobCount > 0
      ? Math.round((total / totalJobCount) * 100 * 10) / 10
      : 0;

    const result: EolResponse = {
      stats: {
        total,
        totalOpen: openJobs.length,
        completedThisMonth,
        avgDaysOpen,
        percentOfPortfolio,
        byRegion,
      },
      openJobs,
      generatedAt: new Date().toISOString(),
    };

    await setCached(CACHE_KEY, result, 2 * 60 * 60 * 1000); // 2 hours
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
