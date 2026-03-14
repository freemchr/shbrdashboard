import { NextResponse } from 'next/server';
import { primeGetAllPages } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/cache';
import type { PrimeInvoice } from '@/lib/prime-helpers';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cacheKey = 'invoices-ap';
    const cached = getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const invoices = (await primeGetAllPages('/accounts-payable-invoices', 100)) as PrimeInvoice[];

    const byStatus: Record<string, { count: number; total: number }> = {};
    let grandTotal = 0;

    for (const inv of invoices) {
      const status = inv.attributes?.status || 'Unknown';
      const amount = inv.attributes?.total || inv.attributes?.totalAmount || 0;
      if (!byStatus[status]) byStatus[status] = { count: 0, total: 0 };
      byStatus[status].count++;
      byStatus[status].total += amount;
      grandTotal += amount;
    }

    const result = { byStatus, grandTotal, count: invoices.length };
    setCached(cacheKey, result, 60 * 60 * 1000); // 1h
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
