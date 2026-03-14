import { NextRequest, NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const params = new URLSearchParams();

    const allowed = ['status', 'region', 'page', 'per_page', 'q', 'order', 'sort'];
    for (const key of allowed) {
      const val = searchParams.get(key);
      if (val) params.set(key, val);
    }

    const data = await primeGet(`/jobs?${params.toString()}`);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
