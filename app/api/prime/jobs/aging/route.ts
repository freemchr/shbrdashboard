import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  try {
    const cacheKey = 'aging-v3';
    const cached = await getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [jobs, statusNames] = await Promise.all([
      getAllOpenJobs(),
      getStatusNameMap(),
    ]);

    type Job = {
      id: string;
      attributes?: {
        statusId?: string;
        createdAt?: string;
        updatedAt?: string;
        jobNumber?: string;
        address?: { addressLine1?: string; suburb?: string; state?: string } | string;
        jobType?: string;
        region?: string;
        authorisedTotalIncludingTax?: number;
        primeUrl?: string;
      };
    };

    const now = Date.now();
    const flat = (jobs as Job[]).map(j => {
      const addr = j.attributes?.address;
      const addressStr = typeof addr === 'object' && addr
        ? [addr.addressLine1, addr.suburb, addr.state].filter(Boolean).join(', ')
        : String(addr || '—');
      const daysOpen = j.attributes?.createdAt
        ? Math.floor((now - new Date(j.attributes.createdAt + ' UTC').getTime()) / 86400000)
        : 0;
      return {
        id: j.id,
        jobNumber: j.attributes?.jobNumber || j.id,
        address: addressStr,
        region: j.attributes?.region || '—',
        jobType: j.attributes?.jobType || '—',
        status: statusNames[j.attributes?.statusId || ''] || '—',
        daysOpen,
        authorisedTotal: j.attributes?.authorisedTotalIncludingTax || 0,
        primeUrl: j.attributes?.primeUrl || '',
        updatedAt: j.attributes?.updatedAt || '',
      };
    }).sort((a, b) => b.daysOpen - a.daysOpen);

    const result = {
      buckets: {
        over30: flat.filter(j => j.daysOpen > 30).length,
        over60: flat.filter(j => j.daysOpen > 60).length,
        over90: flat.filter(j => j.daysOpen > 90).length,
      },
      jobs: flat,
    };

    await setCached(cacheKey, result, 30 * 60 * 1000);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
