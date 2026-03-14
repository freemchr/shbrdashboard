import { NextRequest, NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await primeGet(`/jobs/${params.id}`);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
