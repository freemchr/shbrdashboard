import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';
import { primeGetAllPages } from '@/lib/prime-auth';

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

function deriveInsurer(jobNumber: string): string {
  const num = (jobNumber || '').toUpperCase();
  if (num.startsWith('SUN')) return 'Suncorp';
  if (num.startsWith('CBA')) return 'CommInsure';
  if (num.startsWith('AG')) return 'Allianz';
  if (num.startsWith('CC')) return 'CommCover';
  if (num.startsWith('HOL')) return 'Hollard';
  if (num.startsWith('YOU')) return 'Youi';
  if (num.startsWith('QBE')) return 'QBE';
  if (num.startsWith('ABE')) return 'ABE';
  return 'Other';
}

async function getUserMap(): Promise<Record<string, string>> {
  try {
    const users = await primeGetAllPages('/users?per_page=100') as {
      id: string;
      attributes?: { fullName?: string; status?: string };
    }[];
    return Object.fromEntries(
      users.map(u => [u.id, u.attributes?.fullName || u.id])
    );
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const cacheKey = 'ops-data-v3';
    const cached = await getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [jobs, statusNames, userMap] = await Promise.all([
      getAllOpenJobs(),
      getStatusNameMap(),
      getUserMap(),
    ]);

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

      // Resolve assignee from assignedId → user name (falls back to updatedBy if not found)
      const assignedId = (j.attributes as Record<string, string> | undefined)?.assignedId || '';
      const assignee = (assignedId && userMap[assignedId]) || j.attributes?.updatedBy || '—';

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
        assignee,
        insurer: deriveInsurer(j.attributes?.jobNumber || ''),
      };
    });

    // Action queues — appointment split into two separate buckets
    const appointmentRequired = opsJobs.filter(j =>
      /^appointment required$/i.test(j.status.trim()) ||
      /^appt required$/i.test(j.status.trim())
    );
    const apptTBC = opsJobs.filter(j =>
      /^appt tbc$/i.test(j.status.trim()) ||
      /^appointment tbc$/i.test(j.status.trim())
    );
    // Legacy combined bucket (still used for the action badge / queue filter)
    const needsAppointment = [...appointmentRequired, ...apptTBC];

    const awaitingTrade = opsJobs.filter(j =>
      /trade|specialist|report required/i.test(j.status)
    );
    const awaitingApproval = opsJobs.filter(j =>
      /approved|approval|wip/i.test(j.status)
    );

    const insurers = Array.from(new Set(opsJobs.map(j => j.insurer))).sort();
    const assignees = Array.from(new Set(opsJobs.map(j => j.assignee).filter(a => a && a !== '—'))).sort();

    const result = {
      jobs: opsJobs,
      insurers,
      assignees,
      actionQueues: {
        needsAppointment,
        appointmentRequired,
        apptTBC,
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
