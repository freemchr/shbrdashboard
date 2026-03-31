'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage, SkeletonTable } from '@/components/ui/LoadingSpinner';
import { KpiCard } from '@/components/ui/KpiCard';
import { Users, Briefcase, DollarSign, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, X, Loader2, Mail, Download } from 'lucide-react';
import { formatCurrency } from '@/lib/prime-helpers';
import { downloadCSV } from '@/lib/export-csv';
import { JobTypeBadge, StatusBadge } from '@/components/ui/StatusBadge';
import type { TeamMemberJob } from '@/app/api/prime/team/jobs/route';

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

function healthScore(m: TeamMember): 0 | 1 | 2 {
  if (m.noReportCount > 2 || m.slaBreachCount > 3 || m.avgDaysOpen > 30 || m.criticalSlaCount > 0) return 2;
  if (m.noReportCount > 0 || (m.slaBreachCount >= 1 && m.slaBreachCount <= 2) || (m.avgDaysOpen >= 14 && m.avgDaysOpen <= 30)) return 1;
  return 0;
}

function HealthPill({ m }: { m: TeamMember }) {
  if (m.openJobs === 0) return <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-500">No jobs</span>;
  const score = healthScore(m);
  if (score === 2) return <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-red-950/60 border border-red-700/60 text-red-300 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />Action needed</span>;
  if (score === 1) return <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-950/50 border border-amber-700/50 text-amber-300 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />Attention</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-700/50 text-emerald-300 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />On track</span>;
}

type DrillFilter = 'all' | 'no_report' | 'sla';

const DRILL_LABELS: Record<DrillFilter, string> = {
  all: 'All Open Jobs',
  no_report: 'No Report Started',
  sla: 'SLA Breaches',
};

function MetricBadge({ value, label, colour, onClick, active }: {
  value: string | number;
  label: string;
  colour: string;
  onClick?: () => void;
  active?: boolean;
}) {
  if (onClick) {
    return (
      <button
        onClick={e => { e.stopPropagation(); onClick(); }}
        className={`flex flex-col items-center gap-0.5 min-w-0 px-2 py-1 rounded-lg transition-colors ${active ? 'bg-gray-700 ring-1 ring-gray-500' : 'hover:bg-gray-800'}`}
        title={`Click to view ${label}`}
      >
        <span className={`text-base font-bold font-mono leading-none ${colour}`}>{value}</span>
        <span className={`text-[10px] whitespace-nowrap ${active ? 'text-gray-300' : 'text-gray-500'}`}>{label}</span>
      </button>
    );
  }
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className={`text-base font-bold font-mono leading-none ${colour}`}>{value}</span>
      <span className="text-[10px] text-gray-500 whitespace-nowrap">{label}</span>
    </div>
  );
}

function buildDrillEmailBody(memberName: string, filter: DrillFilter, jobs: TeamMemberJob[]): string {
  const date = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  const label = DRILL_LABELS[filter];
  let body = `${label} — ${memberName} (${date})\n${'─'.repeat(60)}\n\n`;
  body += `Total: ${jobs.length} job${jobs.length !== 1 ? 's' : ''}\n\n`;
  jobs.forEach((job, i) => {
    body += `${i + 1}. ${job.jobNumber}`;
    if (job.address) body += ` — ${job.address}`;
    body += `\n   Status: ${job.status}`;
    if (job.jobType && job.jobType !== '—') body += ` | Type: ${job.jobType}`;
    if (job.region) body += ` | Region: ${job.region}`;
    body += ` | Age: ${job.daysOpen}d`;
    if (filter === 'sla' && job.daysOverdue > 0) body += ` | Overdue: +${job.daysOverdue}d`;
    if (job.authorisedTotal > 0) body += ` | Value: $${job.authorisedTotal.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (job.primeUrl) body += `\n   Prime: ${job.primeUrl}`;
    body += '\n\n';
  });
  return body;
}

function DrillPanel({ memberId, memberName, filter, onClose }: {
  memberId: string;
  memberName: string;
  filter: DrillFilter;
  onClose: () => void;
}) {
  const [jobs, setJobs] = useState<TeamMemberJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/prime/team/jobs?memberId=${encodeURIComponent(memberId)}&filter=${filter}`)
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? 'Failed')))
      .then(setJobs)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [memberId, filter]);

  return (
    <div className="border-t border-gray-700/60 bg-gray-950/60">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">{DRILL_LABELS[filter]}</span>
          <span className="text-xs text-gray-500">— {memberName}</span>
          {!loading && <span className="text-[11px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>}
        </div>
        <div className="flex items-center gap-1">
          {!loading && !error && jobs.length > 0 && (
            <>
              <button
                onClick={e => {
                  e.stopPropagation();
                  const date = new Date().toISOString().split('T')[0];
                  const filename = `${memberName.replace(/\s+/g, '-').toLowerCase()}-${filter}-${date}.csv`;
                  const headers = ['Job #', 'Address', 'Status', 'Type', 'Region', 'Age (days)', filter === 'sla' ? 'Overdue (days)' : 'Value ($)'];
                  const rows = jobs.map(j => [
                    j.jobNumber,
                    j.address,
                    j.status,
                    j.jobType || '—',
                    j.region || '—',
                    j.daysOpen,
                    filter === 'sla' ? (j.daysOverdue > 0 ? j.daysOverdue : '') : (j.authorisedTotal > 0 ? j.authorisedTotal : ''),
                  ]);
                  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
                  URL.revokeObjectURL(url);
                }}
                title="Download as CSV"
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Download size={12} /> CSV
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  const subject = encodeURIComponent(`SHBR — ${DRILL_LABELS[filter]}: ${memberName} (${new Date().toLocaleDateString('en-AU')})`);
                  const body = encodeURIComponent(buildDrillEmailBody(memberName, filter, jobs));
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                }}
                title="Email this job list"
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Mail size={12} /> Email
              </button>
            </>
          )}
          <button onClick={e => { e.stopPropagation(); onClose(); }}
            className="text-gray-500 hover:text-white transition-colors p-1">
            <X size={14} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-5 py-4 text-gray-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> Loading jobs…
        </div>
      )}

      {error && (
        <div className="px-5 py-4 text-red-400 text-xs">Failed to load: {error}</div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="px-5 py-6 text-center text-gray-500 text-sm">No jobs found for this filter.</div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800/60 text-gray-500">
                <th className="py-2 px-4 text-left font-medium">Job #</th>
                <th className="py-2 px-3 text-left font-medium">Address</th>
                <th className="py-2 px-3 text-left font-medium hidden sm:table-cell">Status</th>
                <th className="py-2 px-3 text-left font-medium hidden md:table-cell">Type</th>
                <th className="py-2 px-3 text-left font-medium hidden lg:table-cell">Region</th>
                <th className="py-2 px-3 text-right font-medium hidden sm:table-cell">Value</th>
                <th className="py-2 px-3 text-right font-medium">Age</th>
                {filter === 'sla' && <th className="py-2 px-3 text-right font-medium">Overdue</th>}
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, idx) => (
                <tr key={job.id}
                  className={`border-b border-gray-800/40 hover:bg-gray-800/40 transition-colors ${idx % 2 !== 0 ? 'bg-gray-900/40' : ''}`}>
                  <td className="py-2 px-4 font-mono whitespace-nowrap">
                    {job.primeUrl
                      ? <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
                          className="text-red-400 hover:text-red-300 underline underline-offset-2 font-semibold">{job.jobNumber}</a>
                      : <span className="text-red-400 font-semibold">{job.jobNumber}</span>}
                  </td>
                  <td className="py-2 px-3 text-gray-300 max-w-[160px] truncate">{job.address}</td>
                  <td className="py-2 px-3 hidden sm:table-cell"><StatusBadge label={job.status} /></td>
                  <td className="py-2 px-3 hidden md:table-cell">
                    {job.jobType && job.jobType !== '—' ? <JobTypeBadge label={job.jobType} /> : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="py-2 px-3 text-gray-500 hidden lg:table-cell whitespace-nowrap">{job.region}</td>
                  <td className="py-2 px-3 text-right font-mono text-gray-400 hidden sm:table-cell whitespace-nowrap">
                    {job.authorisedTotal > 0 ? formatCurrency(job.authorisedTotal) : '—'}
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <span className={`font-mono font-bold ${job.daysOpen > 90 ? 'text-red-400' : job.daysOpen > 30 ? 'text-amber-400' : 'text-gray-400'}`}>
                      {job.daysOpen}d
                    </span>
                  </td>
                  {filter === 'sla' && (
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      {job.daysOverdue > 0
                        ? <span className="font-mono font-bold text-red-400">+{job.daysOverdue}d</span>
                        : <span className="text-gray-600 text-[11px]">due soon</span>}
                    </td>
                  )}
                  <td className="py-2 px-3">
                    {job.primeUrl && (
                      <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
                        className="text-gray-600 hover:text-red-400 transition-colors">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.length >= 50 && (
            <p className="text-[11px] text-gray-600 text-center py-2">
              Showing first 50 jobs — export CSV for full list
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MemberCard({ m, defaultOpen = false }: { m: TeamMember; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [drill, setDrill] = useState<DrillFilter | null>(null);

  const toggleDrill = (f: DrillFilter) => setDrill(d => d === f ? null : f);
  const score = healthScore(m);

  const borderCls =
    m.openJobs === 0 ? 'border-gray-800' :
    score === 2 ? 'border-red-800/60' :
    score === 1 ? 'border-amber-800/50' :
    'border-emerald-900/40';

  const accentBar =
    m.openJobs === 0 ? 'bg-gray-700' :
    score === 2 ? 'bg-red-500' :
    score === 1 ? 'bg-amber-400' :
    'bg-emerald-500';

  return (
    <div className={`bg-gray-900 rounded-xl border ${borderCls} overflow-hidden transition-all`}>
      {/* Coloured top accent bar */}
      <div className={`h-0.5 w-full ${accentBar}`} />

      {/* Card header — always visible */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {/* Avatar initials */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold
          ${score === 2 ? 'bg-red-950/60 text-red-300' : score === 1 ? 'bg-amber-950/50 text-amber-300' : m.openJobs === 0 ? 'bg-gray-800 text-gray-500' : 'bg-emerald-950/50 text-emerald-300'}`}>
          {m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{m.name}</span>
            <HealthPill m={m} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {m.roles.length > 0 && <span className="text-xs text-gray-500">{m.roles.join(', ')}</span>}
            {m.regions.length > 0 && <span className="text-xs text-gray-600">· {m.regions.length} region{m.regions.length !== 1 ? 's' : ''}</span>}
          </div>
        </div>

        {/* Quick stats — always visible; open/no-report/sla are clickable drill-downs */}
        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
          <MetricBadge
            value={m.openJobs || '—'}
            label="open"
            colour={m.openJobs > 30 ? 'text-red-400' : m.openJobs > 15 ? 'text-yellow-400' : m.openJobs > 0 ? 'text-white' : 'text-gray-600'}
            onClick={m.openJobs > 0 ? () => toggleDrill('all') : undefined}
            active={drill === 'all'}
          />
          <MetricBadge
            value={m.noReportCount > 0 ? m.noReportCount : '✓'}
            label="no report"
            colour={m.noReportCount > 0 ? 'text-red-400' : 'text-emerald-500'}
            onClick={m.noReportCount > 0 ? () => toggleDrill('no_report') : undefined}
            active={drill === 'no_report'}
          />
          <MetricBadge
            value={m.slaBreachCount > 0 ? m.slaBreachCount : '✓'}
            label="SLA breach"
            colour={m.slaBreachCount > 2 ? 'text-red-400' : m.slaBreachCount > 0 ? 'text-amber-400' : 'text-emerald-500'}
            onClick={m.slaBreachCount > 0 ? () => toggleDrill('sla') : undefined}
            active={drill === 'sla'}
          />
          <MetricBadge
            value={m.avgDaysOpen > 0 ? `${m.avgDaysOpen}d` : '—'}
            label="avg age"
            colour={m.avgDaysOpen > 30 ? 'text-red-400' : m.avgDaysOpen >= 14 ? 'text-amber-400' : 'text-gray-400'}
          />
          <MetricBadge
            value={m.totalAuthorisedValue > 0 ? formatCurrency(m.totalAuthorisedValue) : '—'}
            label="auth. value"
            colour="text-gray-300"
          />
        </div>

        {/* Expand chevron */}
        <div className="text-gray-500 flex-shrink-0 ml-2">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Drill-down panel — shown when a metric badge is clicked */}
      {drill && (
        <DrillPanel
          memberId={m.id}
          memberName={m.name}
          filter={drill}
          onClose={() => setDrill(null)}
        />
      )}

      {/* Expanded detail row */}
      {open && (
        <div className="border-t border-gray-800 px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <button onClick={e => { e.stopPropagation(); if (m.openJobs > 0) toggleDrill('all'); }}
            className={`text-left rounded-lg p-2 -m-2 transition-colors ${m.openJobs > 0 ? 'hover:bg-gray-800 cursor-pointer' : ''} ${drill === 'all' ? 'bg-gray-800 ring-1 ring-gray-600' : ''}`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Open Jobs {m.openJobs > 0 && <span className="normal-case text-gray-600">↗</span>}</p>
            <p className={`text-xl font-bold font-mono ${m.openJobs > 30 ? 'text-red-400' : m.openJobs > 15 ? 'text-yellow-400' : 'text-white'}`}>{m.openJobs}</p>
          </button>
          <button onClick={e => { e.stopPropagation(); if (m.noReportCount > 0) toggleDrill('no_report'); }}
            className={`text-left rounded-lg p-2 -m-2 transition-colors ${m.noReportCount > 0 ? 'hover:bg-gray-800 cursor-pointer' : ''} ${drill === 'no_report' ? 'bg-gray-800 ring-1 ring-gray-600' : ''}`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">No Report {m.noReportCount > 0 && <span className="normal-case text-gray-600">↗</span>}</p>
            <p className={`text-xl font-bold font-mono ${m.noReportCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{m.noReportCount > 0 ? m.noReportCount : '✓'}</p>
          </button>
          <button onClick={e => { e.stopPropagation(); if (m.slaBreachCount > 0) toggleDrill('sla'); }}
            className={`text-left rounded-lg p-2 -m-2 transition-colors ${m.slaBreachCount > 0 ? 'hover:bg-gray-800 cursor-pointer' : ''} ${drill === 'sla' ? 'bg-gray-800 ring-1 ring-gray-600' : ''}`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">SLA Breaches {m.slaBreachCount > 0 && <span className="normal-case text-gray-600">↗</span>}</p>
            <p className={`text-xl font-bold font-mono ${m.slaBreachCount > 2 ? 'text-red-400' : m.slaBreachCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{m.slaBreachCount > 0 ? m.slaBreachCount : '✓'}</p>
            {m.criticalSlaCount > 0 && <p className="text-[10px] text-red-400 mt-0.5">{m.criticalSlaCount} critical</p>}
          </button>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Avg Age</p>
            <p className={`text-xl font-bold font-mono ${m.avgDaysOpen > 30 ? 'text-red-400' : m.avgDaysOpen >= 14 ? 'text-amber-400' : 'text-gray-300'}`}>{m.avgDaysOpen > 0 ? `${m.avgDaysOpen}d` : '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Oldest Job</p>
            <p className={`text-xl font-bold font-mono ${m.oldestJobDays > 60 ? 'text-red-400' : 'text-gray-300'}`}>{m.oldestJobDays > 0 ? `${m.oldestJobDays}d` : '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Auth. Value</p>
            <p className="text-sm font-bold font-mono text-gray-300">{m.totalAuthorisedValue > 0 ? formatCurrency(m.totalAuthorisedValue) : '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Updated This Week</p>
            <p className={`text-xl font-bold font-mono ${m.updatedThisWeek > 0 ? 'text-emerald-400' : 'text-gray-600'}`}>{m.updatedThisWeek || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Updated This Month</p>
            <p className="text-xl font-bold font-mono text-gray-300">{m.updatedThisMonth || '—'}</p>
          </div>
          {m.email && (
            <div className="col-span-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Email</p>
              <p className="text-xs text-gray-400">{m.email}</p>
            </div>
          )}
          {m.regions.length > 0 && (
            <div className="col-span-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Regions</p>
              <p className="text-xs text-gray-400">{m.regions.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [sortBy, setSortBy] = useState<'health' | 'name' | 'openJobs' | 'value'>('health');

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
      if (sortBy === 'health') return healthScore(b) - healthScore(a);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'openJobs') return b.openJobs - a.openJobs;
      if (sortBy === 'value') return b.totalAuthorisedValue - a.totalAuthorisedValue;
      return 0;
    });

  const activeWithJobs = team.filter(m => m.openJobs > 0);
  const totalOpen = team.reduce((s, m) => s + m.openJobs, 0);
  const totalValue = team.reduce((s, m) => s + m.totalAuthorisedValue, 0);
  const redCount = team.filter(m => m.openJobs > 0 && healthScore(m) === 2).length;

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

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Staff with Jobs" value={activeWithJobs.length} icon={<Users size={18} />} />
        <KpiCard title="Total Open Jobs" value={totalOpen} icon={<Briefcase size={18} />} />
        <KpiCard title="Auth. Value" value={formatCurrency(totalValue)} icon={<DollarSign size={18} />} />
        <KpiCard title="Need Attention" value={redCount} icon={<AlertTriangle size={18} />} accent={redCount > 0}
          subtitle={redCount > 0 ? 'Performance issues' : 'All clear'} />
      </div>

      {/* Sort + filter controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
          {(['health', 'name', 'openJobs', 'value'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${sortBy === s ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {s === 'health' ? '🔴 Health' : s === 'name' ? 'A–Z' : s === 'openJobs' ? 'Open Jobs' : 'Value'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowInactive(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showInactive ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
          {showInactive ? 'Hide inactive' : 'Show inactive'}
        </button>
        <span className="text-xs text-gray-500 ml-auto">{displayed.length} member{displayed.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Person cards */}
      <div className="space-y-3">
        {displayed.map(m => (
          <MemberCard key={m.id} m={m} defaultOpen={healthScore(m) === 2} />
        ))}
        {displayed.length === 0 && (
          <div className="py-16 text-center text-gray-500 bg-gray-900 rounded-xl border border-gray-800">No team members found.</div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 px-1">
        <span className="text-xs text-gray-600 font-medium">Health score:</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-emerald-500" />On track — avg age &lt;14d, no SLA issues</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-amber-400" />Attention — 1–2 SLA, avg age 14–30d</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-red-500" />Action — no-report &gt;2, SLA &gt;3, avg age &gt;30d</span>
      </div>
    </div>
  );
}
