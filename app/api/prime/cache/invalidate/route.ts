import { NextResponse } from 'next/server';
import { invalidateCache } from '@/lib/blob-cache';

export const runtime = 'nodejs';

export async function POST() {
  try {
    await invalidateCache();
    return NextResponse.json({ ok: true, message: 'Cache cleared. Fresh data will be fetched on next load.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
