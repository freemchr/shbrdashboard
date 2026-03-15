/**
 * Geocode open jobs using Nominatim (OpenStreetMap) — no API key needed.
 *
 * Strategy to beat Vercel's 60s timeout:
 * - On GET: return whatever is cached immediately (even partial/stale).
 * - On POST: trigger a background geocode run that updates the cache page-by-page.
 *   Since Vercel can't do true background jobs, we geocode in bounded batches
 *   and the client polls to pick up progress.
 * - Results are persisted to Vercel Blob (survives cold starts).
 * - Nominatim rate limit: 1 req/sec — respected via 1.1s sleep between requests.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

export interface GeocodedJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  jobType: string;
  region: string;
  primeUrl: string;
  authorisedTotal: number;
  updatedAt: string;
  updatedBy: string;
  lat: number | null;
  lng: number | null;
  /** true = geocoding attempted but address couldn't be resolved; false/undefined = not attempted yet */
  failed?: boolean;
}

type RawJob = {
  id: string;
  attributes?: {
    statusId?: string;
    jobNumber?: string;
    address?: { addressLine1?: string; suburb?: string; state?: string } | string;
    jobType?: string;
    region?: string;
    authorisedTotalIncludingTax?: number;
    primeUrl?: string;
    updatedAt?: string;
    updatedBy?: string;
  };
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function nominatimGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(address + ', Australia');
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=au`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SHBR-Prime-Dashboard/1.0 (chris.freeman@techgurus.com.au)',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

function flattenJob(j: RawJob, statusNames: Record<string, string>): Omit<GeocodedJob, 'lat' | 'lng'> {
  const addr = j.attributes?.address;
  const address = typeof addr === 'object' && addr
    ? [addr.addressLine1, addr.suburb, addr.state].filter(Boolean).join(', ')
    : String(addr || '—');
  return {
    id: j.id,
    jobNumber: j.attributes?.jobNumber || j.id,
    address,
    status: statusNames[j.attributes?.statusId || ''] || '—',
    jobType: j.attributes?.jobType || '—',
    region: j.attributes?.region || '—',
    primeUrl: j.attributes?.primeUrl || '',
    authorisedTotal: j.attributes?.authorisedTotalIncludingTax || 0,
    updatedAt: j.attributes?.updatedAt || '',
    updatedBy: j.attributes?.updatedBy || '',
  };
}

const CACHE_KEY = 'geocoded-jobs-v5';

// Addresses that are definitely not geocodable — skip immediately
function isSkippableAddress(addr: string): boolean {
  if (!addr || addr.length < 5) return true;
  const upper = addr.toUpperCase();
  const junkPatterns = ['—', 'UNDEFINED', 'NULL', 'N/A', 'TBA', 'TBC', 'DESKTOP QUOTE', 'NO ADDRESS', 'UNKNOWN'];
  return junkPatterns.some(p => upper.includes(p));
}

// GET — return cached results (may be partial/stale), plus progress info
export async function GET() {
  try {
    const cached = await getCached<{ jobs: GeocodedJob[]; complete: boolean; total: number }>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    // No cache yet — return empty shell so client can trigger POST
    return NextResponse.json({ jobs: [], complete: false, total: 0 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — run geocoding for up to `batchSize` unjobbed addresses, save progress
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { batchSize?: number; reset?: boolean };
    const batchSize = Math.min(body.batchSize ?? 30, 35); // 30 * 1.1s = 33s + overhead, safe under 60s
    const reset = body.reset === true;

    // Load all open jobs from Prime (cached 30 min)
    const [rawJobs, statusNames] = await Promise.all([getAllOpenJobs(), getStatusNameMap()]);
    const jobs = (rawJobs as RawJob[]).map(j => flattenJob(j, statusNames));

    // Load existing geocode cache
    let existing: GeocodedJob[] = [];
    if (!reset) {
      const prev = await getCached<{ jobs: GeocodedJob[] }>(CACHE_KEY);
      existing = prev?.jobs ?? [];
    }

    // Build lookup: id → existing geocoded result
    const existingMap = new Map<string, GeocodedJob>(existing.map(g => [g.id, g]));

    // Separate: already geocoded vs needs geocoding
    const alreadyDone: GeocodedJob[] = [];
    const todo: typeof jobs = [];

    for (const job of jobs) {
      const prev = existingMap.get(job.id);
      if (prev && prev.address === job.address) {
        // Re-use (even if lat/lng is null — means it failed before, skip again)
        alreadyDone.push(prev);
      } else {
        todo.push(job);
      }
    }

    // Geocode up to batchSize new addresses
    const geocodedBatch: GeocodedJob[] = [];
    const toProcess = todo.slice(0, batchSize);

    for (const job of toProcess) {
      let coords: { lat: number; lng: number } | null = null;
      const skippable = isSkippableAddress(job.address);
      if (!skippable) {
        coords = await nominatimGeocode(job.address);
        await sleep(1100);
      }
      // failed=true means we tried (or it's a junk address) and got nothing
      geocodedBatch.push({ ...job, lat: coords?.lat ?? null, lng: coords?.lng ?? null, failed: coords === null });
    }

    // Remaining still-todo — lat/lng null but failed=false (not attempted yet)
    const remaining = todo.slice(batchSize).map(j => ({ ...j, lat: null as null, lng: null as null, failed: false }));

    const allJobs = [...alreadyDone, ...geocodedBatch, ...remaining];
    const complete = remaining.length === 0;
    const result = { jobs: allJobs, complete, total: jobs.length, geocoded: alreadyDone.length + geocodedBatch.length };

    // Cache: if complete use 2h, if partial use 10min so next batch picks it up
    await setCached(CACHE_KEY, result, complete ? 2 * 60 * 60 * 1000 : 10 * 60 * 1000);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
