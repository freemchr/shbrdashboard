'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import { DataRefreshButton } from '@/components/ui/DataRefreshButton';
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
    <div className={`rounded-xl border p-5 flex flex-col gap-2 ${tl.bg} ${tl.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className={tl.color} />
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <DotIndicator color={tl.dot} />
          <span className={`text-xs font-semibold ${tl.color}`}>{tl.label}</span>
        </div>
      </div>
      <div className={`font-bold ${tl.color} ${small ? 'text-2xl' : 'text-3xl'}`}>{value}</div>
      {subtext && <div className="text-xs text-gray-500">{subtext}</div>}
    </div>
  );
}

export default function WHSPage() {
  const [data, setData] = useState<WHSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'awaiting' | 'noswms'>('awaiting');

  const fetchData = (attempt = 1) => {
    setLoading(true);
    setError(null);
    fetch('/api/prime/whs')
      .then((r) => {
        if (r.status === 504 || r.status === 502) throw new Error('timeout');
        return r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e?.error || 'Failed to load WHS data'));
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => {
        // Auto-retry once on timeout — first cold load can be slow
        if (String(e).includes('timeout') && attempt === 1) {
          setTimeout(() => fetchData(2), 3000);
        } else {
          setError(String(e));
          setLoading(false);
        }
      });
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <LoadingSpinner message="Loading WHS data… (first load may take up to 30s while fetching from Prime)" />;
  if (error) return <ErrorMessage message={error} />;
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">
              Updated {new Date(data.asOf).toLocaleString('en-AU', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            <DataRefreshButton />
          </div>
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
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e5e7eb' }}
                  itemStyle={{ color: '#9ca3af' }}
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
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e5e7eb' }}
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
            <button
              onClick={() => setTab('awaiting')}
              className={`px-5 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                tab === 'awaiting'
                  ? 'text-white border-b-2 border-red-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Clock size={14} />
              Awaiting Approval
              {data.awaitingApproval > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  awaitingTL.color === 'text-red-400' ? 'bg-red-500/20 text-red-400' :
                  awaitingTL.color === 'text-amber-400' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {data.awaitingApproval}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('noswms')}
              className={`px-5 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                tab === 'noswms'
                  ? 'text-white border-b-2 border-red-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <AlertTriangle size={14} />
              Open Jobs Without SWMS
              {data.openJobsNoSwms > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  noSwmsTL.color === 'text-red-400' ? 'bg-red-500/20 text-red-400' :
                  noSwmsTL.color === 'text-amber-400' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {data.openJobsNoSwms}
                </span>
              )}
            </button>
          </div>

          {/* Awaiting Approval table */}
          {tab === 'awaiting' && (
            <div className="overflow-x-auto">
              {data.awaitingList.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-3" />
                  <p className="text-gray-400 text-sm">No forms awaiting approval — all clear!</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium">SWMS #</th>
                      <th className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium">Job ID</th>
                      <th className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium">Assigned To</th>
                      <th className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium">Created</th>
                      <th className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium">Days Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.awaitingList.map((item, i) => {
                      const urgency =
                        item.daysPending >= 7
                          ? 'text-red-400'
                          : item.daysPending >= 3
                          ? 'text-amber-400'
                          : 'text-emerald-400';
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-gray-900 ${
                            i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'
                          } hover:bg-white/5 transition-colors`}
                        >
                          <td className="py-2.5 px-4 font-mono text-xs text-gray-300">
                            {item.number || '—'}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-gray-400">{item.jobId || '—'}</td>
                          <td className="py-2.5 px-4 text-xs text-gray-300">
                            {item.assignedContact || '—'}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-gray-400">
                            {formatDate(item.createdAt)}
                          </td>
                          <td className={`py-2.5 px-4 text-xs font-bold ${urgency}`}>
                            {item.daysPending}d
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {data.awaitingApproval > data.awaitingList.length && (
                <p className="text-xs text-gray-600 px-4 py-2">
                  Showing {data.awaitingList.length} of {data.awaitingApproval} forms
                </p>
              )}
            </div>
          )}

          {/* No SWMS jobs table */}
          {tab === 'noswms' && (
            <div className="overflow-x-auto">
              {data.noSwmsList.length === 0 ? (
                <div className="py-10 text-center">
                  <ShieldCheck size={32} className="mx-auto text-emerald-500 mb-3" />
                  <p className="text-gray-400 text-sm">All open jobs have a SWMS on file — great work!</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium">Job #</th>
                      <th className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium">Location</th>
                      <th className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium">Type</th>
                      <th className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium">Region</th>
                      <th className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium">Days Open</th>
                      <th className="py-2.5 px-4 text-left text-xs text-gray-500 font-medium">Prime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.noSwmsList.map((job, i) => {
                      const urgency =
                        job.daysSinceCreated >= 14
                          ? 'text-red-400'
                          : job.daysSinceCreated >= 7
                          ? 'text-amber-400'
                          : 'text-gray-300';
                      return (
                        <tr
                          key={job.id}
                          className={`border-b border-gray-900 ${
                            i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'
                          } hover:bg-white/5 transition-colors`}
                        >
                          <td className="py-2.5 px-4 font-mono text-xs font-semibold text-white">
                            {job.jobNumber || '—'}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-gray-400">{job.location || '—'}</td>
                          <td className="py-2.5 px-4 text-xs text-gray-400">{job.jobType || '—'}</td>
                          <td className="py-2.5 px-4 text-xs text-gray-400">{job.region || '—'}</td>
                          <td className={`py-2.5 px-4 text-xs font-bold ${urgency}`}>
                            {job.daysSinceCreated}d
                          </td>
                          <td className="py-2.5 px-4">
                            {job.primeUrl ? (
                              <a
                                href={job.primeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-500 hover:text-red-400 transition-colors"
                              >
                                <ExternalLink size={13} />
                              </a>
                            ) : (
                              <span className="text-gray-700">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {data.openJobsNoSwms > data.noSwmsList.length && (
                <p className="text-xs text-gray-600 px-4 py-2">
                  Showing {data.noSwmsList.length} of {data.openJobsNoSwms} jobs (oldest first)
                </p>
              )}
            </div>
          )}
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
