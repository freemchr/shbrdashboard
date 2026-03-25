'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage, SkeletonTable } from '@/components/ui/LoadingSpinner';
import { KpiCard } from '@/components/ui/KpiCard';
import { Tooltip } from '@/components/ui/Tooltip';
import { Users, Briefcase, DollarSign, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { formatCurrency } from '@/lib/prime-helpers';
import { downloadCSV } from '@/lib/export-csv';
import { Download } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  status: string;
  roles: string[];
  openJobs: number;
  totalAuthorisedValue: number;
  updatedThisWeek: number;
  updatedThisMonth: number;
  regions: string[];
  noReportCount: number;
  slaBreachCount: number;
  criticalSlaCount: number;
  avgDaysOpen: number;
  oldestJobDays: number;
}

type SortKey =
  | 'name'
  | 'roles'
  | 'openJobs'
  | 'totalAuthorisedValue'
  | 'updatedThisWeek'
  | 'updatedThisMonth'
  | 'status'
  | 'noReportCount'
  | 'slaBreachCount'
  | 'avgDaysOpen'
  | 'oldestJobDays';

/** Compute a 0–2 health score: 0 = green, 1 = amber, 2 = red */
function healthScore(m: TeamMember): number {
  // Red conditions
  if (
    m.noReportCount > 2 ||
    m.slaBreachCount > 3 ||
    m.avgDaysOpen > 30 ||
    m.criticalSlaCount > 0
  ) return 2;
  // Amber conditions
  if (
    m.noReportCount > 0 ||
    (m.slaBreachCount >= 1 && m.slaBreachCount <= 2) ||
    (m.avgDaysOpen >= 14 && m.avgDaysOpen <= 30)
  ) return 1;
  // Green
  return 0;
}

function buildHealthTooltip(m: TeamMember): string {
  const score = healthScore(m);
  if (m.openJobs === 0) return 'No open jobs';
  if (score === 2) {
    const parts: string[] = [];
    if (m.noReportCount > 2) parts.push(`No report: ${m.noReportCount} jobs`);
    if (m.slaBreachCount > 3) parts.push(`SLA breaches: ${m.slaBreachCount}`);
    if (m.avgDaysOpen > 30) parts.push(`Avg age: ${m.avgDaysOpen} days`);
    if (m.criticalSlaCount > 0) parts.push(`Critical SLA: ${m.criticalSlaCount}`);
    return parts.length > 0 ? parts.join(' | ') : 'Performance issues';
  }
  if (score === 1) {
    const parts: string[] = [];
    if (m.noReportCount > 0) parts.push(`No report: ${m.noReportCount} jobs`);
    if (m.slaBreachCount >= 1 && m.slaBreachCount <= 2) parts.push(`SLA breaches: ${m.slaBreachCount}`);
    if (m.avgDaysOpen >= 14 && m.avgDaysOpen <= 30) parts.push(`Avg age: ${m.avgDaysOpen} days`);
    return parts.length > 0 ? parts.join(' | ') : 'Some concerns';
  }
  return 'All metrics within healthy range';
}

function TrafficLight({ m }: { m: TeamMember }) {
  const score = healthScore(m);
  const tooltip = buildHealthTooltip(m);

  if (m.openJobs === 0) {
    return (
      <Tooltip content={tooltip}>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-700 cursor-default" />
      </Tooltip>
    );
  }
  if (score === 2) {
    return (
      <Tooltip content={tooltip}>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 cursor-default" />
      </Tooltip>
    );
  }
  if (score === 1) {
    return (
      <Tooltip content={tooltip}>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 cursor-default" />
      </Tooltip>
    );
  }
  return (
    <Tooltip content={tooltip}>
      <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 cursor-default" />
    </Tooltip>
  );
}

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('openJobs');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/prime/team')
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error || 'Failed to load')))
      .then(d => setTeam(Array.isArray(d) ? d : []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonTable rows={8} />;
  if (error) return <ErrorMessage message={error} />;

  const displayed = (showInactive ? team : team.filter(m => m.status === 'active' || m.openJobs > 0))
    .sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === 'roles') { av = a.roles.join(', '); bv = b.roles.join(', '); }
      else if (sortKey === 'status') { av = a.status; bv = b.status; }
      else { av = (a as unknown as Record<string, number>)[sortKey] ?? 0; bv = (b as unknown as Record<string, number>)[sortKey] ?? 0; }
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const activeWithJobs = team.filter(m => m.openJobs > 0);
  const totalOpen = team.reduce((s, m) => s + m.openJobs, 0);
  const totalValue = team.reduce((s, m) => s + m.totalAuthorisedValue, 0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortTh = ({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-4 py-2.5 text-left text-xs text-gray-500 font-medium cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === col
          ? sortDir === 'asc' ? <ChevronUp size={11} className="text-red-400" /> : <ChevronDown size={11} className="text-red-400" />
          : <ChevronsUpDown size={11} className="text-gray-700" />}
      </span>
    </th>
  );

  const handleExport = () => {
    downloadCSV(
      `team-workload-${new Date().toISOString().split('T')[0]}.csv`,
      ['Health', 'Name', 'Email', 'Role', 'Status', 'Open Jobs', 'No Report', 'SLA Breaches', 'Avg Age (days)', 'Oldest (days)', 'Auth. Value', 'This Week', 'This Month', 'Regions'],
      displayed.map(m => {
        const score = m.openJobs === 0 ? 'N/A' : healthScore(m) === 2 ? 'Red' : healthScore(m) === 1 ? 'Amber' : 'Green';
        return [score, m.name, m.email, m.roles.join(', '), m.status, m.openJobs, m.noReportCount, m.slaBreachCount, m.avgDaysOpen, m.oldestJobDays, m.totalAuthorisedValue, m.updatedThisWeek, m.updatedThisMonth, m.regions.join(', ')];
      })
    );
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Team"
        subtitle="Workload, SLA compliance and report status by team member"
        actions={
          <button onClick={handleExport}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors">
            <Download size={14} /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard title="Staff with Open Jobs" value={activeWithJobs.length} icon={<Users size={18} />} />
        <KpiCard title="Total Open Jobs" value={totalOpen} icon={<Briefcase size={18} />} />
        <KpiCard title="Total Auth. Value" value={formatCurrency(totalValue)} icon={<DollarSign size={18} />} />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-white">
            Team Workload <span className="text-gray-500 font-normal">({displayed.length} members)</span>
          </h2>
          <button
            onClick={() => setShowInactive(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
              showInactive ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {showInactive ? 'Hide inactive' : 'Show inactive'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-3 py-2.5 pl-5 text-left text-xs text-gray-500 font-medium whitespace-nowrap w-8" title="Performance health">●</th>
                <SortTh col="name" label="Name" />
                <SortTh col="roles" label="Role" />
                <SortTh col="openJobs" label="Open" />
                <SortTh col="noReportCount" label="No Report" />
                <SortTh col="slaBreachCount" label="SLA Breaches" />
                <SortTh col="avgDaysOpen" label="Avg Age" />
                <SortTh col="oldestJobDays" label="Oldest" />
                <SortTh col="totalAuthorisedValue" label="Auth. Value" />
                <SortTh col="updatedThisWeek" label="Week" />
                <SortTh col="updatedThisMonth" label="Month" />
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium whitespace-nowrap hidden lg:table-cell">Regions</th>
                <SortTh col="status" label="Status" />
              </tr>
            </thead>
            <tbody>
              {displayed.map(m => (
                <tr key={m.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-3 py-2.5 pl-5 whitespace-nowrap">
                    <TrafficLight m={m} />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="font-medium text-white text-sm">{m.name}</div>
                    {m.email && <div className="text-xs text-gray-500 mt-0.5 hidden sm:block">{m.email}</div>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="text-xs text-gray-400">{m.roles.join(', ') || '—'}</span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`font-bold font-mono text-sm ${
                      m.openJobs > 30 ? 'text-red-400' :
                      m.openJobs > 15 ? 'text-yellow-400' :
                      m.openJobs > 0  ? 'text-green-400' : 'text-gray-600'
                    }`}>
                      {m.openJobs > 0 ? m.openJobs : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`font-mono text-xs ${
                      m.noReportCount > 0 ? 'text-red-400' : 'text-gray-600'
                    }`}>
                      {m.openJobs > 0 ? (m.noReportCount > 0 ? m.noReportCount : '—') : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`font-mono text-xs ${
                      m.slaBreachCount > 2 ? 'text-red-400' :
                      m.slaBreachCount > 0 ? 'text-amber-400' : 'text-gray-600'
                    }`}>
                      {m.openJobs > 0 ? (m.slaBreachCount > 0 ? m.slaBreachCount : '—') : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`font-mono text-xs ${
                      m.avgDaysOpen > 30 ? 'text-red-400' :
                      m.avgDaysOpen >= 14 ? 'text-amber-400' :
                      m.avgDaysOpen > 0  ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {m.openJobs > 0 ? (m.avgDaysOpen > 0 ? `${m.avgDaysOpen}d` : '—') : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`font-mono text-xs ${
                      m.oldestJobDays > 60 ? 'text-red-400' :
                      m.oldestJobDays > 0  ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {m.openJobs > 0 ? (m.oldestJobDays > 0 ? `${m.oldestJobDays}d` : '—') : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-300 font-mono whitespace-nowrap">
                    {m.totalAuthorisedValue > 0 ? formatCurrency(m.totalAuthorisedValue) : '—'}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`font-mono text-xs ${m.updatedThisWeek > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                      {m.updatedThisWeek > 0 ? m.updatedThisWeek : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="font-mono text-xs text-gray-400">
                      {m.updatedThisMonth > 0 ? m.updatedThisMonth : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell whitespace-nowrap">
                    <span className="text-xs text-gray-400">{m.regions.join(', ') || '—'}</span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      m.status === 'active' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr><td colSpan={13} className="px-4 py-10 text-center text-gray-500 text-sm">No team members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Traffic light legend */}
        <div className="px-5 py-3 border-t border-gray-800 flex flex-wrap gap-x-6 gap-y-2">
          <span className="text-xs text-gray-500 font-medium mr-1">Performance:</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
            Green — no issues, avg age &lt;14d
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
            Amber — 1–2 concerns or avg age 14–30d
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
            Red — no-report &gt;2, SLA breaches &gt;3, avg age &gt;30d, or critical SLA
          </span>
        </div>
      </div>
    </div>
  );
}
