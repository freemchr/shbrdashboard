/**
 * CAT Demand Forecasting API
 *
 * Fetches BOM CAP/ATOM warning feeds for Australian states, combines with
 * Open-Meteo 14-day forecasts, and builds a CAT demand prediction per state.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached, invalidateCache } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BomWarning {
  title: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  event: string;
  updated: string;
  summary: string;
  url: string;
}

export interface StateCAT {
  state: string;
  city: string;
  activeWarnings: BomWarning[];
  weatherSeverityScore: number;
  weatherAlerts: string[];
  predictedJobsThisWeek: number;
  multiplier: number;
  confidenceLevel: 'low' | 'medium' | 'high';
  tempMax: number;
  precipProbability: number;
  fetchError?: boolean;
}

export interface CATForecastResponse {
  states: StateCAT[];
  totalPredictedJobs: number;
  highestRiskState: string;
  activeWarningCount: number;
  fetchedAt: string;
  nextRefreshAt: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const SHBR_STATES = [
  { state: 'NSW', city: 'Sydney',    lat: -33.8688, lon: 151.2093, timezone: 'Australia/Sydney'    },
  { state: 'VIC', city: 'Melbourne', lat: -37.8136, lon: 144.9631, timezone: 'Australia/Melbourne' },
  { state: 'QLD', city: 'Brisbane',  lat: -27.4698, lon: 153.0251, timezone: 'Australia/Brisbane'  },
  { state: 'WA',  city: 'Perth',     lat: -31.9505, lon: 115.8605, timezone: 'Australia/Perth'     },
  { state: 'SA',  city: 'Adelaide',  lat: -34.9285, lon: 138.6007, timezone: 'Australia/Adelaide'  },
];

const BOM_FEED_URLS: Record<string, string> = {
  NSW: 'http://www.bom.gov.au/cap/getwarnings.php?AreaCode=NSW',
  VIC: 'http://www.bom.gov.au/cap/getwarnings.php?AreaCode=VIC',
  QLD: 'http://www.bom.gov.au/cap/getwarnings.php?AreaCode=QLD',
  WA:  'http://www.bom.gov.au/cap/getwarnings.php?AreaCode=WA',
  SA:  'http://www.bom.gov.au/cap/getwarnings.php?AreaCode=SA',
};

const CACHE_KEY = 'cat-forecast-v1';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const BASELINE_JOBS = 45;

// ─── XML parsing helpers (regex only, no external parser) ──────────────────

function extractAllTags(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function parseBomFeed(xml: string): BomWarning[] {
  const entries = extractAllTags(xml, 'entry');
  const warnings: BomWarning[] = [];

  for (const entry of entries) {
    // Only include Actual status
    const status = extractTag(entry, 'cap:status') || extractTag(entry, 'status');
    if (status.toLowerCase() !== 'actual') continue;

    const severity = (
      extractTag(entry, 'cap:severity') ||
      extractTag(entry, 'severity') ||
      'Unknown'
    ) as BomWarning['severity'];

    const event = extractTag(entry, 'cap:event') || extractTag(entry, 'event') || '';

    // Filter: only Extreme/Severe severity, or storm-type events
    const catEvents = ['thunderstorm', 'flood', 'cyclone', 'storm'];
    const isSevereEnough = severity === 'Extreme' || severity === 'Severe';
    const isCatEvent = catEvents.some(e => event.toLowerCase().includes(e));

    if (!isSevereEnough && !isCatEvent) continue;

    const title   = extractTag(entry, 'title') || 'Unknown Warning';
    const updated = extractTag(entry, 'updated') || '';
    const summary = extractTag(entry, 'summary') || extractTag(entry, 'cap:description') || '';
    const url     = extractTag(entry, 'id') || extractAttr(entry, 'link', 'href') || '';

    warnings.push({ title, severity, event, updated, summary, url });
  }

  return warnings;
}

// ─── BOM feed fetch ──────────────────────────────────────────────────────────

async function fetchBomWarnings(state: string): Promise<{ warnings: BomWarning[]; fetchError: boolean }> {
  const url = BOM_FEED_URLS[state];
  if (!url) return { warnings: [], fetchError: false };

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'SHBR-Dashboard/1.0' },
    });
    if (!res.ok) return { warnings: [], fetchError: true };

    const xml = await res.text();
    const warnings = parseBomFeed(xml);
    return { warnings, fetchError: false };
  } catch {
    return { warnings: [], fetchError: true };
  }
}

// ─── Open-Meteo fetch ────────────────────────────────────────────────────────

interface OpenMeteoDaily {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  precipitation_probability_max: number[];
}

interface OpenMeteoResponse {
  daily: OpenMeteoDaily;
}

async function fetchOpenMeteo(lat: number, lon: number, timezone: string): Promise<{
  severityScore: number;
  weatherAlerts: string[];
  tempMax: number;
  precipProbability: number;
} | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,precipitation_probability_max&timezone=${timezone}&forecast_days=14`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;

    const data: OpenMeteoResponse = await res.json();
    const daily = data.daily;

    // Severity score components
    const stormDays = daily.weather_code.filter(c => c >= 80).length;
    const maxPrecipProb = Math.max(...daily.precipitation_probability_max);
    const hasThunderstorm = daily.weather_code.some(c => c >= 95);

    let score = stormDays * 10;
    if (maxPrecipProb >= 70) score += 20;
    if (hasThunderstorm) score += 30;
    score = Math.min(score, 100);

    // Weather alerts
    const alerts: string[] = [];
    if (hasThunderstorm) alerts.push('Thunderstorm Expected');
    if (stormDays >= 3) alerts.push('Multiple Storm Days');
    if (maxPrecipProb >= 70) alerts.push('Heavy Rain Likely');

    const tempMax = Math.round(Math.max(...daily.temperature_2m_max));
    const precipProbability = Math.round(maxPrecipProb);

    return { severityScore: score, weatherAlerts: alerts, tempMax, precipProbability };
  } catch {
    return null;
  }
}

// ─── Demand prediction ────────────────────────────────────────────────────────

function computeMultiplier(severityScore: number, warnings: BomWarning[]): number {
  let multiplier = 1.0;

  if (severityScore > 80)      multiplier = 2.2;
  else if (severityScore > 60) multiplier = 1.7;
  else if (severityScore > 40) multiplier = 1.4;
  else if (severityScore > 20) multiplier = 1.2;

  const hasExtreme = warnings.some(w => w.severity === 'Extreme');
  const hasSevere  = warnings.some(w => w.severity === 'Severe');

  if (hasExtreme) multiplier += 0.5;
  else if (hasSevere) multiplier += 0.2;

  return Math.round(multiplier * 10) / 10; // one decimal place
}

function computeConfidence(warnings: BomWarning[], severityScore: number): 'low' | 'medium' | 'high' {
  if (warnings.some(w => w.severity === 'Extreme')) return 'high';
  if (warnings.some(w => w.severity === 'Severe') && severityScore > 40) return 'high';
  if (warnings.length > 0 || severityScore > 40) return 'medium';
  return 'low';
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bust = searchParams.get('bust') === '1';

  if (bust) {
    await invalidateCache(CACHE_KEY);
  } else {
    const cached = await getCached<CATForecastResponse>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } });
    }
  }

  try {
    // Fetch all data in parallel
    const results = await Promise.all(
      SHBR_STATES.map(async (loc) => {
        const [bomResult, meteo] = await Promise.all([
          fetchBomWarnings(loc.state),
          fetchOpenMeteo(loc.lat, loc.lon, loc.timezone),
        ]);

        const severityScore = meteo?.severityScore ?? 0;
        const weatherAlerts = meteo?.weatherAlerts ?? [];
        const tempMax = meteo?.tempMax ?? 0;
        const precipProbability = meteo?.precipProbability ?? 0;

        const multiplier = computeMultiplier(severityScore, bomResult.warnings);
        const predictedJobsThisWeek = Math.round(BASELINE_JOBS * multiplier);
        const confidenceLevel = computeConfidence(bomResult.warnings, severityScore);

        const stateData: StateCAT = {
          state: loc.state,
          city: loc.city,
          activeWarnings: bomResult.warnings,
          weatherSeverityScore: severityScore,
          weatherAlerts,
          predictedJobsThisWeek,
          multiplier,
          confidenceLevel,
          tempMax,
          precipProbability,
          ...(bomResult.fetchError ? { fetchError: true } : {}),
        };

        return stateData;
      })
    );

    // Aggregate
    const totalPredictedJobs = results.reduce((sum, s) => sum + s.predictedJobsThisWeek, 0);
    const activeWarningCount = results.reduce((sum, s) => sum + s.activeWarnings.length, 0);

    const highestRisk = results.reduce((best, s) =>
      s.weatherSeverityScore > best.weatherSeverityScore ? s : best,
      results[0]
    );

    const fetchedAt = new Date().toISOString();
    const nextRefreshAt = new Date(Date.now() + CACHE_TTL).toISOString();

    const result: CATForecastResponse = {
      states: results,
      totalPredictedJobs,
      highestRiskState: highestRisk.state,
      activeWarningCount,
      fetchedAt,
      nextRefreshAt,
    };

    await setCached(CACHE_KEY, result, CACHE_TTL);

    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } });
  } catch (err) {
    console.error('[bom-warnings] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch CAT forecast data', detail: String(err) },
      { status: 500 }
    );
  }
}
