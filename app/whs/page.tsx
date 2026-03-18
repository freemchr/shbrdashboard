'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import { formatDate } from '@/lib/prime-helpers';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
} from 'recharts';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileX,
  Activity,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface TrendPoint {
  month: string;
  completed: number;
  total: number;
  rate: number;
}

interface AwaitingItem {
  id: string;
  number?: string;
  jobId: string;
  jobNumber?: string;
  primeUrl?: string;
  location?: string;
  assignedContact?: string;
  createdAt: string;
  daysPending: number;
}

interface NoSwmsJob {
  id: string;
  jobNumber?: string;
  location?: string;
  jobType?: string;
  region?: string;
  primeUrl?: string;
  daysSinceCreated: number;
}

interface WHSData {
  asOf: string;
  total: number;
  notStarted: number;
  inProgress: number;
  awaitingApproval: number;
  completed: number;
  completionRate: number;
  avgApprovalDays: number;
  coverageRate: number;
  openJobsTotal: number;
  openJobsWithSwms: number;
  openJobsNoSwms: number;
  trend: TrendPoint[];
  awaitingList: AwaitingItem[];
  noSwmsList: NoSwmsJob[];
}

// Traffic light colour logic
function trafficLight(
  value: number,
  thresholds: { green: number; amber: number },
  higherIsBetter = true
): { color: string; bg: string; border: string; dot: string; label: string } {
  const isGreen = higherIsBetter ? value >= thresholds.green : value <= thresholds.green;
  const isAmber = higherIsBetter
    ? value >= thresholds.amber && value < thresholds.green
    : value > thresholds.green && value <= thresholds.amber;

  if (isGreen) {
    return {
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      dot: 'bg-emerald-400',
      label: 'Good',
    };
  } else if (isAmber) {
    return {
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      dot: 'bg-amber-400',
      label: 'Attention',
    };
  } else {
    return {
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      dot: 'bg-red-400',
      label: 'Action Required',
    };
  }
}

function formatMonth(m: string) {
  const [year, month] = m.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleString('en-AU', {
    month: 'short',
    year: '2-digit',
  });
}

function DotIndicator({ color }: { color: string }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  subtext,
  tl,
  small,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  tl: ReturnType<typeof trafficLight>;
  small?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${tl.bg} ${tl.border}`}>
      <div className="flex items-start justify-between gap-1 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon size={14} className={`${tl.color} flex-shrink-0`} />
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide leading-tight">{label}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <DotIndicator color={tl.dot} />
          <span className={`text-xs font-semibold ${tl.color} whitespace-nowrap`}>{tl.label}</span>
        </div>
      </div>
      <div className={`font-bold ${tl.color} ${small ? 'text-2xl' : 'text-3xl'}`}>{value}</div>
      {subtext && <div className="text-xs text-gray-500 leading-tight">{subtext}</div>}
    </div>
  );
}

const PAGE_SIZE = 25;

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={11} className="text-gray-700" />;
  return dir === 'asc' ? <ChevronUp size={11} className="text-red-400" /> : <ChevronDown size={11} className="text-red-400" />;
}

function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
      <span>{total} records · page {page} of {pages}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="p-1 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          const p = pages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= pages - 3 ? pages - 6 + i : page - 3 + i;
          return (
            <button key={p} onClick={() => onChange(p)}
              className={`w-6 h-6 rounded text-xs transition-colors ${p === page ? 'bg-red-600 text-white' : 'hover:bg-gray-800'}`}>
              {p}
            </button>
          );
        })}
        <button onClick={() => onChange(page + 1)} disabled={page === pages}
          className="p-1 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function WHSPage() {
  const [data, setData] = useState<WHSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'awaiting' | 'noswms'>('awaiting');

  // Awaiting table state
  const [awaitSort, setAwaitSort] = useState<keyof AwaitingItem>('daysPending');
  const [awaitDir, setAwaitDir] = useState<'asc' | 'desc'>('desc');
  const [awaitPage, setAwaitPage] = useState(1);

  // No SWMS table state
  const [noSwmsSort, setNoSwmsSort] = useState<keyof NoSwmsJob>('daysSinceCreated');
  const [noSwmsDir, setNoSwmsDir] = useState<'asc' | 'desc'>('desc');
  const [noSwmsPage, setNoSwmsPage] = useState(1);

  const handleAwaitSort = (col: keyof AwaitingItem) => {
    if (awaitSort === col) setAwaitDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setAwaitSort(col); setAwaitDir('asc'); }
    setAwaitPage(1);
  };
  const handleNoSwmsSort = (col: keyof NoSwmsJob) => {
    if (noSwmsSort === col) setNoSwmsDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setNoSwmsSort(col); setNoSwmsDir('asc'); }
    setNoSwmsPage(1);
  };

  const [notReady, setNotReady] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    setNotReady(false);
    fetch('/api/prime/whs')
      .then(async (r) => {
        const json = await r.json();
        if (r.status === 503 && json?.error === 'not_ready') {
          setNotReady(true);
          setLoading(false);
          return;
        }
        if (!r.ok) throw new Error(json?.message || 'Failed to load WHS data');
        setData(json);
        setLoading(false);
      })
      .catch((e) => { setError(String(e)); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <LoadingSpinner message="Loading WHS data…" />;
  if (error) return <ErrorMessage message={error} />;
  if (notReady) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
        </div>
        <h2 className="text-white text-lg font-semibold">WHS data not yet built</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          The WHS dataset is a <strong className="text-gray-300">weekly snapshot</strong> rebuilt every Monday morning.
          It hasn&apos;t been built yet — contact your administrator to run the first refresh.
        </p>

      </div>
    </div>
  );
  if (!data) return null;

  const completionTL = trafficLight(data.completionRate, { green: 75, amber: 50 });
  const coverageTL = trafficLight(data.coverageRate, { green: 80, amber: 60 });
  const awaitingTL = trafficLight(data.awaitingApproval, { green: 3, amber: 8 }, false);
  const notStartedTL = trafficLight(data.notStarted, { green: 2, amber: 5 }, false);
  const approvalTL = trafficLight(data.avgApprovalDays, { green: 3, amber: 7 }, false);
  const noSwmsTL = trafficLight(data.openJobsNoSwms, { green: 5, amber: 15 }, false);

  // Donut-style status distribution data for bar chart
  const statusDist = [
    { name: 'Completed', value: data.completed, fill: '#10b981' },
    { name: 'In Progress', value: data.inProgress, fill: '#f59e0b' },
    { name: 'Awaiting', value: data.awaitingApproval, fill: '#3b82f6' },
    { name: 'Not Started', value: data.notStarted, fill: '#ef4444' },
  ].filter((d) => d.value > 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <PageHeader
            title="WHS — Safety Compliance"
            subtitle={`SWMS / TMP site forms · Last 180 days · ${data.total} total forms`}
          />
        </div>

        {/* Data freshness banner */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
          <svg className="w-3.5 h-3.5 flex-shrink-0 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <strong className="text-blue-200">Weekly snapshot</strong>
            {' '}— data refreshed every <strong className="text-blue-200">Monday morning</strong>.
            {' '}Last updated:{' '}
            <strong className="text-blue-200">
              {new Date(data.asOf).toLocaleString('en-AU', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short',
                timeZone: 'Australia/Sydney',
              })}
            </strong>
          </span>
        </div>

        {/* ── Traffic Light KPI Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile
            icon={CheckCircle2}
            label="Completion Rate"
            value={`${data.completionRate}%`}
            subtext={`${data.completed} of ${data.total} forms completed`}
            tl={completionTL}
          />
          <KpiTile
            icon={ShieldCheck}
            label="SWMS Coverage"
            value={`${data.coverageRate}%`}
            subtext={`${data.openJobsWithSwms} of ${data.openJobsTotal} open jobs have SWMS`}
            tl={coverageTL}
          />
          <KpiTile
            icon={Clock}
            label="Awaiting Approval"
            value={data.awaitingApproval}
            subtext="Forms pending sign-off"
            tl={awaitingTL}
            small
          />
          <KpiTile
            icon={ShieldAlert}
            label="Not Started"
            value={data.notStarted}
            subtext="SWMS created but untouched"
            tl={notStartedTL}
            small
          />
          <KpiTile
            icon={Activity}
            label="Avg Approval Time"
            value={`${data.avgApprovalDays}d`}
            subtext="From creation to approval"
            tl={approvalTL}
          />
          <KpiTile
            icon={FileX}
            label="Jobs Without SWMS"
            value={data.openJobsNoSwms}
            subtext={`Open jobs with no SWMS on file`}
            tl={noSwmsTL}
            small
          />
        </div>

        {/* ── Traffic Light Legend ── */}
        <div className="flex items-center gap-5 text-xs text-gray-500 flex-wrap">
          <span className="font-medium text-gray-400">Traffic light thresholds:</span>
          <span className="flex items-center gap-1.5"><DotIndicator color="bg-emerald-400" /> Green = target met</span>
          <span className="flex items-center gap-1.5"><DotIndicator color="bg-amber-400" /> Amber = attention needed</span>
          <span className="flex items-center gap-1.5"><DotIndicator color="bg-red-400" /> Red = action required</span>
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Status Distribution */}
          <div className="bg-[#111111] rounded-xl border border-gray-800 p-5">
            <h3 className="text-sm font-semibold text-white mb-1">SWMS Status Distribution</h3>
            <p className="text-xs text-gray-500 mb-4">All forms in the last 180 days</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusDist} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  width={80}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e5e7eb' }}
                  itemStyle={{ color: '#9ca3af' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22}>
                  {statusDist.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Completion Trend */}
          <div className="bg-[#111111] rounded-xl border border-gray-800 p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Monthly Completion Trend</h3>
            <p className="text-xs text-gray-500 mb-4">
              Completion rate % and total forms created per month
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.trend.map((t) => ({ ...t, month: formatMonth(t.month) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e5e7eb' }}
                  itemStyle={{ color: '#9ca3af' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.05)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="rate"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981' }}
                  name="Completion %"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="total"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#6366f1' }}
                  name="Forms Created"
                  strokeDasharray="4 2"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Detail Tables ── */}
        <div className="bg-[#111111] rounded-xl border border-gray-800">
          {/* Tab switcher */}
          <div className="flex border-b border-gray-800">
            <button onClick={() => setTab('awaiting')}
              className={`px-5 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'awaiting' ? 'text-white border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-300'}`}>
              <Clock size={14} />
              Awaiting Approval
              {data.awaitingApproval > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${awaitingTL.color === 'text-red-400' ? 'bg-red-500/20 text-red-400' : awaitingTL.color === 'text-amber-400' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {data.awaitingApproval}
                </span>
              )}
            </button>
            <button onClick={() => setTab('noswms')}
              className={`px-5 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'noswms' ? 'text-white border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-300'}`}>
              <AlertTriangle size={14} />
              Open Jobs Without SWMS
              {data.openJobsNoSwms > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${noSwmsTL.color === 'text-red-400' ? 'bg-red-500/20 text-red-400' : noSwmsTL.color === 'text-amber-400' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {data.openJobsNoSwms}
                </span>
              )}
            </button>
          </div>

          {/* ── Awaiting Approval table ── */}
          {tab === 'awaiting' && (() => {
            const sorted = [...data.awaitingList].sort((a, b) => {
              const av = a[awaitSort] ?? ''; const bv = b[awaitSort] ?? '';
              const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
              return awaitDir === 'asc' ? cmp : -cmp;
            });
            const paged = sorted.slice((awaitPage - 1) * PAGE_SIZE, awaitPage * PAGE_SIZE);
            type ACol = keyof AwaitingItem;
            const Th = ({ col, label }: { col: ACol; label: string }) => (
              <th onClick={() => handleAwaitSort(col)}
                className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap">
                <span className="inline-flex items-center gap-1">{label}<SortIcon active={awaitSort === col} dir={awaitDir} /></span>
              </th>
            );
            return data.awaitingList.length === 0 ? (
              <div className="py-10 text-center"><CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-3" /><p className="text-gray-400 text-sm">No forms awaiting approval — all clear!</p></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-800">
                      <Th col="number" label="SWMS #" />
                      <Th col="jobNumber" label="Job #" />
                      <Th col="location" label="Location" />
                      <Th col="assignedContact" label="Assigned To" />
                      <Th col="createdAt" label="Created" />
                      <Th col="daysPending" label="Days Pending" />
                    </tr></thead>
                    <tbody>
                      {paged.map((item, i) => {
                        const urgency = item.daysPending >= 7 ? 'text-red-400' : item.daysPending >= 3 ? 'text-amber-400' : 'text-emerald-400';
                        return (
                          <tr key={item.id} className={`border-b border-gray-900 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'} hover:bg-white/5 transition-colors`}>
                            <td className="py-2.5 px-4 font-mono text-xs text-gray-300">{item.number || '—'}</td>
                            <td className="py-2.5 px-4 text-xs">
                              {item.primeUrl ? (
                                <a href={item.primeUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 font-semibold underline underline-offset-2">
                                  {item.jobNumber || item.jobId}
                                </a>
                              ) : <span className="text-gray-400">{item.jobNumber || item.jobId || '—'}</span>}
                            </td>
                            <td className="py-2.5 px-4 text-xs text-gray-400">{item.location || '—'}</td>
                            <td className="py-2.5 px-4 text-xs text-gray-300">{item.assignedContact || '—'}</td>
                            <td className="py-2.5 px-4 text-xs text-gray-400">{formatDate(item.createdAt)}</td>
                            <td className={`py-2.5 px-4 text-xs font-bold ${urgency}`}>{item.daysPending}d</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination page={awaitPage} total={sorted.length} pageSize={PAGE_SIZE} onChange={setAwaitPage} />
              </>
            );
          })()}

          {/* ── No SWMS jobs table ── */}
          {tab === 'noswms' && (() => {
            const sorted = [...data.noSwmsList].sort((a, b) => {
              const av = a[noSwmsSort] ?? ''; const bv = b[noSwmsSort] ?? '';
              const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
              return noSwmsDir === 'asc' ? cmp : -cmp;
            });
            const paged = sorted.slice((noSwmsPage - 1) * PAGE_SIZE, noSwmsPage * PAGE_SIZE);
            type NCol = keyof NoSwmsJob;
            const Th = ({ col, label }: { col: NCol; label: string }) => (
              <th onClick={() => handleNoSwmsSort(col)}
                className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap">
                <span className="inline-flex items-center gap-1">{label}<SortIcon active={noSwmsSort === col} dir={noSwmsDir} /></span>
              </th>
            );
            return data.noSwmsList.length === 0 ? (
              <div className="py-10 text-center"><ShieldCheck size={32} className="mx-auto text-emerald-500 mb-3" /><p className="text-gray-400 text-sm">All open jobs have a SWMS on file — great work!</p></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-800">
                      <Th col="jobNumber" label="Job #" />
                      <Th col="location" label="Location" />
                      <Th col="jobType" label="Type" />
                      <Th col="region" label="Region" />
                      <Th col="daysSinceCreated" label="Days Open" />
                      <th className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium">Prime</th>
                    </tr></thead>
                    <tbody>
                      {paged.map((job, i) => {
                        const urgency = job.daysSinceCreated >= 14 ? 'text-red-400' : job.daysSinceCreated >= 7 ? 'text-amber-400' : 'text-gray-300';
                        return (
                          <tr key={job.id} className={`border-b border-gray-900 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'} hover:bg-white/5 transition-colors`}>
                            <td className="py-2.5 px-4 text-xs">
                              {job.primeUrl ? (
                                <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 font-semibold font-mono underline underline-offset-2">
                                  {job.jobNumber}
                                </a>
                              ) : <span className="font-mono font-semibold text-white">{job.jobNumber || '—'}</span>}
                            </td>
                            <td className="py-2.5 px-4 text-xs text-gray-400">{job.location || '—'}</td>
                            <td className="py-2.5 px-4 text-xs text-gray-400">{job.jobType || '—'}</td>
                            <td className="py-2.5 px-4 text-xs text-gray-400">{job.region || '—'}</td>
                            <td className={`py-2.5 px-4 text-xs font-bold ${urgency}`}>{job.daysSinceCreated}d</td>
                            <td className="py-2.5 px-4">
                              {job.primeUrl ? (
                                <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-red-400 transition-colors"><ExternalLink size={13} /></a>
                              ) : <span className="text-gray-700">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination page={noSwmsPage} total={sorted.length} pageSize={PAGE_SIZE} onChange={setNoSwmsPage} />
              </>
            );
          })()}
        </div>

        {/* ── Info footer ── */}
        <div className="text-xs text-gray-700 space-y-0.5">
          <p>
            <strong className="text-gray-600">Completion Rate:</strong>{' '}
            Green ≥75% · Amber ≥50% · Red &lt;50%
          </p>
          <p>
            <strong className="text-gray-600">SWMS Coverage:</strong>{' '}
            % of open jobs with at least one SWMS/TMP form on file
          </p>
          <p>
            <strong className="text-gray-600">Awaiting Approval:</strong>{' '}
            Green ≤3 · Amber ≤8 · Red &gt;8
          </p>
          <p>
            <strong className="text-gray-600">Not Started:</strong>{' '}
            SWMS forms created but not actioned (Green ≤2 · Amber ≤5)
          </p>
          <p>
            <strong className="text-gray-600">Avg Approval Time:</strong>{' '}
            Days from SWMS creation to approval (Green ≤3d · Amber ≤7d)
          </p>
          <p>
            <strong className="text-gray-600">Jobs Without SWMS:</strong>{' '}
            Open jobs with no SWMS on file — sorted oldest first (Green ≤5 · Amber ≤15)
          </p>
        </div>
      </div>
    </div>
  );
}
