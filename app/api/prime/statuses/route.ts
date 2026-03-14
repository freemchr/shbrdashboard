import { NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/cache';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cacheKey = 'statuses';
    const cached = getCached<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const data = await primeGet('/job-statuses?per_page=200');
    setCached(cacheKey, data, 24 * 60 * 60 * 1000); // 24h
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
