'use client';

import { useEffect, useState, useRef } from 'react';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate, formatCurrency } from '@/lib/prime-helpers';
import { ExternalLink, Briefcase, AlertTriangle, Calendar, Hash, X, ChevronRight, FileText, LayoutGrid, List, ChevronLeft, ChevronsUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { DataRefreshButton } from '@/components/ui/DataRefreshButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { JobTypeBadge } from '@/components/ui/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts';
import type { TrendsResult } from '@/app/api/prime/jobs/trends/route';

interface Kpis {
  totalJobs: number;
  openStatusCount: number;
  createdThisWeek: number;
  createdThisMonth: number;
  stuckOver7Days: number;
}

interface StatusCount { status: string; count: number; statusType: string; }

interface ChartEntry { name: string; value: number; delta: number | null; }

interface FlatJob {
  id: string;
  jobNumber: string;
  address: string;
  clientReference: string;
  status: string;
  jobType: string;
  region: string;
  authorisedTotal: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  primeUrl: string;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; payload?: ChartEntry }[]; label?: string }) => {
  if (active && payload?.length) {
    const delta = payload[0].payload?.delta;
    const deltaStr = delta === null || delta === undefined ? null
      : delta === 0 ? 'No change'
      : delta > 0 ? `+${delta} since last snapshot`
      : `${delta} since last snapshot`;
    const deltaColour = delta === null || delta === undefined || delta === 0
      ? 'text-gray-500'
      : delta > 0 ? 'text-red-400' : 'text-emerald-400';
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
        <p className="text-gray-300 font-medium mb-0.5">{label}</p>
        <p className="text-red-400 font-bold">{payload[0].value} jobs</p>
        {deltaStr && <p className={`text-xs mt-0.5 ${deltaColour}`}>{deltaStr}</p>}
      </div>
    );
  }
  return null;
};

function JobRow({ job }: { job: FlatJob }) {
  return (
    <div className="flex items-start justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {job.primeUrl ? (
            <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
              className="font-mono text-red-400 text-xs hover:text-red-300 underline underline-offset-2 font-semibold">
              {job.jobNumber}
            </a>
          ) : (
            <span className="font-mono text-red-400 text-xs font-semibold">{job.jobNumber}</span>
          )}
          {job.clientReference && <span className="text-xs text-gray-500 font-mono">{job.clientReference}</span>}
          {job.jobType && <JobTypeBadge label={job.jobType} />}
          {job.region && <span className="text-xs text-gray-500">{job.region}</span>}
        </div>
        <p className="text-gray-300 truncate mt-0.5 text-xs">{job.address}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <p className="text-gray-600 text-xs">Updated {formatDate(job.updatedAt)} · {job.updatedBy || '—'}</p>
          {job.authorisedTotal > 0 && <p className="text-gray-500 text-xs font-mono">{formatCurrency(job.authorisedTotal)}</p>}
        </div>
      </div>
      {job.primeUrl && (
        <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
          className="text-gray-500 hover:text-red-400 flex-shrink-0 mt-0.5">
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}

function JobListRow({ job }: { job: FlatJob }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors text-xs">
      <div className="w-28 flex-shrink-0">
        {job.primeUrl
          ? <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
              className="font-mono text-red-400 hover:text-red-300 underline underline-offset-2 font-semibold">{job.jobNumber}</a>
          : <span className="font-mono text-red-400 font-semibold">{job.jobNumber}</span>}
      </div>
      <div className="flex-1 min-w-0 max-w-[280px] text-gray-300 truncate">{job.address}</div>
      <div className="w-36 flex-shrink-0 text-gray-500 truncate hidden md:block">{job.jobType || '—'}</div>
      <div className="w-36 flex-shrink-0 text-gray-500 truncate hidden lg:block">{job.region || '—'}</div>
      <div className="w-28 flex-shrink-0 text-gray-600 hidden xl:block">{formatDate(job.updatedAt)}</div>
      <div className="w-24 flex-shrink-0 text-gray-500 truncate hidden xl:block">{job.updatedBy || '—'}</div>
      <div className="w-24 flex-shrink-0 text-gray-400 font-mono text-right hidden lg:block">
        {job.authorisedTotal > 0 ? formatCurrency(job.authorisedTotal) : '—'}
      </div>
      <div className="ml-auto flex-shrink-0 pl-3">
        {job.primeUrl
          ? <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-gray-500 hover:text-red-400 transition-colors font-medium whitespace-nowrap">
              Prime <ExternalLink size={12} />
            </a>
          : <span className="text-gray-700 text-xs">—</span>
        }
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [openJobs, setOpenJobs] = useState<FlatJob[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [openCounts, setOpenCounts] = useState<StatusCount[]>([]);
  const [trends, setTrends] = useState<TrendsResult | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [kpiPanel, setKpiPanel] = useState<'open' | 'stuck' | 'week' | 'month' | null>(null);
  const [viewMode, setViewMode] = useState<'tile' | 'list'>('tile');
  type SortKey = 'job' | 'type' | 'region' | 'value' | 'updated';
  const [sortKey, setSortKey]   = useState<SortKey>('updated');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');

  const handleDrillSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'value' ? 'desc' : 'asc'); }
  };

  const sortJobs = (jobs: FlatJob[]) => [...jobs].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'job':     cmp = a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true }); break;
      case 'type':    cmp = (a.jobType || '').localeCompare(b.jobType || ''); break;
      case 'region':  cmp = (a.region  || '').localeCompare(b.region  || ''); break;
      case 'value':   cmp = a.authorisedTotal - b.authorisedTotal; break;
      case 'updated': cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
  const [noReportCount, setNoReportCount] = useState<number | null>(null);
  const drilldownRef = useRef<HTMLDivElement>(null);
  const chartScrollRef = useRef<HTMLDivElement>(null);

  const scrollChart = (dir: 'left' | 'right') => {
    if (!chartScrollRef.current) return;
    chartScrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  const scrollToDrilldown = () =>
    setTimeout(() => drilldownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);

  const openKpiPanel = (panel: 'open' | 'stuck' | 'week' | 'month') => {
    setSelectedStatus(null); // close bar chart drilldown
    setKpiPanel(p => { const next = p === panel ? null : panel; if (next) scrollToDrilldown(); return next; });
  };

  const openBarDrilldown = (name: string) => {
    setKpiPanel(null); // close KPI panel
    setSelectedStatus(p => { const next = p === name ? null : name; if (next) scrollToDrilldown(); return next; });
  };

  useEffect(() => {
    fetch('/api/prime/jobs/open')
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load open jobs'))
      .then(d => setOpenJobs(Array.isArray(d) ? d : []))
      .catch(e => setError(String(e)))
      .finally(() => setLoadingJobs(false));

    fetch('/api/prime/jobs/kpis')
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(d => setKpis(d))
      .catch(() => setKpis(null))
      .finally(() => setLoadingKpis(false));

    fetch('/api/prime/jobs/counts-by-status')
      .then(r => r.ok ? r.json() : [])
      .then(d => setOpenCounts(Array.isArray(d) ? d.filter((s: StatusCount) => s.statusType === 'Open') : []))
      .catch(() => setOpenCounts([]))
      .finally(() => setLoadingCounts(false));

    fetch('/api/prime/jobs/trends')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setTrends(d))
      .catch(() => null);

    // Fetch report alert count (lightweight — uses cached data)
    fetch('/api/prime/jobs/reports')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setNoReportCount(d.noReport))
      .catch(() => null);
  }, []);

  const totalOpen = openCounts.reduce((sum, s) => sum + s.count, 0);

  // All statuses for the scrollable bar chart — enrich with trend deltas
  const chartData: ChartEntry[] = openCounts.map(s => {
    const d = trends?.statusDeltas?.[s.status];
    const delta = d && d.previous !== null ? d.current - d.previous : null;
    return { name: s.status, value: s.count, delta };
  });
  // Dynamic chart width: at least 600px, 60px per bar
  const chartWidth = Math.max(600, chartData.length * 60);

  // Custom label rendered above each bar showing ↑/↓ delta
  const DeltaLabel = (props: { x?: number; y?: number; width?: number; value?: number; index?: number }) => {
    const { x = 0, y = 0, width = 0, index = 0 } = props;
    const entry = chartData[index];
    if (!entry || entry.delta === null) return null;
    if (entry.delta === 0) return null;
    const up = entry.delta > 0;
    const colour = up ? '#f87171' : '#34d399'; // red up, green down
    const arrow = up ? '↑' : '↓';
    return (
      <text
        x={x + width / 2}
        y={y - 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill={colour}
      >
        {arrow}{Math.abs(entry.delta)}
      </text>
    );
  };

  // Prime returns dates as "2026-03-15 09:00:00" — replace space with T so all browsers parse correctly
  const pd = (s?: string) => s ? new Date(s.replace(' ', 'T')) : null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const stuckJobs = openJobs.filter(j => { const d = pd(j.updatedAt); return d && d <= sevenDaysAgo; })
    .sort((a, b) => (pd(a.updatedAt)?.getTime() ?? 0) - (pd(b.updatedAt)?.getTime() ?? 0));
  const weekJobs  = openJobs.filter(j => { const d = pd(j.createdAt); return d && d >= weekStart; })
    .sort((a, b) => (pd(b.createdAt)?.getTime() ?? 0) - (pd(a.createdAt)?.getTime() ?? 0));
  const monthJobs = openJobs.filter(j => { const d = pd(j.createdAt); return d && d >= monthStart; })
    .sort((a, b) => (pd(b.createdAt)?.getTime() ?? 0) - (pd(a.createdAt)?.getTime() ?? 0));

  const kpiPanelData = {
    open:  { title: 'All Open Jobs',              jobs: [...openJobs].sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) },
    stuck: { title: 'Stuck >7 Days (Open Jobs)',  jobs: stuckJobs },
    week:  { title: 'Created This Week',          jobs: weekJobs },
    month: { title: 'Created This Month',         jobs: monthJobs },
  };

  const drilledJobs = selectedStatus
    ? openJobs
        .filter(j => j.status.trim().toLowerCase() === selectedStatus.trim().toLowerCase())
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    : [];

  const reportQuoteJobs = openJobs
    .filter(j => j.status === 'Report/Quote Sent')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (data: any) => {
    // Works for both BarChart onClick (activePayload) and Bar onClick (direct payload)
    const name = data?.name ?? data?.activePayload?.[0]?.payload?.name;
    if (!name) return;
    openBarDrilldown(name);
  };

  return (
    <div>
      <PageHeader title="Overview" subtitle="Real-time snapshot of SHBR operations" actions={<DataRefreshButton />} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <KpiCard title="Total Jobs" value={loadingKpis ? '…' : (kpis?.totalJobs ?? '—')} icon={<Hash size={18} />} />
        <KpiCard title="Open Jobs" value={loadingCounts ? '…' : totalOpen} icon={<Briefcase size={18} />}
          onClick={() => openKpiPanel('open')} active={kpiPanel === 'open'} subtitle="Click to view ↓" />
        <KpiCard title="Stuck >7 Days" value={loadingKpis ? '…' : (kpis?.stuckOver7Days ?? '—')}
          icon={<AlertTriangle size={18} />} accent={!loadingKpis && (kpis?.stuckOver7Days ?? 0) > 0}
          onClick={() => openKpiPanel('stuck')} active={kpiPanel === 'stuck'} subtitle="Click to view ↓" />
        <KpiCard title="Created This Week" value={loadingKpis ? '…' : (kpis?.createdThisWeek ?? '—')}
          icon={<Calendar size={18} />}
          onClick={() => openKpiPanel('week')} active={kpiPanel === 'week'} subtitle="Click to view ↓" />
        <KpiCard title="Created This Month" value={loadingKpis ? '…' : (kpis?.createdThisMonth ?? '—')}
          icon={<Calendar size={18} />}
          onClick={() => openKpiPanel('month')} active={kpiPanel === 'month'} subtitle="Click to view ↓" />
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Report alert banner */}
      {noReportCount !== null && noReportCount > 0 && (
        <Link href="/reports"
          className="flex items-center justify-between gap-4 mb-6 bg-red-950/40 border border-red-700/50 rounded-xl px-5 py-4 hover:bg-red-950/60 transition-colors group">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
            <div>
              <p className="text-red-300 font-semibold text-sm">
                {noReportCount} open job{noReportCount !== 1 ? 's' : ''} with no report submitted to insurer
              </p>
              <p className="text-red-400/60 text-xs mt-0.5">Reports not yet submitted. Click to review and action.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-red-400 text-xs font-medium flex-shrink-0 group-hover:text-red-300">
            <FileText size={14} />
            View Reports
            <ChevronRight size={14} />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">

        {/* Scrollable bar chart — all statuses */}
        <div className="xl:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-3 sm:p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-lg font-semibold text-white">Open Jobs by Status</h2>
              {trends?.snapshotAge && (
                <p className="text-xs text-gray-600 mt-0.5">↑↓ week on week</p>
              )}
            </div>
            {!loadingCounts && chartData.length > 0 && (
              <div className="flex items-center gap-1">
                <button onClick={() => scrollChart('left')}
                  className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => scrollChart('right')}
                  className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-4">Click a bar to see those jobs below ↓</p>

          {loadingCounts ? (
            <LoadingSpinner message="Loading status counts…" />
          ) : chartData.length === 0 ? (
            <EmptyState variant="default" heading="No status data" body="No open job statuses to display." />
          ) : (
            <div ref={chartScrollRef} className="overflow-x-auto scrollbar-hide">
              <div style={{ width: chartWidth, minWidth: '100%' }}>
                <BarChart
                  width={chartWidth}
                  height={300}
                  data={chartData}
                  margin={{ top: 22, right: 10, left: 0, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    angle={-40}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} width={32} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(220,38,38,0.08)' }} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                    {chartData.map(entry => (
                      <Cell
                        key={entry.name}
                        fill={selectedStatus === entry.name ? '#f87171' : '#DC2626'}
                        opacity={selectedStatus && selectedStatus !== entry.name ? 0.45 : 1}
                      />
                    ))}
                    <LabelList content={<DeltaLabel />} />
                  </Bar>
                </BarChart>
              </div>
            </div>
          )}
        </div>

        {/* Report/Quote Sent */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Report/Quote Sent</h2>
              <p className="text-xs text-gray-500 mt-0.5">Awaiting client response</p>
            </div>
            {!loadingJobs && (
              <span className="text-sm font-bold text-red-400 bg-red-900/20 px-3 py-1 rounded-full border border-red-900/40">
                {reportQuoteJobs.length}
              </span>
            )}
          </div>
          {loadingJobs ? (
            <LoadingSpinner message="Loading…" />
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {reportQuoteJobs.slice(0, 30).map(job => <JobRow key={job.id} job={job} />)}
              {reportQuoteJobs.length === 0 && <EmptyState variant="jobs" heading="No jobs" body="No Report/Quote Sent jobs." />}
              {reportQuoteJobs.length > 30 && (
                <p className="text-xs text-gray-600 text-center pt-2">+{reportQuoteJobs.length - 30} more · use Job Search</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Shared drilldown panel — bar chart status OR KPI card */}
      {(selectedStatus || kpiPanel) && (() => {
        const isKpi = !!kpiPanel;
        const panel = isKpi ? kpiPanelData[kpiPanel!] : null;
        const title = isKpi ? panel!.title : selectedStatus!;
        const rawJobs = isKpi ? panel!.jobs : drilledJobs;
        const jobs  = sortJobs(rawJobs);
        const close = isKpi ? () => setKpiPanel(null) : () => setSelectedStatus(null);

        const SortIcon = ({ col }: { col: SortKey }) => {
          if (sortKey !== col) return <ChevronsUpDown size={11} className="text-gray-700" />;
          return sortDir === 'asc'
            ? <ChevronUp size={11} className="text-red-400" />
            : <ChevronDown size={11} className="text-red-400" />;
        };

        const SortBtn = ({ col, label, cls = '' }: { col: SortKey; label: string; cls?: string }) => (
          <button
            onClick={() => handleDrillSort(col)}
            className={`flex items-center gap-1 hover:text-white transition-colors select-none cursor-pointer ${sortKey === col ? 'text-red-400' : 'text-gray-500'} ${cls}`}
          >
            {label}<SortIcon col={col} />
          </button>
        );

        return (
          <div ref={drilldownRef} className="bg-gray-900 rounded-xl border border-red-900/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <ChevronRight size={16} className="text-red-400 flex-shrink-0" />
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {loadingJobs ? '…' : `${jobs.length} job${jobs.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  <button onClick={() => setViewMode('tile')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'tile' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    <LayoutGrid size={13} /> Tiles
                  </button>
                  <button onClick={() => setViewMode('list')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'list' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    <List size={13} /> List
                  </button>
                </div>
                <button onClick={close}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors">
                  <X size={13} /> Close
                </button>
              </div>
            </div>

            {/* Sort controls */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-xs font-medium">
              <span className="text-gray-600">Sort:</span>
              <SortBtn col="job"     label="Job #" />
              <SortBtn col="type"    label="Type" />
              <SortBtn col="region"  label="Region" />
              <SortBtn col="value"   label="Value" />
              <SortBtn col="updated" label="Updated" />
            </div>

            {loadingJobs ? (
              <LoadingSpinner message="Loading jobs…" />
            ) : jobs.length === 0 ? (
              <EmptyState variant="jobs" heading="No jobs found" body="No jobs match this status." />
            ) : viewMode === 'tile' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {jobs.slice(0, 90).map(job => <JobRow key={job.id} job={job} />)}
                </div>
                {jobs.length > 90 && (
                  <p className="text-xs text-gray-600 text-center mt-4">
                    Showing 90 of {jobs.length} · use Job Search to see all
                  </p>
                )}
              </>
            ) : (
              <>
                {/* List view header */}
                <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-medium border-b border-gray-800 mb-1">
                  <div className="w-28 flex-shrink-0"><SortBtn col="job" label="Job #" /></div>
                  <div className="flex-1 min-w-0 max-w-[280px] text-gray-500">Address</div>
                  <div className="w-36 flex-shrink-0 hidden md:block"><SortBtn col="type" label="Type" /></div>
                  <div className="w-36 flex-shrink-0 hidden lg:block"><SortBtn col="region" label="Region" /></div>
                  <div className="w-28 flex-shrink-0 hidden xl:block"><SortBtn col="updated" label="Updated" /></div>
                  <div className="w-24 flex-shrink-0 hidden xl:block text-gray-500">By</div>
                  <div className="w-24 flex-shrink-0 hidden lg:block text-right"><SortBtn col="value" label="Value" /></div>
                  <div className="ml-auto flex-shrink-0 pl-3 text-gray-600">Link</div>
                </div>
                <div className="rounded-lg border border-gray-800 overflow-hidden">
                  {jobs.slice(0, 200).map(job => <JobListRow key={job.id} job={job} />)}
                </div>
                {jobs.length > 200 && (
                  <p className="text-xs text-gray-600 text-center mt-4">
                    Showing 200 of {jobs.length} · use Job Search to see all
                  </p>
                )}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
