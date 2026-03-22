/**
 * Vulnerable Customer Flag API
 *
 * Scans all open jobs for keywords indicating a vulnerable customer.
 * Suncorp requires builders to flag vulnerable customers to them.
 */
import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VULNERABLE_KEYWORDS = [
  'vulnerable',
  'elderly',
  'disability',
  'mental health',
  'hardship',
  'special needs',
  'domestic violence',
  'financial hardship',
  'aged care',
  'wheelchair',
  'dementia',
  'carer',
  'caregiver',
];

export interface VulnerableJob {
  id: string;
  jobNumber: string;
  address: string;
  assignee: string;
  region: string;
  status: string;
  matchedKeyword: string;
  notes: string; // first 200 chars
  primeUrl: string;
}

export interface VulnerableResponse {
  total: number;
  jobs: VulnerableJob[];
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
    notes?: string;
    description?: string;
    filterTags?: string[];
    primeUrl?: string;
  };
};

function findVulnerableKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  for (const kw of VULNERABLE_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

const CACHE_KEY = 'vulnerable-customers-v1';

export async function GET() {
  try {
    const cached = await getCached<VulnerableResponse>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const [rawJobs, statusNames] = await Promise.all([getAllOpenJobs(), getStatusNameMap()]);

    const jobs: VulnerableJob[] = [];

    for (const raw of rawJobs as RawJob[]) {
      const attrs = raw.attributes ?? {};
      const statusId = attrs.statusId ?? '';
      const status = statusNames[statusId] ?? '—';

      const notes = attrs.notes ?? '';
      const description = attrs.description ?? '';
      const filterTags = (attrs.filterTags ?? []).join(' ');

      // Search all text fields
      const allText = [notes, description, filterTags].join(' ');
      const matchedKeyword = findVulnerableKeyword(allText);
      if (!matchedKeyword) continue;

      const addrObj = attrs.address;
      const address = typeof addrObj === 'object' && addrObj
        ? [addrObj.addressLine1, addrObj.suburb, addrObj.state].filter(Boolean).join(', ')
        : String(addrObj ?? '—');

      const assignee = attrs.assignedTo ?? attrs.assignee ?? attrs.assignedStaff ?? attrs.updatedBy ?? '—';

      // Avoid duplicates (same job can match multiple keywords — take first match)
      if (jobs.some(j => j.id === raw.id)) continue;

      jobs.push({
        id: raw.id,
        jobNumber: attrs.jobNumber ?? raw.id,
        address,
        assignee,
        region: attrs.region ?? '—',
        status,
        matchedKeyword,
        notes: allText.trim().slice(0, 200),
        primeUrl: attrs.primeUrl ?? '',
      });
    }

    const result: VulnerableResponse = {
      total: jobs.length,
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
