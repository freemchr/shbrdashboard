/**
 * Vercel Cron — refreshes location analytics cache weekly.
 * Schedule: Fridays at 6 PM AEST (08:00 UTC) — vercel.json.
 * Calls the main route's POST handler internally via fetch is not ideal
 * at Vercel runtime, so we duplicate the trigger pattern used elsewhere:
 * this route just calls the location-analytics API with the refresh secret.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const res = await fetch(`${baseUrl}/api/prime/jobs/location-analytics`, {
      method: 'POST',
      headers: { 'x-refresh-secret': process.env.REFRESH_SECRET || '' },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Status ${res.status}`);

    console.log(`[cron/location-analytics] Done — ${data.totalJobs} jobs`);
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cron/location-analytics] Failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
