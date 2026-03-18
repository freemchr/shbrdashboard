/**
 * Job Snapshot System
 *
 * Since Prime has no status change history API, we build our own by taking
 * daily snapshots of every open job and persisting them to Vercel Blob.
 *
 * Each snapshot records: job ID, job number, estimator, status, approval
 * category, days open, and the snapshot timestamp.
 *
 * The timeline report then diffs consecutive snapshots to calculate:
 *  - Time from job creation → first report submission
 *  - Time from report submission → ATP/approval received
 *  - Time from ATP → works complete (job closed)
 *  - Time from appointment booked → report submitted
 *  - Days spent in "awaiting" state (ball in insurer's court)
 *
 * Blob keys:
 *   shbr-cache/job-snapshots/YYYY-MM-DD.json  — daily snapshot
 *   shbr-cache/job-snapshots/index.json        — list of available dates
 */

import { put } from '@vercel/blob';
import { getAllOpenJobs, getOpenStatusIds } from './prime-open-jobs';

export interface JobSnapshot {
  jobId: string;
  jobNumber: string;
  estimatorId: string;
  estimatorName?: string;
  status: string;
  approvalCategory: 'atp' | 'awaiting' | 'assessing';
  daysOpen: number;
  region: string;
  jobType: string;
  authorisedTotal: number;
  createdAt: string;
  updatedAt: string;
  startDate?: string;
  endDate?: string;
}

export interface DailySnapshot {
  date: string;           // YYYY-MM-DD
  capturedAt: string;     // ISO timestamp
  jobs: JobSnapshot[];
  jobCount: number;
}

export interface SnapshotIndex {
  dates: string[];        // sorted ascending, YYYY-MM-DD
  lastCaptured: string;
}

// ─── Status classification (mirrors estimators route) ─────────────────────────

const AWAITING_STATUSES = new Set([
  'awaiting approval', 'awaiting client approval',
  'awaiting further instructions from insurer',
  'pending decision', 'pending information',
  'pending builder', 'pending builder strip out',
  'report submitted, awaiting directions', 'report/quote sent',
  'secondary approval required', 'secondary approval declined',
  'waiting atp with restoration works', 'waiting signed sow',
  'with council', 'on hold', 'job on hold', 'insured delay',
  'await sow & xs',
]);

const ATP_STATUSES = new Set([
  'approved job', 'approved-awaiting maintenance',
  'approved-awaiting maintenance repairs',
  'works in progress', 'works scheduled',
  'trades allocated', 'trades to be allocated',
  'pending variation', 'restoration sow approved',
  'await completion docs', 'installation approved', 'installation paused',
  'pending payment', 'rectification in progress', 'rectification required',
  'equipment onsite', 'restorer allocated', 'confirm repair completion',
  'satisfaction confirmed', 'secondary approval received',
  'cash settled - prepare restoration invoice',
  'makesafe in progress', 'makesafe only', 'new makesafe',
  'plumbing check booked', 'plumbing check completed',
  'plumbing check submitted', 'plumbing install booked',
  'plumbing install completed', 'plumbing install submitted',
]);

export function classifyStatus(status: string): 'atp' | 'awaiting' | 'assessing' {
  const s = status.toLowerCase().trim();
  if (ATP_STATUSES.has(s)) return 'atp';
  if (AWAITING_STATUSES.has(s)) return 'awaiting';
  return 'assessing';
}

// ─── Blob helpers ─────────────────────────────────────────────────────────────

const BLOB_BASE = 'https://4sgwpkfrmhyjifry.private.blob.vercel-storage.com';
const SNAPSHOT_PREFIX = 'shbr-cache/job-snapshots';

function snapshotUrl(date: string) {
  return `${BLOB_BASE}/${SNAPSHOT_PREFIX}/${date}.json`;
}
function indexUrl() {
  return `${BLOB_BASE}/${SNAPSHOT_PREFIX}/index.json`;
}

async function blobGet<T>(url: string): Promise<T | null> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function blobPut(path: string, data: unknown): Promise<void> {
  await put(path, JSON.stringify(data), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// ─── Index management ─────────────────────────────────────────────────────────

export async function getSnapshotIndex(): Promise<SnapshotIndex> {
  const idx = await blobGet<SnapshotIndex>(indexUrl());
  return idx ?? { dates: [], lastCaptured: '' };
}

async function updateIndex(date: string): Promise<void> {
  const idx = await getSnapshotIndex();
  if (!idx.dates.includes(date)) {
    idx.dates = [...idx.dates, date].sort();
  }
  idx.lastCaptured = new Date().toISOString();
  await blobPut(`${SNAPSHOT_PREFIX}/index.json`, idx);
}

// ─── Capture today's snapshot ─────────────────────────────────────────────────

export async function captureSnapshot(): Promise<DailySnapshot> {
  const today = new Date().toISOString().slice(0, 10);

  // Avoid double-capture in same day
  const existing = await blobGet<DailySnapshot>(snapshotUrl(today));
  if (existing) return existing;

  interface RawJob {
    id: string;
    attributes?: {
      jobNumber?: string;
      estimatorId?: string;
      statusId?: string;
      region?: string;
      jobType?: string;
      authorisedTotalIncludingTax?: number;
      createdAt?: string;
      updatedAt?: string;
      startDate?: string;
      endDate?: string;
      address?: { addressLine1?: string; suburb?: string; state?: string } | string;
    };
  }

  const [rawJobs, statusList] = await Promise.all([
    getAllOpenJobs() as Promise<RawJob[]>,
    getOpenStatusIds(),
  ]);

  const statusNames = Object.fromEntries(statusList.map(s => [s.id, s.name]));

  const jobs: JobSnapshot[] = rawJobs
    .filter(j => (j.attributes as Record<string, unknown>)?.estimatorId)
    .map(j => {
      const attrs = j.attributes as Record<string, unknown>;
      const statusId = String(attrs.statusId || '');
      const status = statusNames[statusId] || '—';
      const createdAt = String(attrs.createdAt || '');
      const daysOpen = createdAt
        ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
        : 0;

      return {
        jobId: j.id,
        jobNumber: String(attrs.jobNumber || j.id),
        estimatorId: String(attrs.estimatorId || ''),
        status,
        approvalCategory: classifyStatus(status),
        daysOpen,
        region: String(attrs.region || '—'),
        jobType: String(attrs.jobType || '—'),
        authorisedTotal: Number(attrs.authorisedTotalIncludingTax || 0),
        createdAt,
        updatedAt: String(attrs.updatedAt || ''),
        startDate: attrs.startDate ? String(attrs.startDate) : undefined,
        endDate: attrs.endDate ? String(attrs.endDate) : undefined,
      };
    });

  const snapshot: DailySnapshot = {
    date: today,
    capturedAt: new Date().toISOString(),
    jobs,
    jobCount: jobs.length,
  };

  await blobPut(`${SNAPSHOT_PREFIX}/${today}.json`, snapshot);
  await updateIndex(today);

  return snapshot;
}

// ─── Load a snapshot by date ──────────────────────────────────────────────────

export async function loadSnapshot(date: string): Promise<DailySnapshot | null> {
  return blobGet<DailySnapshot>(snapshotUrl(date));
}

// ─── Load last N snapshots ────────────────────────────────────────────────────

export async function loadRecentSnapshots(n = 30): Promise<DailySnapshot[]> {
  const idx = await getSnapshotIndex();
  const dates = idx.dates.slice(-n);
  const results = await Promise.all(dates.map(d => loadSnapshot(d)));
  return results.filter((s): s is DailySnapshot => s !== null);
}

// ─── Derive transition metrics from snapshots ─────────────────────────────────

export interface JobTimeline {
  jobId: string;
  jobNumber: string;
  estimatorId: string;
  region: string;
  jobType: string;
  createdAt: string;
  firstSeenDate: string;       // first snapshot date job appeared
  firstAtpDate: string | null; // first date it appeared as ATP
  firstAwaitingDate: string | null; // first date it appeared as awaiting
  firstAssessDate: string | null;
  lastStatus: string;
  lastCategory: 'atp' | 'awaiting' | 'assessing';
  lastSeenDate: string;
  // derived metrics
  daysInAssessing: number;
  daysInAwaiting: number;      // total days spent in awaiting state
  daysInAtp: number;
  daysCreatedToFirstAtp: number | null;  // job age when ATP first received
  daysCreatedToFirstAwaiting: number | null; // age when first report sent
  currentDaysOpen: number;
  authorisedTotal: number;
}

export async function computeTimelines(snapshots: DailySnapshot[]): Promise<JobTimeline[]> {
  if (snapshots.length < 2) return [];

  // Build per-job history: Map<jobId, Array<{date, snapshot}>>
  const jobHistory = new Map<string, Array<{ date: string; snap: JobSnapshot }>>();

  for (const snap of snapshots) {
    for (const job of snap.jobs) {
      if (!jobHistory.has(job.jobId)) jobHistory.set(job.jobId, []);
      jobHistory.get(job.jobId)!.push({ date: snap.date, snap: job });
    }
  }

  const timelines: JobTimeline[] = [];

  for (const [jobId, history] of Array.from(jobHistory.entries())) {
    const sorted = history.sort((a: { date: string; snap: JobSnapshot }, b: { date: string; snap: JobSnapshot }) => a.date.localeCompare(b.date));
    const first = sorted[0].snap;
    const last  = sorted[sorted.length - 1].snap;

    let daysInAssessing = 0;
    let daysInAwaiting  = 0;
    let daysInAtp       = 0;
    let firstAtpDate: string | null = null;
    let firstAwaitingDate: string | null = null;
    let firstAssessDate: string | null = null;

    // Each consecutive pair of snapshots = 1 day in that state
    for (let i = 0; i < sorted.length; i++) {
      const { date, snap } = sorted[i];
      const nextDate = sorted[i + 1]?.date;
      const daysForEntry = nextDate
        ? Math.max(1, Math.floor((new Date(nextDate).getTime() - new Date(date).getTime()) / 86400000))
        : 1;

      if (snap.approvalCategory === 'assessing') {
        daysInAssessing += daysForEntry;
        if (!firstAssessDate) firstAssessDate = date;
      } else if (snap.approvalCategory === 'awaiting') {
        daysInAwaiting += daysForEntry;
        if (!firstAwaitingDate) firstAwaitingDate = date;
      } else if (snap.approvalCategory === 'atp') {
        daysInAtp += daysForEntry;
        if (!firstAtpDate) firstAtpDate = date;
      }
    }

    const createdAt = first.createdAt;
    const daysCreatedToFirstAwaiting = firstAwaitingDate && createdAt
      ? Math.floor((new Date(firstAwaitingDate).getTime() - new Date(createdAt).getTime()) / 86400000)
      : null;

    const daysCreatedToFirstAtp = firstAtpDate && createdAt
      ? Math.floor((new Date(firstAtpDate).getTime() - new Date(createdAt).getTime()) / 86400000)
      : null;

    timelines.push({
      jobId,
      jobNumber: last.jobNumber,
      estimatorId: last.estimatorId,
      region: last.region,
      jobType: last.jobType,
      createdAt,
      firstSeenDate: sorted[0].date,
      firstAtpDate,
      firstAwaitingDate,
      firstAssessDate,
      lastStatus: last.status,
      lastCategory: last.approvalCategory,
      lastSeenDate: sorted[sorted.length - 1].date,
      daysInAssessing,
      daysInAwaiting,
      daysInAtp,
      daysCreatedToFirstAtp,
      daysCreatedToFirstAwaiting,
      currentDaysOpen: last.daysOpen,
      authorisedTotal: last.authorisedTotal,
    });
  }

  return timelines;
}
