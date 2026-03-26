'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { BarChartComponent } from '@/components/charts/BarChartComponent';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/prime-helpers';
import { ExternalLink, X, Download, ChevronUp, ChevronDown, ChevronsUpDown, BarChart2 } from 'lucide-react';
import { JobTypeBadge, StatusBadge } from '@/components/ui/StatusBadge';
import { downloadCSV } from '@/lib/export-csv';

interface StatusCount { status: string; count: number; statusType: string; }
interface WeekData { week: string; label: string; count: number; }
interface FlatJob {
  id: string; jobNumber: string; clientReference: string; address: string;
  status: string; jobType: string; region: string; authorisedTotal: number;
  updatedAt: string; updatedBy: string; createdAt: string; primeUrl: string;
}

function PipelineContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([]);
  const [allJobs, setAllJobs] = useState<FlatJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [regionFilter, setRegionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [chartsOpen, setChartsOpen] = useState(false);
  type SortKey = 'jobNumber' | 'address' | 'clientReference' | 'status' | 'jobType' | 'region' | 'authorisedTotal' | 'updatedAt';
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/prime/jobs/counts-by-status').then(r => r.json()),
      fetch('/api/prime/jobs/pipeline').then(r => r.json()),
      fetch('/api/prime/jobs/open').then(r => r.json()),
    ]).then(([countsData, pipelineData, jobsData]) => {
      setCounts(Array.isArray(countsData) ? countsData : []);
      setWeeklyData(Array.isArray(pipelineData) ? pipelineData : []);
      setAllJobs(Array.isArray(jobsData) ? jobsData : []);
    }).catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Filter + sort jobs
  const SortIcon = ({ col }: { col: SortKey }) => sortKey !== col
    ? <ChevronsUpDown size={11} className="text-gray-700" />
    : sortDir === 'asc' ? <ChevronUp size={11} className="text-red-400" /> : <ChevronDown size={11} className="text-red-400" />;

  const filtered = allJobs.filter(j => {
    if (statusFilter && j.status !== statusFilter) return false;
    if (regionFilter && j.region !== regionFilter) return false;
    if (typeFilter && j.jobType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return j.jobNumber.toLowerCase().includes(q) ||
        j.address.toLowerCase().includes(q) ||
        j.clientReference.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const regions = Array.from(new Set(allJobs.map(j => j.region).filter(r => r && r !== '—'))).sort();
  const types = Array.from(new Set(allJobs.map(j => j.jobType).filter(t => t && t !== '—'))).sort();

  const chartData = counts.slice(0, 12).map(s => ({ name: s.status, value: s.count }));

  const handleBarClick = (name: string) => {
    setStatusFilter(s => s === name ? '' : name);
    router.push(`/pipeline?status=${encodeURIComponent(name)}`, { scroll: false });
  };

  if (loading) return <LoadingSpinner message="Loading pipeline data..." />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div>
      <PageHeader title="Pipeline" subtitle="All open jobs — filter by status, region, or type" />

      {/* Charts — collapsible toggle */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 mb-6 overflow-hidden">
        <button
          onClick={() => setChartsOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-800/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-gray-400" />
            <span className="text-sm font-semibold text-white">Charts</span>
            <span className="text-xs text-gray-500">— Status breakdown &amp; weekly trend</span>
          </div>
          {chartsOpen
            ? <ChevronUp size={16} className="text-gray-500" />
            : <ChevronDown size={16} className="text-gray-500" />}
        </button>
        {chartsOpen && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 p-5 border-t border-gray-800">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Open Jobs by Status</h2>
              <p className="text-xs text-gray-500 mb-4">Click a bar to filter the job list below</p>
              <BarChartComponent data={chartData} height={260} onBarClick={handleBarClick} activeBar={statusFilter} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Jobs Created per Week</h2>
              <p className="text-xs text-gray-500 mb-4">Last 12 weeks</p>
              <BarChartComponent data={weeklyData.map(w => ({ name: w.label, value: w.count }))} height={260} />
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search job #, address, client ref..."
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 w-full sm:w-64"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 w-full sm:w-auto">
          <option value="">All Statuses</option>
          {counts.map(s => <option key={s.status} value={s.status}>{s.status} ({s.count})</option>)}
        </select>
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 w-full sm:w-auto">
          <option value="">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 w-full sm:w-auto">
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(statusFilter || regionFilter || typeFilter || search) && (
          <button onClick={() => { setStatusFilter(''); setRegionFilter(''); setTypeFilter(''); setSearch(''); }}
            className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm px-3 py-2 rounded-lg transition-colors">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Job count + export */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-sm text-gray-500">
          Showing <span className="text-white font-medium">{filtered.length}</span> of {allJobs.length} open jobs
          {statusFilter && <span className="ml-2 text-red-400 font-medium">— {statusFilter}</span>}
        </div>
        <button
          onClick={() => downloadCSV(
            `pipeline-${new Date().toISOString().split('T')[0]}.csv`,
            ['Job #', 'Address', 'Client Ref', 'Status', 'Type', 'Region', 'Auth Total', 'Updated', 'Updated By', 'Prime URL'],
            filtered.map(j => [j.jobNumber, j.address, j.clientReference, j.status, j.jobType, j.region, j.authorisedTotal, j.updatedAt, j.updatedBy, j.primeUrl])
          )}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Jobs table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                {([
                  { label: 'Job #',      col: 'jobNumber',        cls: '' },
                  { label: 'Address',    col: 'address',          cls: '' },
                  { label: 'Client Ref', col: 'clientReference',  cls: 'hidden md:table-cell' },
                  { label: 'Status',     col: 'status',           cls: '' },
                  { label: 'Type',       col: 'jobType',          cls: 'hidden sm:table-cell' },
                  { label: 'Region',     col: 'region',           cls: 'hidden md:table-cell' },
                  { label: 'Auth. Total',col: 'authorisedTotal',  cls: 'hidden sm:table-cell' },
                  { label: 'Updated',    col: 'updatedAt',        cls: 'hidden lg:table-cell' },
                ] as { label: string; col: SortKey; cls: string }[]).map(h => (
                  <th key={h.col}
                    onClick={() => handleSort(h.col)}
                    className={`py-3 px-3 text-xs text-gray-400 font-medium whitespace-nowrap text-left cursor-pointer select-none hover:text-white transition-colors ${h.cls}`}>
                    <span className="inline-flex items-center gap-1">{h.label}<SortIcon col={h.col} /></span>
                  </th>
                ))}
                <th className="py-3 px-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-500">No jobs match your filters</td></tr>
              ) : filtered.map((job, idx) => (
                <tr key={job.id} className={`border-b border-gray-800/40 hover:bg-gray-800/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-900/60'}`}>
                  <td className="py-2.5 px-3 font-mono text-red-400 text-xs whitespace-nowrap">
                    {job.primeUrl ? (
                      <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-red-300 underline underline-offset-2">
                        {job.jobNumber}
                      </a>
                    ) : job.jobNumber}
                  </td>
                  <td className="py-2.5 px-3 text-gray-300 max-w-[140px] truncate">{job.address}</td>
                  <td className="py-2.5 px-3 text-gray-400 text-xs whitespace-nowrap hidden md:table-cell">{job.clientReference || '—'}</td>
                  <td className="py-2.5 px-3">
                    <button onClick={() => setStatusFilter(s => s === job.status ? '' : job.status)} title="Click to filter by status">
                      <StatusBadge label={job.status} />
                    </button>
                  </td>
                  <td className="py-2.5 px-3 hidden sm:table-cell">
                    {job.jobType ? <JobTypeBadge label={job.jobType} /> : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-gray-400 text-xs whitespace-nowrap hidden md:table-cell">{job.region}</td>
                  <td className="py-2.5 px-3 text-right text-gray-300 text-xs whitespace-nowrap hidden sm:table-cell">{formatCurrency(job.authorisedTotal)}</td>
                  <td className="py-2.5 px-3 text-gray-500 text-xs whitespace-nowrap hidden lg:table-cell">
                    <div>{formatDate(job.updatedAt)}</div>
                    <div className="text-gray-600">{job.updatedBy}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    {job.primeUrl && (
                      <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
                        className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
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
    </div>
  );
}

export default function PipelinePage() {
  return <Suspense fallback={<LoadingSpinner message="Loading..." />}><PipelineContent /></Suspense>;
}
