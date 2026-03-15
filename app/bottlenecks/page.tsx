'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/prime-helpers';
import { downloadCSV } from '@/lib/export-csv';
import { ExternalLink, Download, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface FlatJob {
  id: string;
  jobNumber: string;
  address: string;
  clientReference: string;
  description: string;
  jobType: string;
  region: string;
  status: string;
  authorisedTotal: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  daysSince: number;
  primeUrl: string;
}

interface StatusGroup { status: string; count: number; jobs: FlatJob[]; }
interface BottleneckData { days: number; totalStuck: number; groups: StatusGroup[]; }

type SortKey = 'jobNumber' | 'jobType' | 'region' | 'status' | 'createdAt' | 'daysSince' | 'authorisedTotal';

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export default function BottlenecksPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<BottleneckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('daysSince');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [typeFilter, setTypeFilter] = useState('');
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'daysSince' ? 'desc' : 'asc'); }
  };

  // Flatten all groups into one list
  const allJobs: FlatJob[] = (data?.groups ?? []).flatMap(g =>
    g.jobs.map(j => ({ ...j, status: g.status }))
  );

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

  const SortTh = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      onClick={() => handleSort(col)}
      className="py-2 px-2 text-left text-gray-400 text-xs font-medium whitespace-nowrap cursor-pointer select-none hover:text-white transition-colors"
    >
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
      <PageHeader
        title="Bottlenecks"
        subtitle="Open jobs stuck without updates"
        actions={data && (
          <button onClick={handleExport}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors border border-gray-700">
            <Download size={14} /> Export CSV
          </button>
        )}
      />

      {/* Day threshold buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        {DAY_OPTIONS.map(d => (
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
          {/* Summary + filters */}
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
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No stuck jobs match your filters 🎉</div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/80">
                      <SortTh col="jobNumber"      label="Job #" />
                      <SortTh col="status"         label="Status" />
                      <SortTh col="jobType"        label="Type" />
                      <SortTh col="region"         label="Region" />
                      <th className="py-2 px-2 text-left text-gray-400 text-xs font-medium hidden md:table-cell">Address</th>
                      <th className="py-2 px-2 text-left text-gray-400 text-xs font-medium whitespace-nowrap hidden lg:table-cell">Client Ref</th>
                      <SortTh col="authorisedTotal" label="$" />
                      <SortTh col="createdAt"      label="Created" />
                      <SortTh col="daysSince"      label="Stuck" />
                      <th className="py-2 px-2 text-left text-gray-400 text-xs font-medium whitespace-nowrap hidden lg:table-cell">Updated By</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(job => (
                      <tr key={job.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-2 px-2 font-mono text-red-400 text-xs whitespace-nowrap">
                          {job.primeUrl
                            ? <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-red-300 underline underline-offset-2">{job.jobNumber || job.id}</a>
                            : job.jobNumber || job.id}
                        </td>
                        <td className="py-2 px-2 text-gray-300 text-xs max-w-[140px] truncate">{job.status}</td>
                        <td className="py-2 px-2 text-gray-400 text-xs whitespace-nowrap">{job.jobType || '—'}</td>
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
