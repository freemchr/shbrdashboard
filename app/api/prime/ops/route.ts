import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

export interface OpsJob {
  id: string;
  jobNumber: string;
  clientReference: string;
  description: string;
  address: string;
  status: string;
  jobType: string;
  region: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  createdBy: string;
  primeUrl: string;
  postcode: string;
  assignee: string;
  insurer: string;
}

type RawJob = {
  id: string;
  attributes?: {
    statusId?: string;
    jobNumber?: string;
    clientReference?: string;
    description?: string;
    address?: { addressLine1?: string; suburb?: string; state?: string; postcode?: string } | string;
    jobType?: string;
    region?: string;
    createdAt?: string;
    updatedAt?: string;
    updatedBy?: string;
    createdBy?: string;
    primeUrl?: string;
  };
};

function extractPostcode(address: string, rawAddress: unknown): string {
  // Try object first
  if (rawAddress && typeof rawAddress === 'object') {
    const addr = rawAddress as Record<string, string>;
    if (addr.postcode) return String(addr.postcode);
  }
  // Extract last 4-digit number from address string
  const matches = address.match(/\b(\d{4})\b/g);
  if (matches && matches.length > 0) return matches[matches.length - 1];
  return '';
}

function deriveInsurer(clientReference: string): string {
  const ref = (clientReference || '').toUpperCase();
  if (ref.startsWith('HOL')) return 'Hollard';
  if (ref.startsWith('YOU')) return 'Youi';
  if (ref.startsWith('SUN')) return 'Suncorp';
  if (ref.startsWith('QBE')) return 'QBE';
  if (ref.startsWith('AIR')) return 'Australian Insurance Reconstruction';
  if (ref.startsWith('GEM')) return 'Gemlife';
  return 'Other';
}

export async function GET() {
  try {
    const cacheKey = 'ops-data-v1';
    const cached = await getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [jobs, statusNames] = await Promise.all([getAllOpenJobs(), getStatusNameMap()]);

    const opsJobs: OpsJob[] = (jobs as RawJob[]).map(j => {
      const rawAddr = j.attributes?.address;
      const address =
        rawAddr && typeof rawAddr === 'object'
          ? [
              (rawAddr as Record<string, string>).addressLine1,
              (rawAddr as Record<string, string>).suburb,
              (rawAddr as Record<string, string>).state,
            ]
              .filter(Boolean)
              .join(', ')
          : String(rawAddr || '—');

      const clientReference = j.attributes?.clientReference || '';
      const statusName = statusNames[j.attributes?.statusId || ''] || '—';

      return {
        id: j.id,
        jobNumber: j.attributes?.jobNumber || j.id,
        clientReference,
        description: j.attributes?.description || '',
        address,
        status: statusName,
        jobType: j.attributes?.jobType || '—',
        region: j.attributes?.region || '—',
        createdAt: j.attributes?.createdAt || '',
        updatedAt: j.attributes?.updatedAt || '',
        updatedBy: j.attributes?.updatedBy || '',
        createdBy: j.attributes?.createdBy || '',
        primeUrl: j.attributes?.primeUrl || '',
        postcode: extractPostcode(address, rawAddr),
        assignee: j.attributes?.createdBy || '—',
        insurer: deriveInsurer(clientReference),
      };
    });

    // Action queues
    const needsAppointment = opsJobs.filter(j =>
      /appointment/i.test(j.status)
    );
    const awaitingTrade = opsJobs.filter(j =>
      /trade|specialist|report required/i.test(j.status)
    );
    const awaitingApproval = opsJobs.filter(j =>
      /approved|approval|wip/i.test(j.status)
    );

    const insurers = [...new Set(opsJobs.map(j => j.insurer))].sort();
    const assignees = [...new Set(opsJobs.map(j => j.assignee).filter(a => a && a !== '—'))].sort();

    const result = {
      jobs: opsJobs,
      insurers,
      assignees,
      actionQueues: {
        needsAppointment,
        awaitingTrade,
        awaitingApproval,
      },
      lastUpdated: new Date().toISOString(),
    };

    await setCached(cacheKey, result, 30 * 60 * 1000); // 30 minutes
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
