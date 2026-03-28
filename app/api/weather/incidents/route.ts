/**
 * Live Incidents API
 *
 * Fetches claim-relevant emergency incidents (storm, flood, tree down, wind, cyclone)
 * from state emergency service feeds in real-time.
 *
 * Blob cost: Only QLD uses Blob (uploaded by local script every 2h).
 * NSW/VIC/WA/ACT are fetched live — 0 Blob ops per request.
 * Next.js fetch cache (revalidate: 300) provides 5-min in-edge caching.
 */

import { NextResponse } from 'next/server';
import { getCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LiveIncident {
  id: string;
  state: string;          // 'NSW' | 'VIC' | 'WA' | 'QLD' | 'ACT'
  title: string;          // incident name/title
  type: string;           // 'Storm' | 'Flood' | 'Tree Down' | 'Cyclone' | 'Wind' | 'Bushfire' | 'Other'
  status: string;         // 'Active' | 'Responding' | 'Monitoring' | 'Under Control' | 'Unknown'
  location: string;       // suburb/area name
  council?: string;       // LGA/council area
  region?: string;        // state region (WA dfes-region, NSW council area)
  alertLevel?: string;    // NSW RFS alert level (Advice, Watch & Act, Emergency Warning)
  size?: string;          // NSW RFS fire size
  agency?: string;        // responsible agency
  lat?: number;
  lng?: number;
  updatedAt: string;      // ISO timestamp
  sourceOrg: string;      // 'NSW RFS' | 'VicEmergency' | 'WA DFES' | 'QLD QFES' | 'ACT ESA'
  isClaimRelevant: boolean; // true if storm/flood/tree/wind/cyclone
}

export interface IncidentsResponse {
  incidents: LiveIncident[];
  totalClaimRelevant: number;
  byState: Record<string, number>;
  fetchedAt: string;
  sources: {
    state: string;
    source: string;
    feedType: string;
    updateFrequency: string;
    accessMethod: string;
    status: 'live' | 'cached' | 'error';
    lastUpdated?: string;
  }[];
}

// ─── Source metadata ──────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { source: string; feedType: string; updateFrequency: string; accessMethod: string }> = {
  NSW: { source: 'NSW Rural Fire Service', feedType: 'GeoJSON', updateFrequency: 'Live (5 min cache)', accessMethod: 'Public GeoJSON feed' },
  VIC: { source: 'VicEmergency',           feedType: 'GeoJSON', updateFrequency: 'Live (5 min cache)', accessMethod: 'Public GeoJSON feed' },
  WA:  { source: 'WA DFES Emergency',      feedType: 'REST API', updateFrequency: 'Live (5 min cache)', accessMethod: 'Public REST API' },
  ACT: { source: 'ACT Emergency Services', feedType: 'XML/RSS',  updateFrequency: 'Live (5 min cache)', accessMethod: 'Public RSS feed' },
  QLD: { source: 'QLD Fire & Emergency Services', feedType: 'GeoJSON (S3)', updateFrequency: 'Every 2 hours (local script)', accessMethod: 'Public S3 bucket' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDescriptionField(description: string, fieldName: string): string {
  const match = description.match(new RegExp(`${fieldName}:\\s*([^\\n<]+)`, 'i'));
  return match ? match[1].trim() : '';
}

function normaliseType(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('flood') || r === 'met') return 'Flood';
  if (r.includes('storm')) return 'Storm';
  if (r.includes('tree')) return 'Tree Down';
  if (r.includes('cyclone') || r.includes('tropical')) return 'Cyclone';
  if (r.includes('wind')) return 'Wind';
  if (r.includes('bushfire') || r.includes('fire')) return 'Bushfire';
  return 'Other';
}

function normaliseStatus(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('under control') || r.includes('controlled') || r === 'complete' || r.includes('complete')) return 'Under Control';
  if (r.includes('responding') || r.includes('response') || r.includes('request for assistance') || r.includes('on scene')) return 'Responding';
  if (r.includes('monitor')) return 'Monitoring';
  if (r.includes('active')) return 'Active';
  if (r.includes('advice') || r.includes('watch')) return 'Watch & Act';
  if (r.includes('warning')) return 'Warning';
  if (r.includes('minor')) return 'Minor Flooding';
  return raw || 'Unknown';
}

function isClaimRelevantType(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes('storm') || t.includes('flood') || t.includes('tree') || t.includes('wind') || t.includes('cyclone') || t.includes('tropical') || t.includes('met');
}

// ─── NSW RFS ──────────────────────────────────────────────────────────────────

interface NSWFeature {
  type: string;
  geometry: {
    type: string;
    geometries?: { type: string; coordinates: number[] }[];
    coordinates?: number[];
  };
  properties: {
    guid: string;
    title: string;
    description: string;
    pubDate: string;
    updated?: string;
  };
}

async function fetchNSW(): Promise<{ incidents: LiveIncident[]; lastUpdated: string }> {
  const res = await fetch('https://www.rfs.nsw.gov.au/feeds/majorIncidents.json', {
    next: { revalidate: 300 },
    headers: { 'User-Agent': 'SHBR-Insights-Dashboard/1.0' },
  });
  if (!res.ok) throw new Error(`NSW RFS: HTTP ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = await res.json() as { features?: NSWFeature[] };
  const features = json.features ?? [];

  const incidents: LiveIncident[] = features.map((f, i) => {
    const desc = f.properties.description ?? '';
    const rawType    = parseDescriptionField(desc, 'TYPE') || 'Other';
    const rawLoc     = parseDescriptionField(desc, 'LOCATION') || f.properties.title || 'Unknown';
    const rawCouncil = parseDescriptionField(desc, 'COUNCIL AREA');
    const rawStatus  = parseDescriptionField(desc, 'STATUS') || 'Unknown';

    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const geoms = f.geometry?.geometries;
      if (geoms && geoms[0]?.coordinates?.length === 2) {
        [lng, lat] = geoms[0].coordinates;
      } else if (f.geometry?.coordinates?.length === 2) {
        [lng, lat] = f.geometry.coordinates as number[];
      }
    } catch { /* ignore coord parse errors */ }

    const type       = normaliseType(rawType);
    const status     = normaliseStatus(rawStatus);
    const alertLevel = parseDescriptionField(desc, 'ALERT LEVEL');
    const size       = parseDescriptionField(desc, 'SIZE');
    const agency     = parseDescriptionField(desc, 'RESPONSIBLE AGENCY');

    return {
      id:              `nsw-${f.properties.guid ?? i}`,
      state:           'NSW',
      title:           f.properties.title ?? 'Unknown Incident',
      type,
      status,
      location:        rawLoc,
      council:         rawCouncil || undefined,
      region:          rawCouncil || undefined,
      alertLevel:      alertLevel || undefined,
      size:            size || undefined,
      agency:          agency || undefined,
      lat,
      lng,
      updatedAt:       f.properties.updated ?? f.properties.pubDate ?? new Date().toISOString(),
      sourceOrg:       'NSW RFS',
      isClaimRelevant: isClaimRelevantType(rawType),
    };
  });

  return { incidents, lastUpdated: new Date().toISOString() };
}

// ─── VIC VicEmergency ─────────────────────────────────────────────────────────

interface VICFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
  properties: {
    id?: string;
    eventId?: string;
    name?: string;
    category2?: string;
    location?: string;
    status?: string;
    created?: string;
    updated?: string;
    sourceOrg?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

function extractVICCoords(geometry: VICFeature['geometry']): { lat?: number; lng?: number } {
  try {
    if (!geometry) return {};
    if (geometry.type === 'Point') {
      const coords = geometry.coordinates as number[];
      if (coords.length >= 2) return { lng: coords[0], lat: coords[1] };
    }
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates as number[][][];
      const first = coords[0]?.[0];
      if (first?.length >= 2) return { lng: first[0], lat: first[1] };
    }
    if (geometry.type === 'MultiPolygon') {
      const coords = geometry.coordinates as number[][][][];
      const first = coords[0]?.[0]?.[0];
      if (first?.length >= 2) return { lng: first[0], lat: first[1] };
    }
    // VIC SES incidents use GeometryCollection — extract from first sub-geometry
    if (geometry.type === 'GeometryCollection') {
      const geoms = (geometry as unknown as { geometries?: { type: string; coordinates: unknown }[] }).geometries ?? [];
      for (const g of geoms) {
        if (g.type === 'Point') {
          const coords = g.coordinates as number[];
          if (coords.length >= 2) return { lng: coords[0], lat: coords[1] };
        }
      }
    }
  } catch { /* ignore */ }
  return {};
}

async function fetchVIC(): Promise<{ incidents: LiveIncident[]; lastUpdated: string }> {
  const res = await fetch('https://emergency.vic.gov.au/public/events-geojson.json', {
    next: { revalidate: 300 },
    headers: { 'User-Agent': 'SHBR-Insights-Dashboard/1.0' },
  });
  if (!res.ok) throw new Error(`VicEmergency: HTTP ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = await res.json() as { features?: VICFeature[] };
  const features = json.features ?? [];

  const incidents: LiveIncident[] = features.map((f, i) => {
    const p        = f.properties;
    const rawType  = p.category2 ?? p.type ?? 'Other';
    const type     = normaliseType(rawType);
    const status   = normaliseStatus(p.status ?? '');
    const { lat, lng } = extractVICCoords(f.geometry);

    const location = p.location ?? 'Unknown';
    const titleFallback = location !== 'Unknown' ? `${type} — ${location}` : type;

    return {
      id:              `vic-${p.id ?? p.eventId ?? i}`,
      state:           'VIC',
      title:           p.name || p.sourceTitle !== 'Undefined' && p.sourceTitle || titleFallback,
      type,
      status,
      location,
      council:         undefined,
      lat,
      lng,
      updatedAt:       p.updated ?? p.created ?? new Date().toISOString(),
      sourceOrg:       p.sourceOrg === 'VIC/SES' ? 'VIC SES' : 'VicEmergency',
      isClaimRelevant: isClaimRelevantType(rawType),
    };
  });

  return { incidents, lastUpdated: new Date().toISOString() };
}

// ─── WA DFES ──────────────────────────────────────────────────────────────────

interface WAIncident {
  'incident-type'?: string;
  name?: string;
  location?: { value?: string };
  suburbs?: string[];
  lga?: string[];
  'dfes-regions'?: string[];
  'incident-status'?: string;
  'start-date-time'?: string;
  'updated-date-time'?: string;
  'geo-source'?: {
    features?: { geometry?: { coordinates?: number[] } }[];
  };
  id?: string | number;
}

async function fetchWA(): Promise<{ incidents: LiveIncident[]; lastUpdated: string }> {
  const res = await fetch('https://api.emergency.wa.gov.au/v1/incidents', {
    next: { revalidate: 300 },
    headers: { 'User-Agent': 'SHBR-Insights-Dashboard/1.0' },
  });
  if (!res.ok) throw new Error(`WA DFES: HTTP ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = await res.json() as { incidents?: WAIncident[] } | WAIncident[];
  const rawList = Array.isArray(json) ? json : (json as { incidents?: WAIncident[] }).incidents ?? [];

  const incidents: LiveIncident[] = rawList.map((inc, i) => {
    const rawType  = inc['incident-type'] ?? 'Other';
    const type     = normaliseType(rawType);
    const status   = normaliseStatus(inc['incident-status'] ?? '');
    const location = (inc.suburbs ?? []).join(', ') || inc.location?.value || 'Unknown';
    const council  = (inc.lga ?? []).join(', ') || undefined;
    const region   = (inc['dfes-regions'] ?? []).join(', ') || undefined;

    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const coords = inc['geo-source']?.features?.[0]?.geometry?.coordinates;
      if (coords && coords.length >= 2) { [lng, lat] = coords; }
    } catch { /* ignore */ }

    return {
      id:              `wa-${inc.id ?? i}`,
      state:           'WA',
      title:           inc.name ?? rawType ?? 'Unknown Incident',
      type,
      status,
      location,
      council,
      region,
      lat,
      lng,
      updatedAt:       inc['updated-date-time'] ?? inc['start-date-time'] ?? new Date().toISOString(),
      sourceOrg:       'WA DFES',
      isClaimRelevant: isClaimRelevantType(rawType),
    };
  });

  return { incidents, lastUpdated: new Date().toISOString() };
}

// ─── ACT ESA ─────────────────────────────────────────────────────────────────

async function fetchACT(): Promise<{ incidents: LiveIncident[]; lastUpdated: string }> {
  const res = await fetch('http://www.esa.act.gov.au/feeds/currentincidents.xml', {
    next: { revalidate: 300 },
    headers: { 'User-Agent': 'SHBR-Insights-Dashboard/1.0' },
  });
  if (!res.ok) throw new Error(`ACT ESA: HTTP ${res.status}`);

  const xml = await res.text();

  // Parse <item> blocks with regex
  const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));
  const incidents: LiveIncident[] = [];

  let idx = 0;
  for (const match of itemMatches) {
    const block = match[1];
    const title   = (block.match(/<title>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/title>/i)?.[1] ?? '').trim();
    const pubDate = (block.match(/<pubDate>\s*([\s\S]*?)\s*<\/pubDate>/i)?.[1] ?? '').trim();

    if (!title) { idx++; continue; }

    const rawType = normaliseType(title);
    const status  = 'Unknown';

    incidents.push({
      id:              `act-${idx}`,
      state:           'ACT',
      title,
      type:            rawType,
      status,
      location:        title,
      council:         undefined,
      lat:             undefined,
      lng:             undefined,
      updatedAt:       pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      sourceOrg:       'ACT ESA',
      isClaimRelevant: isClaimRelevantType(title),
    });
    idx++;
  }

  return { incidents, lastUpdated: new Date().toISOString() };
}

// ─── QLD (from Blob) ─────────────────────────────────────────────────────────

async function fetchQLD(): Promise<{ incidents: LiveIncident[]; lastUpdated: string; fromBlob: boolean }> {
  const cached = await getCached<LiveIncident[]>('incidents-qld-v1');
  if (!cached) {
    return { incidents: [], lastUpdated: new Date().toISOString(), fromBlob: false };
  }
  return { incidents: cached, lastUpdated: new Date().toISOString(), fromBlob: true };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const fetchedAt = new Date().toISOString();

  const allIncidents: LiveIncident[] = [];
  const byState: Record<string, number> = {};
  const sources: IncidentsResponse['sources'] = [];

  // Run all fetches in parallel, isolating errors per state
  const results = await Promise.allSettled([
    fetchNSW().then(r => ({ state: 'NSW', ...r })),
    fetchVIC().then(r => ({ state: 'VIC', ...r })),
    fetchWA().then(r => ({ state: 'WA',  ...r })),
    fetchACT().then(r => ({ state: 'ACT', ...r })),
    fetchQLD().then(r => ({ state: 'QLD', ...r, incidents: r.incidents })),
  ]);

  const stateOrder = ['NSW', 'VIC', 'WA', 'ACT', 'QLD'];

  for (let i = 0; i < results.length; i++) {
    const st = stateOrder[i];
    const meta = SOURCE_META[st];
    const result = results[i];

    if (result.status === 'fulfilled') {
      const { incidents, lastUpdated } = result.value;
      // Count ALL incidents for byState
      byState[st] = incidents.length;
      // Add all incidents (we'll filter claim-relevant below)
      allIncidents.push(...incidents);

      // QLD status: 'cached' if from blob, 'live' if direct
      const isQLD = st === 'QLD';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fromBlob = isQLD && (result.value as any).fromBlob === true;
      sources.push({
        state: st,
        ...meta,
        status: fromBlob ? 'cached' : 'live',
        lastUpdated,
      });
    } else {
      byState[st] = 0;
      sources.push({
        state: st,
        ...meta,
        status: 'error',
      });
      console.error(`[incidents] ${st} fetch failed:`, result.reason);
    }
  }

  // Filter to claim-relevant only for the main incidents list
  const claimRelevant = allIncidents.filter(inc => inc.isClaimRelevant);

  const response: IncidentsResponse = {
    incidents:           claimRelevant,
    totalClaimRelevant:  claimRelevant.length,
    byState,
    fetchedAt,
    sources,
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
