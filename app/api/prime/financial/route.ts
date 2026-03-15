/**
 * Financial summary built from open jobs' authorised values.
 * AR/AP invoice endpoints return 403 (no API permission), so we derive
 * everything from job data which we do have access to.
 */
import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

export interface FinancialSummary {
  totalJobs: number;
  totalAuthIncTax: number;
  totalAuthExTax: number;
  zeroDollarCount: number;
  invoicingCount: number;
  byRegion: { region: string; count: number; total: number }[];
  byStatus: { status: string; count: number; total: number }[];
  byJobType: { jobType: string; count: number; total: number }[];
  invoicingJobs: {
    id: string;
    jobNumber: string;
    address: string;
    status: string;
    region: string;
    jobType: string;
    authorisedTotal: number;
    updatedAt: string;
    primeUrl: string;
  }[];
  zeroDollarJobs: {
    id: string;
    jobNumber: string;
    address: string;
    status: string;
    region: string;
    jobType: string;
    createdAt: string;
    updatedAt: string;
    primeUrl: string;
  }[];
}

const INVOICING_STATUSES = new Set([
  'preparing for invoicing',
  'invoice number required',
  'invoice number supplied',
  'ready to invoice',
  'ready to invoice',
  'preparing for invoicing',
  'cash settled - prepare restoration invoice',
]);

export async function GET() {
  try {
    const cacheKey = 'financial-v2';
    const cached = await getCached<FinancialSummary>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [rawJobs, statusNames] = await Promise.all([getAllOpenJobs(), getStatusNameMap()]);

    type RawJob = {
      id: string;
      attributes?: {
        statusId?: string;
        jobNumber?: string;
        address?: { addressLine1?: string; suburb?: string; state?: string } | string;
        jobType?: string;
        region?: string;
        authorisedTotalIncludingTax?: number | string;
        authorisedTotalExcludingTax?: number | string;
        createdAt?: string;
        updatedAt?: string;
        primeUrl?: string;
      };
    };

    const jobs = rawJobs as RawJob[];

    let totalAuthIncTax = 0;
    let totalAuthExTax = 0;
    let zeroDollarCount = 0;
    let invoicingCount = 0;

    const regionMap: Record<string, { count: number; total: number }> = {};
    const statusMap: Record<string, { count: number; total: number }> = {};
    const typeMap: Record<string, { count: number; total: number }> = {};

    const invoicingJobs: FinancialSummary['invoicingJobs'] = [];
    const zeroDollarJobs: FinancialSummary['zeroDollarJobs'] = [];

    for (const j of jobs) {
      const authInc = Number(j.attributes?.authorisedTotalIncludingTax || 0);
      const authEx  = Number(j.attributes?.authorisedTotalExcludingTax || 0);
      const status  = statusNames[j.attributes?.statusId || ''] || '—';
      const region  = j.attributes?.region || 'Unknown';
      const jobType = j.attributes?.jobType || 'Unknown';

      const addr = j.attributes?.address;
      const address = typeof addr === 'object' && addr
        ? [addr.addressLine1, addr.suburb, addr.state].filter(Boolean).join(', ')
        : String(addr || '—');

      totalAuthIncTax += authInc;
      totalAuthExTax  += authEx;

      if (!regionMap[region]) regionMap[region] = { count: 0, total: 0 };
      regionMap[region].count++;
      regionMap[region].total += authInc;

      if (!statusMap[status]) statusMap[status] = { count: 0, total: 0 };
      statusMap[status].count++;
      statusMap[status].total += authInc;

      if (!typeMap[jobType]) typeMap[jobType] = { count: 0, total: 0 };
      typeMap[jobType].count++;
      typeMap[jobType].total += authInc;

      if (authInc === 0) {
        zeroDollarCount++;
        zeroDollarJobs.push({
          id: j.id,
          jobNumber: j.attributes?.jobNumber || j.id,
          address,
          status,
          region,
          jobType,
          createdAt: j.attributes?.createdAt || '',
          updatedAt: j.attributes?.updatedAt || '',
          primeUrl: j.attributes?.primeUrl || '',
        });
      }

      if (INVOICING_STATUSES.has(status.toLowerCase())) {
        invoicingCount++;
        invoicingJobs.push({
          id: j.id,
          jobNumber: j.attributes?.jobNumber || j.id,
          address,
          status,
          region,
          jobType,
          authorisedTotal: authInc,
          updatedAt: j.attributes?.updatedAt || '',
          primeUrl: j.attributes?.primeUrl || '',
        });
      }
    }

    const result: FinancialSummary = {
      totalJobs: jobs.length,
      totalAuthIncTax,
      totalAuthExTax,
      zeroDollarCount,
      invoicingCount,
      byRegion: Object.entries(regionMap)
        .map(([region, v]) => ({ region, ...v }))
        .sort((a, b) => b.total - a.total),
      byStatus: Object.entries(statusMap)
        .map(([status, v]) => ({ status, ...v }))
        .sort((a, b) => b.total - a.total),
      byJobType: Object.entries(typeMap)
        .map(([jobType, v]) => ({ jobType, ...v }))
        .sort((a, b) => b.total - a.total),
      invoicingJobs: invoicingJobs.sort((a, b) => b.authorisedTotal - a.authorisedTotal),
      zeroDollarJobs: zeroDollarJobs.sort((a, b) => a.jobNumber.localeCompare(b.jobNumber)),
    };

    await setCached(cacheKey, result, 30 * 60 * 1000);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
