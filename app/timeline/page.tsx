'use client';

import { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency } from '@/lib/prime-helpers';
import type { TimelineResponse, } from '@/app/api/prime/jobs/timeline/route';
import type { JobTimeline } from '@/lib/job-snapshots';
import {
  Clock, CheckCircle2, FileSearch, RefreshCw,
  ChevronDown, ChevronsUpDown, Download,
  TrendingUp, Timer, AlertTriangle, CalendarDays,
} from 'lucide-react';
import { downloadCSV } from '@/lib/export-csv';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DaysBadge({ days, prefix = '' }: { days: number | null; prefix?: string }) {
  if (days === null || days === undefined) return <span className="text-gray-600 text-xs">—</span>;
  const cls =
    days >= 90 ? 'bg-red-900/50 text-red-300 border border-red-700' :
    days >= 60 ? 'bg-red-800/40 text-red-400 border border-red-800' :
    days >= 30 ? 'bg-amber-900/40 text-amber-400 border border-amber-800' :
                 'bg-green-900/30 text-green-400 border border-green-900';
  return (
    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${cls}`}>
      {prefix}{days}d
    </span>
  );
}

function CategoryDot({ cat }: { cat: 'atp' | 'awaiting' | 'assessing' }) {
  if (cat === 'atp')       return <span className="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0" title="ATP" />;
  if (cat === 'awaiting')  return <span className="w-2 h-2 rounded-full bg-amber-500 inline-block flex-shrink-0" title="Awaiting" />;
  return <span className="w-2 h-2 rounded-full bg-blue-500 inline-block flex-shrink-0" title="Assessing" />;
}

function MetricBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-300 w-10 text-right">{value}d</span>
    </div>
  );
}

type SortKey = 'jobNumber' | 'daysOpen' | 'daysInAwaiting' | 'daysInAtp' | 'daysToAtp' | 'daysToAwaiting' | 'region' | 'value';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('daysInAwaiting');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterCat, setFilterCat] = useState<'all' | 'atp' | 'awaiting' | 'assessing'>('all');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [minDaysAwaiting, setMinDaysAwaiting] = useState<number>(0);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/prime/jobs/timeline')
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error || 'Failed')))
      .then((d: TimelineResponse) => setData(d))
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const forceCapture = async () => {
    setCapturing(true);
    try {
      await fetch('/api/prime/jobs/timeline', { method: 'POST' });
      await new Promise(r => setTimeout(r, 1000));
      load();
    } finally {
      setCapturing(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const regions = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.timelines.map(t => t.region))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.timelines
      .filter(t => filterCat === 'all' || t.lastCategory === filterCat)
      .filter(t => filterRegion === 'all' || t.region === filterRegion)
      .filter(t => t.daysInAwaiting >= minDaysAwaiting);
  }, [data, filterCat, filterRegion, minDaysAwaiting]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'jobNumber':      cmp = a.jobNumber.localeCompare(b.jobNumber); break;
        case 'daysOpen':       cmp = a.currentDaysOpen - b.currentDaysOpen; break;
        case 'daysInAwaiting': cmp = a.daysInAwaiting - b.daysInAwaiting; break;
        case 'daysInAtp':      cmp = a.daysInAtp - b.daysInAtp; break;
        case 'daysToAtp':      cmp = (a.daysCreatedToFirstAtp ?? 9999) - (b.daysCreatedToFirstAtp ?? 9999); break;
        case 'daysToAwaiting': cmp = (a.daysCreatedToFirstAwaiting ?? 9999) - (b.daysCreatedToFirstAwaiting ?? 9999); break;
        case 'region':         cmp = a.region.localeCompare(b.region); break;
        case 'value':          cmp = a.authorisedTotal - b.authorisedTotal; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleExport = () => {
    const rows = sorted.map(t => [
      t.jobNumber, t.region, t.jobType, t.lastStatus, t.lastCategory,
      t.currentDaysOpen, t.daysInAssessing, t.daysInAwaiting, t.daysInAtp,
      t.daysCreatedToFirstAwaiting ?? '', t.daysCreatedToFirstAtp ?? '',
      t.firstSeenDate, t.firstAwaitingDate ?? '', t.firstAtpDate ?? '',
      t.createdAt, t.authorisedTotal,
    ]);
    downloadCSV(
      `timeline-${new Date().toISOString().split('T')[0]}.csv`,
      ['Job #', 'Region', 'Type', 'Last Status', 'Category',
       'Days Open', 'Days Assessing', 'Days Awaiting', 'Days ATP',
       'Days to First Report Sent', 'Days to First ATP',
       'First Seen', 'First Awaiting Date', 'First ATP Date',
       'Created At', 'Auth. Total'],
      rows
    );
  };

  if (loading) return <LoadingSpinner message="Loading timeline report…" />;
  if (error)   return <ErrorMessage message={error} />;
  if (!data)   return null;

  const { summary } = data;
  const maxDays = Math.max(
    summary.avgDaysInAssessing,
    summary.avgDaysInAwaiting,
    summary.avgDaysInAtp,
    1
  );

  const hasEnoughData = data.snapshotCount >= 2;

  return (
    <div>
      <PageHeader
        title="Job Timeline Tracking"
        subtitle="How long jobs spend in each phase — from assessment through to ATP and works complete"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={!hasEnoughData}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={forceCapture}
              disabled={capturing}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={capturing ? 'animate-spin' : ''} />
              {capturing ? 'Capturing…' : 'Capture Snapshot'}
            </button>
          </div>
        }
      />

      {/* Data accumulation notice */}
      <div className="mb-5 px-4 py-3 rounded-lg border border-gray-700 bg-gray-900 text-sm">
        <div className="flex items-start gap-3">
          <CalendarDays size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-gray-300 font-medium">
              {data.snapshotCount} day{data.snapshotCount !== 1 ? 's' : ''} of history captured
            </span>
            {' '}
            <span className="text-gray-500">
              ({data.capturedDates[0] ?? '—'} → {data.capturedDates[data.capturedDates.length - 1] ?? '—'})
            </span>
            {!hasEnoughData && (
              <span className="ml-2 text-amber-400">
                — need at least 2 days to show transitions. A snapshot is captured automatically each day.
              </span>
            )}
            {hasEnoughData && data.message && (
              <p className="mt-1 text-gray-500">{data.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <KpiCard
          title="Avg Days to Report Sent"
          value={summary.avgDaysCreatedToFirstAwaiting > 0 ? `${summary.avgDaysCreatedToFirstAwaiting}d` : '—'}
          subtitle="Created → first report/quote sent"
          icon={<FileSearch size={18} />}
          accent={summary.avgDaysCreatedToFirstAwaiting > 30}
        />
        <KpiCard
          title="Avg Days to ATP"
          value={summary.avgDaysCreatedToFirstAtp > 0 ? `${summary.avgDaysCreatedToFirstAtp}d` : '—'}
          subtitle="Created → authority to proceed"
          icon={<CheckCircle2 size={18} className="text-green-400" />}
          accent={summary.avgDaysCreatedToFirstAtp > 60}
        />
        <KpiCard
          title="Avg Days in Insurer's Court"
          value={summary.avgDaysInAwaiting > 0 ? `${summary.avgDaysInAwaiting}d` : '—'}
          subtitle="Time spent awaiting approval"
          icon={<Clock size={18} className="text-amber-400" />}
          accent={summary.avgDaysInAwaiting > 20}
        />
        <KpiCard
          title="Currently Awaiting"
          value={summary.jobsCurrentlyAwaiting}
          subtitle={`${summary.percentAwaiting}% of tracked jobs`}
          icon={<AlertTriangle size={18} className="text-amber-400" />}
          accent={summary.percentAwaiting > 40}
        />
      </div>

      {/* Phase breakdown bar chart */}
      {hasEnoughData && (
        <div className="mb-5 bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-red-400" />
            Average Time Per Phase (across {summary.totalJobs} tracked jobs)
          </h2>
          <div className="space-y-3">
            <MetricBar label="Assessing" value={summary.avgDaysInAssessing} max={maxDays} color="bg-blue-500" />
            <MetricBar label="Awaiting Approval" value={summary.avgDaysInAwaiting} max={maxDays} color="bg-amber-500" />
            <MetricBar label="ATP / Active Works" value={summary.avgDaysInAtp} max={maxDays} color="bg-green-500" />
          </div>
          <div className="mt-4 pt-3 border-t border-gray-800 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <Timer size={12} className="text-gray-400" />
              <span>Avg created → report sent: <strong className="text-white">{summary.avgDaysCreatedToFirstAwaiting || '—'}d</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Timer size={12} className="text-gray-400" />
              <span>Avg created → ATP: <strong className="text-white">{summary.avgDaysCreatedToFirstAtp || '—'}d</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-green-400" />
              <span>ATP rate: <strong className="text-green-400">{summary.percentAtp}%</strong> of jobs</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {hasEnoughData && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Phase:</span>
            {(['all', 'atp', 'awaiting', 'assessing'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                  filterCat === cat
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'All' : cat === 'atp' ? 'ATP' : cat === 'awaiting' ? 'Awaiting' : 'Assessing'}
              </button>
            ))}
          </div>

          {regions.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Region:</span>
              <select
                value={filterRegion}
                onChange={e => setFilterRegion(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5"
              >
                <option value="all">All regions</option>
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Min days awaiting:</span>
            {[0, 7, 14, 30].map(v => (
              <button
                key={v}
                onClick={() => setMinDaysAwaiting(v)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  minDaysAwaiting === v
                    ? 'bg-amber-600 border-amber-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                {v === 0 ? 'Any' : `${v}+d`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            Job Timelines
            <span className="text-gray-500 font-normal ml-1">
              ({sorted.length} job{sorted.length !== 1 ? 's' : ''}{!hasEnoughData ? ' — accumulating data' : ''})
            </span>
          </h2>
        </div>

        {!hasEnoughData ? (
          <div className="px-5 py-16 text-center">
            <CalendarDays size={40} className="text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">Building your timeline history</p>
            <p className="text-gray-600 text-sm mt-2 max-w-md mx-auto">
              {data.message}
            </p>
            <p className="text-gray-600 text-sm mt-4">
              Snapshots: {data.capturedDates.join(', ') || 'none yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {([
                    { key: 'jobNumber'     as SortKey, label: 'Job',                cls: 'pl-5' },
                    { key: 'region'        as SortKey, label: 'Region',             cls: 'hidden md:table-cell' },
                    { key: 'daysOpen'      as SortKey, label: 'Age',                cls: '' },
                    { key: 'daysToAwaiting' as SortKey, label: '→ Report Sent',     cls: '' },
                    { key: 'daysToAtp'     as SortKey, label: '→ ATP',              cls: '' },
                    { key: 'daysInAwaiting' as SortKey, label: 'Days Waiting',      cls: '' },
                    { key: 'daysInAtp'     as SortKey, label: 'Days ATP',           cls: 'hidden lg:table-cell' },
                    { key: 'value'         as SortKey, label: 'Value',              cls: 'hidden lg:table-cell' },
                  ]).map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`px-4 py-2.5 text-left text-xs text-gray-500 font-medium cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap ${col.cls}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key
                          ? sortDir === 'asc'
                            ? <ChevronDown size={11} className="text-red-400 rotate-180" />
                            : <ChevronDown size={11} className="text-red-400" />
                          : <ChevronsUpDown size={11} className="text-gray-700" />
                        }
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-gray-500 text-sm">
                      No jobs match the current filters.
                    </td>
                  </tr>
                ) : sorted.map((t: JobTimeline) => (
                  <tr key={t.jobId} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                    {/* Job # + status */}
                    <td className="px-4 py-2.5 pl-5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs text-red-400">{t.jobNumber}</span>
                        <div className="flex items-center gap-1.5">
                          <CategoryDot cat={t.lastCategory} />
                          <span className="text-[11px] text-gray-500 truncate max-w-[150px]">{t.lastStatus}</span>
                        </div>
                      </div>
                    </td>

                    {/* Region */}
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-400 hidden md:table-cell">
                      {t.region}
                    </td>

                    {/* Age */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <DaysBadge days={t.currentDaysOpen} />
                    </td>

                    {/* Days created → first report sent (awaiting phase started) */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <DaysBadge days={t.daysCreatedToFirstAwaiting} />
                    </td>

                    {/* Days created → first ATP */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <DaysBadge days={t.daysCreatedToFirstAtp} />
                    </td>

                    {/* Total days spent awaiting */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {t.daysInAwaiting > 0
                        ? <DaysBadge days={t.daysInAwaiting} prefix="⏳ " />
                        : <span className="text-gray-600 text-xs">—</span>
                      }
                    </td>

                    {/* Days in ATP */}
                    <td className="px-4 py-2.5 whitespace-nowrap hidden lg:table-cell">
                      {t.daysInAtp > 0
                        ? <span className="text-xs font-mono text-green-400">{t.daysInAtp}d</span>
                        : <span className="text-gray-600 text-xs">—</span>
                      }
                    </td>

                    {/* Value */}
                    <td className="px-4 py-2.5 whitespace-nowrap hidden lg:table-cell text-xs font-mono text-gray-400">
                      {t.authorisedTotal > 0 ? formatCurrency(t.authorisedTotal) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasEnoughData && (
          <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-600">
            <strong className="text-gray-400">Column guide:</strong>
            {' '}<em>→ Report Sent</em>: days from job creation to first time it appeared as &ldquo;Report/Quote Sent&rdquo; or &ldquo;Awaiting Approval&rdquo;
            {' '}|{' '}
            <em>→ ATP</em>: days from job creation to first time it had Authority to Proceed
            {' '}|{' '}
            <em>Days Waiting</em>: total days spent in the insurer&rsquo;s court across the job&rsquo;s lifetime
          </div>
        )}
      </div>
    </div>
  );
}
