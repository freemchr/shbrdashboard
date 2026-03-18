/**
 * Job Timeline API
 *
 * GET  /api/prime/jobs/timeline
 *   Returns computed timeline metrics derived from accumulated daily snapshots.
 *   On first call (no snapshots yet), captures today's snapshot and returns
 *   an empty timelines array with metadata explaining what to expect.
 *
 * POST /api/prime/jobs/timeline
 *   Force-captures a new snapshot immediately (used by cron / manual trigger).
 */

import { NextResponse } from 'next/server';
import {
  captureSnapshot,
  loadRecentSnapshots,
  computeTimelines,
  getSnapshotIndex,
  type JobTimeline,
} from '@/lib/job-snapshots';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 120;

const CACHE_KEY = 'timeline-metrics-v1';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export interface TimelineResponse {
  capturedDates: string[];
  snapshotCount: number;
  timelines: JobTimeline[];
  summary: {
    totalJobs: number;
    avgDaysInAssessing: number;
    avgDaysInAwaiting: number;
    avgDaysInAtp: number;
    avgDaysCreatedToFirstAwaiting: number;   // proxy: time to first report submission
    avgDaysCreatedToFirstAtp: number;        // time to receive ATP
    jobsCurrentlyAwaiting: number;
    jobsCurrentlyAtp: number;
    jobsCurrentlyAssessing: number;
    percentAtp: number;
    percentAwaiting: number;
  };
  message?: string; // shown when not enough data yet
}

export async function GET() {
  try {
    // Check cache first
    const cached = await getCached<TimelineResponse>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    // Always ensure today's snapshot exists
    await captureSnapshot();

    const idx = await getSnapshotIndex();
    const snapshots = await loadRecentSnapshots(60); // up to 60 days of history

    if (snapshots.length < 2) {
      // Not enough data yet — first day of tracking
      const resp: TimelineResponse = {
        capturedDates: idx.dates,
        snapshotCount: snapshots.length,
        timelines: [],
        summary: {
          totalJobs: snapshots[0]?.jobCount ?? 0,
          avgDaysInAssessing: 0,
          avgDaysInAwaiting: 0,
          avgDaysInAtp: 0,
          avgDaysCreatedToFirstAwaiting: 0,
          avgDaysCreatedToFirstAtp: 0,
          jobsCurrentlyAwaiting: 0,
          jobsCurrentlyAtp: 0,
          jobsCurrentlyAssessing: 0,
          percentAtp: 0,
          percentAwaiting: 0,
        },
        message: `Tracking started today. Daily snapshots will now be captured automatically. Come back tomorrow to see the first transition data — in 7 days you'll have a meaningful trend view.`,
      };
      return NextResponse.json(resp);
    }

    const timelines = await computeTimelines(snapshots);

    // Summary stats — only over jobs with at least some data
    const withAwaiting = timelines.filter(t => t.daysCreatedToFirstAwaiting !== null);
    const withAtp      = timelines.filter(t => t.daysCreatedToFirstAtp !== null);

    const avgOf = (arr: number[]): number => {
      if (!arr.length) return 0;
      return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    };

    const currentlyAwaiting  = timelines.filter(t => t.lastCategory === 'awaiting').length;
    const currentlyAtp       = timelines.filter(t => t.lastCategory === 'atp').length;
    const currentlyAssessing = timelines.filter(t => t.lastCategory === 'assessing').length;
    const total = timelines.length || 1;

    const summary = {
      totalJobs: timelines.length,
      avgDaysInAssessing: avgOf(timelines.map(t => t.daysInAssessing)),
      avgDaysInAwaiting:  avgOf(timelines.map(t => t.daysInAwaiting)),
      avgDaysInAtp:       avgOf(timelines.map(t => t.daysInAtp)),
      avgDaysCreatedToFirstAwaiting: avgOf(
        withAwaiting.map(t => t.daysCreatedToFirstAwaiting as number).filter(v => v >= 0 && v < 365)
      ),
      avgDaysCreatedToFirstAtp: avgOf(
        withAtp.map(t => t.daysCreatedToFirstAtp as number).filter(v => v >= 0 && v < 365)
      ),
      jobsCurrentlyAwaiting:  currentlyAwaiting,
      jobsCurrentlyAtp:       currentlyAtp,
      jobsCurrentlyAssessing: currentlyAssessing,
      percentAtp:      Math.round(currentlyAtp      / total * 100),
      percentAwaiting: Math.round(currentlyAwaiting / total * 100),
    };

    const resp: TimelineResponse = {
      capturedDates: idx.dates,
      snapshotCount: snapshots.length,
      timelines,
      summary,
    };

    await setCached(CACHE_KEY, resp, CACHE_TTL);
    return NextResponse.json(resp);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Force a new snapshot capture
export async function POST() {
  try {
    const snapshot = await captureSnapshot();
    // Bust the timeline cache so next GET recomputes
    await setCached(CACHE_KEY, null, 1);
    return NextResponse.json({
      ok: true,
      date: snapshot.date,
      jobCount: snapshot.jobCount,
      message: `Snapshot captured for ${snapshot.date} — ${snapshot.jobCount} jobs recorded.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
