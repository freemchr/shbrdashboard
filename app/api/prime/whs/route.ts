/**
 * /api/prime/whs
 *
 * Lightweight read-only endpoint — serves pre-built WHS data from blob cache.
 * All heavy Prime API crawling is done by /api/prime/whs/refresh (runs nightly via cron).
 */

import { NextResponse } from 'next/server';
import { getCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';

const WHS_CACHE_KEY = 'whs-swms-v2';

export async function GET() {
  const cached = await getCached<unknown>(WHS_CACHE_KEY);

  if (!cached) {
    return NextResponse.json(
      {
        error: 'not_ready',
        message: 'WHS data is being built for the first time. The nightly cron runs at 3am AEDT — an admin can trigger /api/prime/whs/refresh manually to build it now.',
      },
      { status: 503 }
    );
  }

  return NextResponse.json(cached);
}
