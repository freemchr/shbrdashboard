'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/prime-helpers';
import { downloadCSV } from '@/lib/export-csv';
import {
  ExternalLink, Clock, Download,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import { JobTypeBadge, StatusBadge } from '@/components/ui/StatusBadge';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgingData {
  buckets: { over30: number; over60: number; over90: number };
  jobs: AgingJob[];
}
interface AgingJob {
  id: string; jobNumber: string; address: string; region: string;
  jobType: string; status: string; daysOpen: number;
  authorisedTotal: number; updatedAt: string; primeUrl: string;
}

interface BottleneckFlatJob {
  id: string; jobNumber: string; address: string; clientReference: string;
  description: string; jobType: string; region: string; status: string;
  authorisedTotal: number; createdAt: string; createdBy: string;
  updatedAt: string; updatedBy: string; daysSince: number; primeUrl: string;
}
interface StatusGroup { status: string; count: number; jobs: BottleneckFlatJob[]; }
interface BottleneckData { days: number; totalStuck: number; groups: StatusGroup[]; }

type BotSortKey = 'jobNumber' | 'jobType' | 'region' | 'status' | 'createdAt' | 'daysSince' | 'authorisedTotal';

const AGING_THRESHOLDS = [30, 60, 90];
const BOT_DAY_OPTIONS  = [7, 14, 30, 60, 90];

// ─── Age Tab ─────────────────────────────────────────────────────────────────

function AgeTab() {
  const [data, setData]         = useState<AgingData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [threshold, setThreshold] = useState(30);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/prime/jobs/aging');
        if (!res.ok) throw new Error(`Aging API error: ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingSpinner message="Loading aging data..." />;
  if (error)   return <ErrorMessage message={error} />;
  if (!data)   return null;

  const filteredJobs = data.jobs.filter(j => j.daysOpen > threshold);

  const columns: Column<AgingJob>[] = [
    {
      key: 'jobNumber', label: 'Job #', sortable: true, render: (j) => (
        j.primeUrl
          ? <a href={j.primeUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-red-400 text-xs hover:text-red-300 underline underline-offset-2">{j.jobNumber}</a>
          : <span className="font-mono text-red-400 text-xs">{j.jobNumber}</span>
      ),
    },
    { key: 'address',  label: 'Address',    sortable: true, render: (j) => <span className="text-xs">{j.address}</span> },
    { key: 'region',   label: 'Region',     sortable: true, render: (j) => <span className="text-xs text-gray-400">{j.region}</span> },
    { key: 'jobType',  label: 'Type',       sortable: true, render: (j) => <span className="text-xs">{j.jobType}</span> },
    { key: 'status',   label: 'Status',     sortable: true, render: (j) => <span className="text-xs">{j.status}</span> },
    {
      key: 'daysOpen', label: 'Days Open', sortable: true,
      render: (j) => (
        <span className={`font-bold font-mono text-sm ${j.daysOpen > 90 ? 'text-red-500' : j.daysOpen > 60 ? 'text-orange-400' : 'text-yellow-400'}`}>
          {j.daysOpen}d
        </span>
      ),
    },
    {
      key: 'authorisedTotal', label: 'Auth. Total', sortable: true,
      render: (j) => <span className="text-xs">{formatCurrency(j.authorisedTotal)}</span>,
    },
    {
      key: 'updatedAt', label: 'Last Updated', sortable: true,
      render: (j) => <span className="text-xs text-gray-500">{formatDate(j.updatedAt)}</span>,
    },
    {
      key: 'primeUrl', label: '',
      render: (j) => j.primeUrl ? (
        <a href={j.primeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-red-400">
          <ExternalLink size={14} />
        </a>
      ) : null,
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard title=">30 Days Open" value={data.buckets.over30} icon={<Clock size={18} />} subtitle="Needs attention" />
        <KpiCard title=">60 Days Open" value={data.buckets.over60} icon={<Clock size={18} />} accent={data.buckets.over60 > 0} subtitle="Overdue" />
        <KpiCard title=">90 Days Open" value={data.buckets.over90} icon={<Clock size={18} />} accent={data.buckets.over90 > 0} subtitle="Critical" />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-white">
            Jobs Older Than {threshold} Days ({filteredJobs.length})
          </h2>
          <div className="flex gap-2">
            {AGING_THRESHOLDS.map((t) => (
              <button
                key={t}
                onClick={() => setThreshold(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  threshold === t ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                &gt;{t}d
              </button>
            ))}
          </div>
        </div>
        <DataTable
          columns={columns}
          data={filteredJobs}
          keyFn={(item) => item.id}
          pageSize={25}
          emptyMessage={`No open jobs older than ${threshold} days.`}
          exportFilename={`aging-over${threshold}days-${new Date().toISOString().split('T')[0]}.csv`}
        />
      </div>
    </div>
  );
}

// ─── Inactive Tab ─────────────────────────────────────────────────────────────

function InactiveTab() {
  const [days, setDays]               = useState(7);
  const [data, setData]               = useState<BottleneckData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [sortKey, setSortKey]         = useState<BotSortKey>('daysSince');
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc');
  const [typeFilter, setTypeFilter]   = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/prime/jobs/bottlenecks?days=${days}`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [days]);

  const handleSort = (key: BotSortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'daysSince' ? 'desc' : 'asc'); }
  };

  const allJobs: BottleneckFlatJob[] = (data?.groups ?? []).flatMap(g => g.jobs.map(j => ({ ...j, status: g.status })));
  const types    = Array.from(new Set(allJobs.map(j => j.jobType).filter(Boolean))).sort();
  const regions  = Array.from(new Set(allJobs.map(j => j.region).filter(Boolean))).sort();
  const statuses = Array.from(new Set(allJobs.map(j => j.status).filter(Boolean))).sort();

  const filtered = allJobs.filter(j =>
    (!typeFilter   || j.jobType === typeFilter) &&
    (!regionFilter || j.region  === regionFilter) &&
    (!statusFilter || j.status  === statusFilter)
  );

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortTh = ({ col, label }: { col: BotSortKey; label: string }) => (
    <th onClick={() => handleSort(col)} className="py-2 px-2 text-left text-gray-400 text-xs font-medium whitespace-nowrap cursor-pointer select-none hover:text-white transition-colors">
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === col
          ? sortDir === 'asc' ? <ChevronUp size={12} className="text-red-400" /> : <ChevronDown size={12} className="text-red-400" />
          : <ChevronsUpDown size={12} className="text-gray-700" />}
      </span>
    </th>
  );

  const handleExport = () => {
    if (!data) return;
    downloadCSV(
      `bottlenecks-${days}days-${new Date().toISOString().split('T')[0]}.csv`,
      ['Job #', 'Status', 'Type', 'Region', 'Address', 'Client Ref', 'Auth Total', 'Created', 'Created By', 'Days Stuck', 'Last Updated', 'Updated By', 'Prime URL'],
      sorted.map(j => [j.jobNumber, j.status, j.jobType, j.region, j.address, j.clientReference,
        j.authorisedTotal, j.createdAt, j.createdBy, j.daysSince, j.updatedAt, j.updatedBy, j.primeUrl])
    );
  };

  return (
    <div>
      {/* Day threshold buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        {BOT_DAY_OPTIONS.map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${days === d ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
            &gt;{d} days
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner message="Loading bottleneck data…" />}
      {error && <ErrorMessage message={error} />}

      {data && !loading && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-3 flex items-center gap-2">
              <span className="text-red-400 font-bold text-xl">{filtered.length}</span>
              <span className="text-gray-400 text-sm">
                {filtered.length !== data.totalStuck ? `of ${data.totalStuck} ` : ''}
                job{data.totalStuck !== 1 ? 's' : ''} stuck &gt;{days} days
              </span>
            </div>

            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto">
              <option value="">All Types</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto">
              <option value="">All Regions</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto">
              <option value="">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {(typeFilter || regionFilter || statusFilter) && (
              <button onClick={() => { setTypeFilter(''); setRegionFilter(''); setStatusFilter(''); }}
                className="text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg transition-colors">
                Clear
              </button>
            )}

            {data && (
              <button onClick={handleExport}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors border border-gray-700 ml-auto">
                <Download size={14} /> Export CSV
              </button>
            )}
          </div>

          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 text-emerald-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <p className="text-gray-300 font-semibold text-sm">No stuck jobs here 🎉</p>
                <p className="text-gray-500 text-xs mt-1">No jobs match your current filters.</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/80">
                      <SortTh col="jobNumber"       label="Job #" />
                      <SortTh col="status"          label="Status" />
                      <SortTh col="jobType"         label="Type" />
                      <SortTh col="region"          label="Region" />
                      <th className="py-2 px-2 text-left text-gray-400 text-xs font-medium hidden md:table-cell">Address</th>
                      <th className="py-2 px-2 text-left text-gray-400 text-xs font-medium whitespace-nowrap hidden lg:table-cell">Client Ref</th>
                      <SortTh col="authorisedTotal" label="$" />
                      <SortTh col="createdAt"       label="Created" />
                      <SortTh col="daysSince"       label="Stuck" />
                      <th className="py-2 px-2 text-left text-gray-400 text-xs font-medium whitespace-nowrap hidden lg:table-cell">Updated By</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((job, idx) => (
                      <tr key={job.id} className={`border-b border-gray-800/40 hover:bg-gray-800/50 transition-colors ${idx % 2 !== 0 ? 'bg-gray-900/60' : ''}`}>
                        <td className="py-2 px-2 font-mono text-red-400 text-xs whitespace-nowrap">
                          {job.primeUrl
                            ? <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-red-300 underline underline-offset-2">{job.jobNumber || job.id}</a>
                            : job.jobNumber || job.id}
                        </td>
                        <td className="py-2 px-2"><StatusBadge label={job.status} /></td>
                        <td className="py-2 px-2">{job.jobType ? <JobTypeBadge label={job.jobType} /> : <span className="text-gray-600 text-xs">—</span>}</td>
                        <td className="py-2 px-2 text-gray-400 text-xs whitespace-nowrap">{job.region || '—'}</td>
                        <td className="py-2 px-2 text-gray-300 text-xs max-w-[140px] truncate hidden md:table-cell">{job.address || '—'}</td>
                        <td className="py-2 px-2 text-gray-400 text-xs hidden lg:table-cell">{job.clientReference || '—'}</td>
                        <td className="py-2 px-2 text-gray-300 text-xs whitespace-nowrap font-mono">{formatCurrency(job.authorisedTotal)}</td>
                        <td className="py-2 px-2 text-gray-400 text-xs whitespace-nowrap">{formatDate(job.createdAt)}</td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          <span className={`font-bold font-mono text-sm ${job.daysSince > 30 ? 'text-red-500' : job.daysSince > 14 ? 'text-yellow-400' : 'text-orange-400'}`}>
                            {job.daysSince}d
                          </span>
                        </td>
                        <td className="py-2 px-2 text-gray-400 text-xs whitespace-nowrap hidden lg:table-cell">{job.updatedBy || '—'}</td>
                        <td className="py-2 px-2">
                          {job.primeUrl && (
                            <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-red-400">
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'age' | 'inactive';

export default function StalledPage() {
  const [activeTab, setActiveTab] = useState<Tab>('age');

  return (
    <div>
      <PageHeader title="Stalled Jobs" subtitle="Jobs that are aging or have gone quiet" />

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        {([['age', 'Age'], ['inactive', 'Inactive']] as [Tab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'age'      && <AgeTab />}
      {activeTab === 'inactive' && <InactiveTab />}
    </div>
  );
}
