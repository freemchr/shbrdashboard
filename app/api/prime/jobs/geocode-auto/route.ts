/**
 * Auto-geocode route — called by Vercel Cron nightly at 2am AEDT.
 * Geocodes up to 50 pending jobs per run (respects Nominatim 1 req/sec).
 * Protected by CRON_SECRET header.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/blob-cache';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CACHE_KEY = 'geocoded-jobs-v6';

type GeocodedJob = {
  id: string; jobNumber: string; address: string; status: string;
  jobType: string; region: string; primeUrl: string;
  authorisedTotal: number; updatedAt: string; updatedBy: string;
  lat: number | null; lng: number | null; failed?: boolean;
};

type RawJob = {
  id: string;
  attributes?: {
    statusId?: string; jobNumber?: string;
    address?: { addressLine1?: string; suburb?: string; state?: string } | string;
    jobType?: string; region?: string;
    authorisedTotalIncludingTax?: number;
    primeUrl?: string; updatedAt?: string; updatedBy?: string;
  };
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function isSkippable(addr: string): boolean {
  if (!addr || addr.length < 5) return true;
  return ['—','UNDEFINED','NULL','N/A','TBA','TBC','DESKTOP QUOTE','NO ADDRESS','UNKNOWN']
    .some(p => addr.toUpperCase().includes(p));
}

async function nominatimGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(address + ', Australia');
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=au`, {
      headers: { 'User-Agent': 'SHBR-Dashboard/1.0 (chris.freeman@techgurus.com.au)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this automatically for cron jobs)
  const authHeader = req.headers.get('authorization');
  const secret = req.nextUrl.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [rawJobs, statusNames] = await Promise.all([getAllOpenJobs(), getStatusNameMap()]);

    const jobs = (rawJobs as RawJob[]).map(j => {
      const addr = j.attributes?.address;
      const address = typeof addr === 'object' && addr
        ? [addr.addressLine1, addr.suburb, addr.state].filter(Boolean).join(', ')
        : String(addr || '—');
      return {
        id: j.id, jobNumber: j.attributes?.jobNumber || j.id, address,
        status: statusNames[j.attributes?.statusId || ''] || '—',
        jobType: j.attributes?.jobType || '—', region: j.attributes?.region || '—',
        primeUrl: j.attributes?.primeUrl || '',
        authorisedTotal: j.attributes?.authorisedTotalIncludingTax || 0,
        updatedAt: j.attributes?.updatedAt || '', updatedBy: j.attributes?.updatedBy || '',
      };
    });

    // Load existing geocode cache
    const prev = await getCached<{ jobs: GeocodedJob[] }>(CACHE_KEY);
    const existingMap = new Map<string, GeocodedJob>((prev?.jobs ?? []).map(g => [g.id, g]));

    // Find jobs not yet geocoded
    const pending = jobs.filter(j => {
      const ex = existingMap.get(j.id);
      return !ex || (ex.lat === null && ex.failed !== true);
    });

    if (pending.length === 0) {
      return NextResponse.json({ message: 'All jobs already geocoded', total: jobs.length });
    }

    // Process up to 50 per run (50 * 1.1s = 55s, safe under 60s limit)
    const toProcess = pending.slice(0, 50);
    let mapped = 0, failed = 0;

    for (const job of toProcess) {
      let lat = null, lng = null, isFailed = false;
      if (!isSkippable(job.address)) {
        const coords = await nominatimGeocode(job.address);
        if (coords) { lat = coords.lat; lng = coords.lng; mapped++; }
        else { isFailed = true; failed++; }
        await sleep(1100);
      } else { isFailed = true; failed++; }
      existingMap.set(job.id, { ...job, lat, lng, failed: isFailed });
    }

    // Merge all jobs with their geocoded results
    const allGeocoded = jobs.map(j => existingMap.get(j.id) ?? { ...j, lat: null, lng: null, failed: false });
    const complete = allGeocoded.every(j => j.lat !== null || j.failed === true);
    const totalMapped = allGeocoded.filter(j => j.lat !== null).length;

    const result = { jobs: allGeocoded, complete, total: jobs.length, geocoded: totalMapped };
    await setCached(CACHE_KEY, result, 2 * 60 * 60 * 1000);

    return NextResponse.json({
      message: `Geocoded ${mapped} new, ${failed} failed. ${pending.length - toProcess.length} still pending.`,
      processed: toProcess.length,
      remaining: pending.length - toProcess.length,
      totalMapped,
      complete,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
