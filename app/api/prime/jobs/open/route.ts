import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  try {
    const cacheKey = 'open-jobs-flat-v3';
    const cached = await getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [jobs, statusNames] = await Promise.all([getAllOpenJobs(), getStatusNameMap()]);

    type RawJob = {
      id: string;
      attributes?: {
        statusId?: string;
        jobNumber?: string;
        clientReference?: string;
        description?: string;
        address?: { addressLine1?: string; suburb?: string; state?: string } | string;
        jobType?: string;
        region?: string;
        authorisedTotalIncludingTax?: number;
        createdAt?: string;
        updatedAt?: string;
        updatedBy?: string;
        createdBy?: string;
        primeUrl?: string;
      };
    };

    const flat = (jobs as RawJob[]).map(j => {
      const addr = j.attributes?.address;
      const address = typeof addr === 'object' && addr
        ? [addr.addressLine1, addr.suburb, addr.state].filter(Boolean).join(', ')
        : String(addr || '—');
      return {
        id: j.id,
        jobNumber: j.attributes?.jobNumber || j.id,
        clientReference: j.attributes?.clientReference || '',
        description: j.attributes?.description || '',
        address,
        status: statusNames[j.attributes?.statusId || ''] || '—',
        jobType: j.attributes?.jobType || '—',
        region: j.attributes?.region || '—',
        authorisedTotal: j.attributes?.authorisedTotalIncludingTax || 0,
        createdAt: j.attributes?.createdAt || '',
        updatedAt: j.attributes?.updatedAt || '',
        updatedBy: j.attributes?.updatedBy || '',
        createdBy: j.attributes?.createdBy || '',
        primeUrl: j.attributes?.primeUrl || '',
      };
    });

    await setCached(cacheKey, flat, 4 * 60 * 60 * 1000);
    return NextResponse.json(flat);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
