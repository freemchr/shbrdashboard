'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import { FileEdit, AlertTriangle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface ReportJob {
  id: string;
  jobNumber: string;
  address: string;
  jobType: string;
  region: string;
  daysSinceCreated: number;
  createdAt: string;
  primeUrl: string;
}

type SortKey = 'jobNumber' | 'jobType' | 'region' | 'daysSinceCreated';

function SortTh({ col, label, sortKey, sortDir, onSort }: {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
}) {
  return (
    <th
      onClick={() => onSort(col)}
      className="py-3 px-4 text-left text-xs text-gray-500 font-medium whitespace-nowrap cursor-pointer select-none hover:text-white transition-colors"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === col
          ? sortDir === 'asc'
            ? <ChevronUp size={11} className="text-red-400" />
            : <ChevronDown size={11} className="text-red-400" />
          : <ChevronsUpDown size={11} className="text-gray-700" />}
      </span>
    </th>
  );
}

export default function ReportAssistPage() {
  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('daysSinceCreated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [typeFilter, setTypeFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  useEffect(() => {
    fetch('/api/prime/jobs/reports')
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error || 'Failed')))
      .then((data: { noReportJobs: ReportJob[] }) => setJobs(data.noReportJobs || []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const types = Array.from(new Set(jobs.map(j => j.jobType).filter(Boolean))).sort();
  const regions = Array.from(new Set(jobs.map(j => j.region).filter(Boolean))).sort();

  const filtered = jobs
    .filter(j =>
      (!typeFilter || j.jobType === typeFilter) &&
      (!regionFilter || j.region === regionFilter)
    )
    .sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });

  if (loading) return <LoadingSpinner message="Loading jobs without reports…" />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div>
      <PageHeader
        title="Report Assist"
        subtitle="AI-powered assessment report wizard — create and upload reports to Prime for jobs pending submission"
        actions={
          <div className="flex items-center gap-2 bg-red-950/30 border border-red-700/50 rounded-lg px-4 py-2">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-red-300 text-sm font-medium">{jobs.length} jobs need reports</span>
          </div>
        }
      />

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 bg-blue-950/30 border border-blue-700/40 rounded-xl px-5 py-4">
        <FileEdit size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-300 font-semibold text-sm">How Report Assist works</p>
          <p className="text-gray-400 text-xs mt-1">
            Select a job to open the AI-powered report wizard. Job data is pre-filled from Prime. Use the ✨ Enhance button on each section to get professional language suggestions. When complete, generate a branded PDF and upload it directly to Prime.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto"
        >
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={regionFilter}
          onChange={e => setRegionFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto"
        >
          <option value="">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(typeFilter || regionFilter) && (
          <button
            onClick={() => { setTypeFilter(''); setRegionFilter(''); }}
            className="text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} job{filtered.length !== 1 ? 's' : ''}{(typeFilter || regionFilter) ? ' (filtered)' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">⚠️ Jobs Without Reports</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <SortTh col="jobNumber" label="Job #" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="py-3 px-4 text-left text-xs text-gray-500 font-medium">Address</th>
                <SortTh col="jobType" label="Type" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="region" label="Region" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="daysSinceCreated" label="Age" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="py-3 px-4 text-left text-xs text-gray-500 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(job => (
                <tr key={job.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                    <span className="text-red-400">{job.jobNumber}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-300 text-xs max-w-[150px] truncate">{job.address}</td>
                  <td className="py-3 px-4 text-xs text-gray-400 whitespace-nowrap hidden sm:table-cell">{job.jobType || '—'}</td>
                  <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap hidden sm:table-cell">{job.region || '—'}</td>
                  <td className="py-3 px-4 text-xs whitespace-nowrap">
                    <span className={`font-mono font-bold ${
                      job.daysSinceCreated > 30 ? 'text-red-400' :
                      job.daysSinceCreated > 14 ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>
                      {job.daysSinceCreated}d ago
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/report-assist/${job.jobNumber}`}
                      className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <FileEdit size={12} />
                      Create Report →
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 text-sm">
                    No jobs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
