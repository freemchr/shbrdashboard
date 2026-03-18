import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '7', 10);

  try {
    const cacheKey = `bottlenecks-v3-${days}`;
    const cached = await getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [jobs, statusNames] = await Promise.all([
      getAllOpenJobs(),
      getStatusNameMap(),
    ]);

    type Job = {
      id: string;
      attributes?: {
        statusId?: string;
        updatedAt?: string;
        jobNumber?: string;
        address?: { addressLine1?: string; suburb?: string; state?: string } | string;
        clientReference?: string;
        description?: string;
        jobType?: string;
        region?: string;
        authorisedTotalIncludingTax?: number;
        createdAt?: string;
        createdBy?: string;
        updatedBy?: string;
        primeUrl?: string;
      };
    };

    const stuck = (jobs as Job[]).filter(j => {
      const updatedAt = j.attributes?.updatedAt;
      if (!updatedAt) return false;
      return new Date(updatedAt + ' UTC') < cutoff;
    });

    // Group by status name
    const byStatus: Record<string, Job[]> = {};
    for (const j of stuck) {
      const name = statusNames[j.attributes?.statusId || ''] || 'Unknown';
      if (!byStatus[name]) byStatus[name] = [];
      byStatus[name].push(j);
    }

    const grouped = Object.entries(byStatus)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([status, statusJobs]) => ({
        status,
        count: statusJobs.length,
        jobs: statusJobs
          .sort((a, b) => new Date(a.attributes?.updatedAt || 0).getTime() - new Date(b.attributes?.updatedAt || 0).getTime())
          .map(j => {
            const addr = j.attributes?.address;
            const addressStr = typeof addr === 'object' && addr
              ? [addr.addressLine1, addr.suburb, addr.state].filter(Boolean).join(', ')
              : String(addr || '—');
            const daysSince = Math.floor((Date.now() - new Date((j.attributes?.updatedAt || '') + ' UTC').getTime()) / 86400000);
            return {
              id: j.id,
              jobNumber: j.attributes?.jobNumber,
              address: addressStr,
              clientReference: j.attributes?.clientReference,
              description: j.attributes?.description,
              jobType: j.attributes?.jobType,
              region: j.attributes?.region,
              authorisedTotal: j.attributes?.authorisedTotalIncludingTax,
              createdAt: j.attributes?.createdAt,
              createdBy: j.attributes?.createdBy,
              updatedAt: j.attributes?.updatedAt,
              updatedBy: j.attributes?.updatedBy,
              daysSince,
              primeUrl: j.attributes?.primeUrl,
            };
          }),
      }));

    const result = { days, totalStuck: stuck.length, groups: grouped };
    await setCached(cacheKey, result, 4 * 60 * 60 * 1000);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
