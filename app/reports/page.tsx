'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/prime-helpers';
import { downloadCSV } from '@/lib/export-csv';
import { ExternalLink, Download, AlertTriangle, Clock, CheckCircle, ChevronUp, ChevronDown, ChevronsUpDown, FileEdit } from 'lucide-react';
import Link from 'next/link';

interface ReportJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  jobType: string;
  region: string;
  authorisedTotal: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  daysSinceCreated: number;
  daysSinceUpdated: number;
  primeUrl: string;
  category: string;
}

interface ReportSummary {
  total: number;
  noReport: number;
  inProgress: number;
  submitted: number;
  postReport: number;
  noReportJobs: ReportJob[];
  inProgressJobs: ReportJob[];
  submittedJobs: ReportJob[];
}

type Tab = 'no_report' | 'in_progress' | 'submitted';
type SortKey = 'jobNumber' | 'jobType' | 'region' | 'status' | 'daysSinceCreated' | 'daysSinceUpdated' | 'authorisedTotal';

function JobTable({ jobs, sortKey, sortDir, onSort, showAge = 'created', showAssistButton = false }: {
  jobs: ReportJob[];
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  showAge?: 'created' | 'updated';
  showAssistButton?: boolean;
}) {
  const SortTh = ({ col, label }: { col: SortKey; label: string }) => (
    <th onClick={() => onSort(col)}
      className="py-2 px-3 text-left text-xs text-gray-500 font-medium whitespace-nowrap cursor-pointer select-none hover:text-white transition-colors">
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === col
          ? sortDir === 'asc' ? <ChevronUp size={11} className="text-red-400" /> : <ChevronDown size={11} className="text-red-400" />
          : <ChevronsUpDown size={11} className="text-gray-700" />}
      </span>
    </th>
  );

  const sorted = [...jobs].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <SortTh col="jobNumber" label="Job #" />
            <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Address</th>
            <SortTh col="status" label="Status" />
            <SortTh col="jobType" label="Type" />
            <SortTh col="region" label="Region" />
            <SortTh col="authorisedTotal" label="Auth Total" />
            <SortTh col="daysSinceCreated" label="Created" />
            <SortTh col="daysSinceUpdated" label="Last Update" />
            <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium whitespace-nowrap hidden lg:table-cell">Updated By</th>
            <th className="py-2 px-3"></th>
            {showAssistButton && <th className="py-2 px-3"></th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map(job => (
            <tr key={job.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
              <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                {job.primeUrl
                  ? <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
                      className="text-red-400 hover:text-red-300 underline underline-offset-2">{job.jobNumber}</a>
                  : <span className="text-red-400">{job.jobNumber}</span>}
              </td>
              <td className="py-2 px-3 text-gray-300 text-xs max-w-[120px] truncate">{job.address}</td>
              <td className="py-2 px-3 text-xs text-gray-400 max-w-[120px] truncate">{job.status}</td>
              <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap hidden sm:table-cell">{job.jobType}</td>
              <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap hidden sm:table-cell">{job.region}</td>
              <td className="py-2 px-3 text-xs font-mono text-gray-400 whitespace-nowrap hidden md:table-cell">
                {job.authorisedTotal > 0 ? formatCurrency(job.authorisedTotal) : '—'}
              </td>
              <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">
                <div className="hidden sm:block">{formatDate(job.createdAt)}</div>
                <div className={`font-mono font-bold ${job.daysSinceCreated > 30 ? 'text-red-400' : job.daysSinceCreated > 14 ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {job.daysSinceCreated}d
                </div>
              </td>
              <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap hidden md:table-cell">
                <div>{formatDate(job.updatedAt)}</div>
                <div className={`font-mono ${job.daysSinceUpdated > 7 ? 'text-yellow-600' : 'text-gray-600'}`}>
                  {job.daysSinceUpdated}d
                </div>
              </td>
              <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap hidden lg:table-cell">{job.updatedBy || '—'}</td>
              <td className="py-2 px-3">
                {job.primeUrl && <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
                  className="text-gray-500 hover:text-red-400"><ExternalLink size={14} /></a>}
              </td>
              {showAssistButton && (
                <td className="py-2 px-3">
                  <Link href={`/report-assist/${job.jobNumber}`}
                    className="flex items-center gap-1 text-xs bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded-md transition-colors whitespace-nowrap font-medium">
                    <FileEdit size={11} /> Create Report
                  </Link>
                </td>
              )}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={10} className="py-10 text-center text-gray-500 text-sm">No jobs in this category</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('no_report');
  const [sortKey, setSortKey] = useState<SortKey>('daysSinceCreated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [typeFilter, setTypeFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  useEffect(() => {
    fetch('/api/prime/jobs/reports')
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error || 'Failed')))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const activeJobs = data
    ? tab === 'no_report' ? data.noReportJobs
    : tab === 'in_progress' ? data.inProgressJobs
    : data.submittedJobs
    : [];

  const types   = Array.from(new Set(activeJobs.map(j => j.jobType).filter(Boolean))).sort();
  const regions = Array.from(new Set(activeJobs.map(j => j.region).filter(Boolean))).sort();

  const filtered = activeJobs.filter(j =>
    (!typeFilter   || j.jobType === typeFilter) &&
    (!regionFilter || j.region  === regionFilter)
  );

  const handleExport = () => {
    if (!data) return;
    const label = tab === 'no_report' ? 'no-report' : tab === 'in_progress' ? 'in-progress' : 'submitted';
    downloadCSV(
      `reports-${label}-${new Date().toISOString().split('T')[0]}.csv`,
      ['Job #', 'Status', 'Type', 'Region', 'Address', 'Auth Total', 'Created', 'Days Since Created', 'Last Updated', 'Days Since Updated', 'Updated By', 'Prime URL'],
      filtered.map(j => [j.jobNumber, j.status, j.jobType, j.region, j.address, j.authorisedTotal, j.createdAt, j.daysSinceCreated, j.updatedAt, j.daysSinceUpdated, j.updatedBy, j.primeUrl])
    );
  };

  if (loading) return <LoadingSpinner message="Loading report status…" />;
  if (error)   return <ErrorMessage message={error} />;
  if (!data)   return null;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Track which jobs have reports submitted to the insurer"
        actions={
          <button onClick={handleExport}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors">
            <Download size={14} /> Export CSV
          </button>
        }
      />

      {/* Critical alert */}
      {data.noReport > 0 && (
        <div className="mb-6 flex items-start gap-3 bg-red-950/40 border border-red-700/50 rounded-xl px-5 py-4">
          <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold text-sm">
              {data.noReport} open job{data.noReport !== 1 ? 's' : ''} with no report started
            </p>
            <p className="text-red-400/70 text-xs mt-0.5">
              These jobs have not had a report submitted to the insurer yet. Please review and action.
            </p>
          </div>
        </div>
      )}

      {/* KPI summary row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <button onClick={() => setTab('no_report')}
          className={`rounded-xl border p-5 text-left transition-all ${tab === 'no_report' ? 'border-red-500 bg-red-950/30 ring-1 ring-red-500/30' : 'border-red-800/50 bg-red-950/10 hover:border-red-600'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-red-300 font-medium">No Report Started</span>
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-red-400">{data.noReport}</p>
          <p className="text-xs text-red-400/60 mt-1">Flagged — action required</p>
        </button>

        <button onClick={() => setTab('in_progress')}
          className={`rounded-xl border p-5 text-left transition-all ${tab === 'in_progress' ? 'border-yellow-500 bg-yellow-950/30 ring-1 ring-yellow-500/30' : 'border-gray-800 bg-gray-900 hover:border-yellow-700'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-yellow-300 font-medium">Report In Progress</span>
            <Clock size={16} className="text-yellow-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-yellow-400">{data.inProgress}</p>
          <p className="text-xs text-gray-500 mt-1">Being prepared</p>
        </button>

        <button onClick={() => setTab('submitted')}
          className={`rounded-xl border p-5 text-left transition-all ${tab === 'submitted' ? 'border-green-500 bg-green-950/30 ring-1 ring-green-500/30' : 'border-gray-800 bg-gray-900 hover:border-green-700'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-green-300 font-medium">Report Submitted</span>
            <CheckCircle size={16} className="text-green-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-400">{data.submitted}</p>
          <p className="text-xs text-gray-500 mt-1">Awaiting insurer response</p>
        </button>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">Past Report Stage</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{data.postReport}</p>
          <p className="text-xs text-gray-500 mt-1">Works authorised / invoicing</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
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
        {(typeFilter || regionFilter) && (
          <button onClick={() => { setTypeFilter(''); setRegionFilter(''); }}
            className="text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg transition-colors">
            Clear
          </button>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} job{filtered.length !== 1 ? 's' : ''}
          {(typeFilter || regionFilter) ? ' (filtered)' : ''}
        </span>
      </div>

      {/* Job table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">
            {tab === 'no_report' ? '⚠️ No Report Started' : tab === 'in_progress' ? '🔄 Report In Progress' : '✅ Report Submitted'}
          </h2>
          <span className="text-xs text-gray-500">— sorted by oldest first</span>
        </div>
        <JobTable
          jobs={filtered}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          showAge={tab === 'submitted' ? 'updated' : 'created'}
          showAssistButton={tab === 'no_report'}
        />
      </div>
    </div>
  );
}
