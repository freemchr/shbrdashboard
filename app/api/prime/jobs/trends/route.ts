import { NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);

// ─── Snapshot types ───────────────────────────────────────────────────────────
interface StatusSnapshot {
  capturedAt: string; // ISO timestamp
  counts: Record<string, number>;
}

export interface StatusDelta {
  current: number;
  previous: number | null; // null = no historical data yet
}

export interface TrendsResult {
  // Created this week vs the same 7-day window last week
  createdThisWeek: number;
  createdLastWeek: number;

  // Created this calendar month vs the full previous calendar month
  createdThisMonth: number;
  createdLastMonth: number;

  // Stuck open jobs: current (>7d) vs last week's proxy (>14d)
  stuckNow: number;
  stuckLastWeek: number;

  // Open job counts — current total vs estimate for last week
  openNow: number;
  openLastWeek: number;

  // Per-status deltas: status name → { current, previous }
  // previous is null if we have no snapshot old enough to compare
  statusDeltas: Record<string, StatusDelta>;
  snapshotAge: string | null; // ISO timestamp of the "previous" snapshot

  fetchedAt: string;
}

// ─── Snapshot management ──────────────────────────────────────────────────────
// We keep a ring of snapshots: "current" and up to 2 "previous" snapshots.
// A new snapshot is only written if >6h have passed since the last one —
// this means by the time users check weekly trends there's always a real
// historical comparison point (captured automatically over time).

const SNAPSHOT_CURRENT_KEY = 'status-snapshot-current';
const SNAPSHOT_PREV_KEY    = 'status-snapshot-prev';
const SNAPSHOT_MIN_AGE_MS  = 6 * 60 * 60 * 1000; // only rotate after 6h

async function buildCurrentCounts(
  openJobs: { attributes?: { statusId?: string } }[],
  statusNames: Record<string, string>
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const job of openJobs) {
    const j = job as { attributes?: { statusId?: string } };
    const statusId = j.attributes?.statusId ?? 'Unknown';
    const name = statusNames[statusId] || statusId;
    counts[name] = (counts[name] || 0) + 1;
  }
  return counts;
}

async function rotateSNapshots(currentCounts: Record<string, number>): Promise<{
  previous: StatusSnapshot | null;
}> {
  // Load existing "current" snapshot
  const existing = await getCached<StatusSnapshot>(SNAPSHOT_CURRENT_KEY);

  if (!existing) {
    // First time — write current, no previous
    const snap: StatusSnapshot = { capturedAt: new Date().toISOString(), counts: currentCounts };
    await setCached(SNAPSHOT_CURRENT_KEY, snap, 30 * 24 * 60 * 60 * 1000); // 30d
    return { previous: null };
  }

  const ageMs = Date.now() - new Date(existing.capturedAt).getTime();

  if (ageMs >= SNAPSHOT_MIN_AGE_MS) {
    // Rotate: existing current → prev, write new current
    await setCached(SNAPSHOT_PREV_KEY, existing, 30 * 24 * 60 * 60 * 1000);
    const newSnap: StatusSnapshot = { capturedAt: new Date().toISOString(), counts: currentCounts };
    await setCached(SNAPSHOT_CURRENT_KEY, newSnap, 30 * 24 * 60 * 60 * 1000);
    return { previous: existing };
  }

  // Not old enough to rotate — just load prev if it exists
  const prev = await getCached<StatusSnapshot>(SNAPSHOT_PREV_KEY);
  return { previous: prev };
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const cacheKey = 'trends-v2';
    const cached = await getCached<TrendsResult>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const now = new Date();

    // ── Week windows ──────────────────────────────────────────────────
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Mon
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(-1);

    // ── Month windows ─────────────────────────────────────────────────
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // ── Stuck thresholds ──────────────────────────────────────────────
    const sevenDaysAgo    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // ── Parallel API calls ────────────────────────────────────────────
    const [
      thisWeekRes,
      lastWeekRes,
      thisMonthRes,
      lastMonthRes,
      openJobs,
      statusNames,
    ] = await Promise.all([
      primeGet(`/jobs?per_page=1&q='createdAt'.gte('${fmt(thisWeekStart)}')`) as Promise<{ meta?: { pagination?: { total?: number } } }>,
      primeGet(`/jobs?per_page=1&q='createdAt'.gte('${fmt(lastWeekStart)}').lte('${fmt(lastWeekEnd)}')`) as Promise<{ meta?: { pagination?: { total?: number } } }>,
      primeGet(`/jobs?per_page=1&q='createdAt'.gte('${fmt(thisMonthStart)}')`) as Promise<{ meta?: { pagination?: { total?: number } } }>,
      primeGet(`/jobs?per_page=1&q='createdAt'.gte('${fmt(lastMonthStart)}').lte('${fmt(lastMonthEnd)}')`) as Promise<{ meta?: { pagination?: { total?: number } } }>,
      getAllOpenJobs() as Promise<{ attributes?: { updatedAt?: string; createdAt?: string; statusId?: string } }[]>,
      getStatusNameMap(),
    ]);

    const createdThisWeek  = thisWeekRes.meta?.pagination?.total  ?? 0;
    const createdLastWeek  = lastWeekRes.meta?.pagination?.total  ?? 0;
    const createdThisMonth = thisMonthRes.meta?.pagination?.total ?? 0;
    const createdLastMonth = lastMonthRes.meta?.pagination?.total ?? 0;
    const openNow = openJobs.length;

    const stuckNow = openJobs.filter(j => {
      const d = j.attributes?.updatedAt;
      return !d || new Date(d.replace(' ', 'T')) <= sevenDaysAgo;
    }).length;

    const stuckLastWeek = openJobs.filter(j => {
      const d = j.attributes?.updatedAt;
      return !d || new Date(d.replace(' ', 'T')) <= fourteenDaysAgo;
    }).length;

    const newOpenThisWeek = openJobs.filter(j => {
      const d = j.attributes?.createdAt;
      return d && new Date(d.replace(' ', 'T')) >= sevenDaysAgo;
    }).length;
    const openLastWeek = Math.max(0, openNow - newOpenThisWeek);

    // ── Per-status snapshot logic ─────────────────────────────────────
    const currentCounts = await buildCurrentCounts(openJobs, statusNames);
    const { previous } = await rotateSNapshots(currentCounts);

    // Build delta map: for every status that appears in current OR previous
    const allStatuses = Array.from(new Set([
      ...Object.keys(currentCounts),
      ...(previous ? Object.keys(previous.counts) : []),
    ]));

    const statusDeltas: Record<string, StatusDelta> = {};
    for (const status of allStatuses) {
      statusDeltas[status] = {
        current:  currentCounts[status]         ?? 0,
        previous: previous ? (previous.counts[status] ?? 0) : null,
      };
    }

    const result: TrendsResult = {
      createdThisWeek,
      createdLastWeek,
      createdThisMonth,
      createdLastMonth,
      stuckNow,
      stuckLastWeek,
      openNow,
      openLastWeek,
      statusDeltas,
      snapshotAge: previous?.capturedAt ?? null,
      fetchedAt: now.toISOString(),
    };

    await setCached(cacheKey, result, 30 * 60 * 1000);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
