/**
 * Geocode open jobs using Nominatim (OpenStreetMap) — no API key needed.
 * Returns cached results; re-geocodes only unknown addresses.
 * Rate limit: 1 req/sec to Nominatim (required by ToS).
 */
import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface GeocodedJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  jobType: string;
  region: string;
  primeUrl: string;
  authorisedTotal: number;
  lat: number | null;
  lng: number | null;
}

interface OpenJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  jobType: string;
  region: string;
  primeUrl: string;
  authorisedTotal: number;
}

async function nominatimGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  // Append Australia to improve accuracy
  const q = encodeURIComponent(address + ', Australia');
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=au`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SHBR-Prime-Dashboard/1.0 (chris.freeman@techgurus.com.au)',
        'Accept-Language': 'en',
      },
    });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET() {
  try {
    const cacheKey = 'geocoded-jobs-v2';
    const cached = await getCached<GeocodedJob[]>(cacheKey);

    // Load open jobs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const jobsRes = await fetch(`${baseUrl}/api/prime/jobs/open`, {
      headers: { 'x-internal': '1' },
    });
    if (!jobsRes.ok) throw new Error('Failed to fetch open jobs');
    const jobs = await jobsRes.json() as OpenJob[];

    // Build lookup from cached results
    const cachedMap = new Map<string, GeocodedJob>();
    if (cached) {
      for (const g of cached) cachedMap.set(g.id, g);
    }

    const results: GeocodedJob[] = [];
    const toGeocode: OpenJob[] = [];

    for (const job of jobs) {
      const existing = cachedMap.get(job.id);
      // Re-use if address unchanged and we have a result (even null — skip bad addresses)
      if (existing && existing.address === job.address) {
        results.push({ ...job, lat: existing.lat, lng: existing.lng });
      } else {
        toGeocode.push(job);
      }
    }

    // Geocode unknowns at 1 req/sec (Nominatim ToS)
    for (const job of toGeocode) {
      const skipAddresses = ['—', '', 'undefined', 'null'];
      let coords: { lat: number; lng: number } | null = null;

      if (!skipAddresses.includes(job.address)) {
        coords = await nominatimGeocode(job.address);
        await sleep(1100); // 1 req/sec rate limit
      }

      results.push({ ...job, lat: coords?.lat ?? null, lng: coords?.lng ?? null });
    }

    // Cache for 2 hours
    await setCached(cacheKey, results, 2 * 60 * 60 * 1000);

    return NextResponse.json(results);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
