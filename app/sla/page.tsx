'use client';

import { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/prime-helpers';
import { downloadCSV } from '@/lib/export-csv';
import {
  AlertTriangle,
  Clock,
  Download,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ShieldAlert,
  CalendarX,
} from 'lucide-react';
import { JobTypeBadge } from '@/components/ui/StatusBadge';

// ── Schedule Types ──────────────────────────────────────────────────────────
interface ScheduleJobEntry {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  assignee: string;
  region: string;
  daysSinceCreated: number;
  businessDaysSinceAllocated: number;
  allocatedDate: string;
  startDate: string | null;
  primeUrl: string;
  missing: boolean;
}

interface SchedulesResponse {
  total: number;
  missing: ScheduleJobEntry[];
  atRisk: ScheduleJobEntry[];
  generatedAt: string;
}

interface SlaBreachJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  jobType: string;
  region: string;
  assignee: string;
  authorisedTotal: number;
  createdAt: string;
  daysSinceCreated: number;
  daysSinceUpdated: number;
  slaRule: string;
  slaDays: number;
  daysOverdue: number;
  severity: 'critical' | 'warning' | 'at_risk';
  primeUrl: string;
}

interface SlaSummary {
  totalBreaches: number;
  critical: number;
  warning: number;
  atRisk: number;
}

interface SlaResponse {
  summary: SlaSummary;
  breaches: SlaBreachJob[];
  generatedAt: string;
}

type SortKey = keyof Pick<
  SlaBreachJob,
  'jobNumber' | 'address' | 'assignee' | 'status' | 'jobType' | 'region' | 'slaRule' | 'daysOverdue' | 'authorisedTotal' | 'daysSinceCreated'
>;

const SEVERITY_LABEL: Record<SlaBreachJob['severity'], string> = {
  critical: 'Critical',
  warning: 'Warning',
  at_risk: 'At Risk',
};

function SortTh({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
}: {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
}) {
  return (
    <th
      onClick={() => onSort(col)}
      className="py-2 px-3 text-left text-xs text-gray-500 font-medium whitespace-nowrap cursor-pointer select-none hover:text-white transition-colors"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === col ? (
          sortDir === 'asc' ? (
            <ChevronUp size={11} className="text-red-400" />
          ) : (
            <ChevronDown size={11} className="text-red-400" />
          )
        ) : (
          <ChevronsUpDown size={11} className="text-gray-700" />
        )}
      </span>
    </th>
  );
}

// ── Missing Schedules Section ────────────────────────────────────────────────
function MissingSchedulesSection() {
  const [data, setData] = useState<SchedulesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetch('/api/prime/jobs/schedules')
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? 'Failed')))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="mt-6 bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center gap-3 mb-4">
        <CalendarX size={18} className="text-orange-400" />
        <span className="text-sm font-semibold text-white">Missing Build Schedules — Suncorp KPI</span>
      </div>
      <div className="h-16 bg-gray-800 animate-pulse rounded-lg" />
    </div>
  );

  if (error) return (
    <div className="mt-6 bg-gray-900 rounded-xl border border-gray-800 p-4">
      <p className="text-xs text-red-400">Failed to load schedule data: {error}</p>
    </div>
  );

  const missingCount = data?.missing?.length ?? 0;
  const atRiskCount = data?.atRisk?.length ?? 0;

  return (
    <div className="mt-6 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-800 hover:bg-gray-800/40 transition-colors text-left"
      >
        <CalendarX size={18} className={missingCount > 0 ? 'text-orange-400' : 'text-gray-500'} />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">Missing Build Schedules — Suncorp KPI</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Jobs in repair/build phase with no schedule submitted &gt;2 business days after allocation
          </p>
        </div>
        <div className="flex items-center gap-3">
          {missingCount > 0 && (
            <span className="text-sm font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 px-3 py-1 rounded-full">
              {missingCount} missing
            </span>
          )}
          {atRiskCount > 0 && (
            <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full">
              {atRiskCount} at risk
            </span>
          )}
          {missingCount === 0 && atRiskCount === 0 && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">All clear ✓</span>
          )}
          {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </button>

      {expanded && (
        <div>
          {missingCount === 0 && atRiskCount === 0 ? (
            <div className="py-12 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-gray-300 font-medium text-sm">No missing schedules</p>
              <p className="text-gray-500 text-xs mt-1">All repair-phase jobs have schedules submitted</p>
            </div>
          ) : (
            <div>
              {missingCount > 0 && (
                <div>
                  <div className="px-5 py-2 bg-orange-950/20 border-b border-orange-900/30">
                    <span className="text-xs font-semibold text-orange-400 uppercase tracking-wide">⚠ Missing Schedules ({missingCount})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Job #</th>
                          <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Address</th>
                          <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Assignee</th>
                          <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Status</th>
                          <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Days Since Allocated</th>
                          <th className="py-2 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {data!.missing.map(job => (
                          <tr key={job.id} className="border-b border-orange-900/20 bg-orange-950/5 hover:brightness-110 transition-colors">
                            <td className="py-2 px-3 font-mono text-xs text-orange-400 whitespace-nowrap">
                              {job.primeUrl ? (
                                <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-orange-300">
                                  {job.jobNumber}
                                </a>
                              ) : job.jobNumber}
                            </td>
                            <td className="py-2 px-3 text-gray-300 text-xs max-w-[160px] truncate">{job.address}</td>
                            <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">{job.assignee}</td>
                            <td className="py-2 px-3 text-xs text-gray-400 max-w-[120px] truncate">{job.status}</td>
                            <td className="py-2 px-3 text-xs font-mono font-bold text-orange-400 whitespace-nowrap">
                              {job.businessDaysSinceAllocated}d (bus.)
                            </td>
                            <td className="py-2 px-3">
                              {job.primeUrl && (
                                <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-orange-400">
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

              {atRiskCount > 0 && (
                <div>
                  <div className="px-5 py-2 bg-yellow-950/10 border-b border-yellow-900/20 border-t border-gray-800">
                    <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">At Risk — Due Soon ({atRiskCount})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Job #</th>
                          <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Address</th>
                          <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Assignee</th>
                          <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Status</th>
                          <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Days Since Allocated</th>
                          <th className="py-2 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {data!.atRisk.map(job => (
                          <tr key={job.id} className="border-b border-yellow-900/10 bg-yellow-950/5 hover:brightness-110 transition-colors">
                            <td className="py-2 px-3 font-mono text-xs text-yellow-400 whitespace-nowrap">
                              {job.primeUrl ? (
                                <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-yellow-300">
                                  {job.jobNumber}
                                </a>
                              ) : job.jobNumber}
                            </td>
                            <td className="py-2 px-3 text-gray-300 text-xs max-w-[160px] truncate">{job.address}</td>
                            <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">{job.assignee}</td>
                            <td className="py-2 px-3 text-xs text-gray-400 max-w-[120px] truncate">{job.status}</td>
                            <td className="py-2 px-3 text-xs font-mono font-bold text-yellow-400 whitespace-nowrap">
                              {job.businessDaysSinceAllocated}d (bus.)
                            </td>
                            <td className="py-2 px-3">
                              {job.primeUrl && (
                                <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-yellow-400">
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

              {data?.generatedAt && (
                <div className="px-5 py-2 border-t border-gray-800">
                  <span className="text-xs text-gray-600">Updated {formatDate(data.generatedAt)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function severityRowClass(s: SlaBreachJob['severity']) {
  if (s === 'critical') return 'border-red-900/60 bg-red-950/10';
  if (s === 'warning')  return 'border-amber-900/40 bg-amber-950/10';
  return 'border-yellow-900/30 bg-yellow-950/5';
}

function severityBadge(s: SlaBreachJob['severity']) {
  if (s === 'critical')
    return <span className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-full">Critical</span>;
  if (s === 'warning')
    return <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">Warning</span>;
  return <span className="text-xs font-semibold text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full">At Risk</span>;
}

export default function SlaPage() {
  const [data, setData] = useState<SlaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [severityFilter, setSeverityFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('daysOverdue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/prime/jobs/sla')
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? 'Failed')))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.breaches.filter(j =>
      (!severityFilter || j.severity === severityFilter) &&
      (!regionFilter   || j.region   === regionFilter) &&
      (!assigneeFilter || j.assignee === assigneeFilter) &&
      (!typeFilter     || j.jobType  === typeFilter)
    );
  }, [data, severityFilter, regionFilter, assigneeFilter, typeFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const regions   = useMemo(() => Array.from(new Set((data?.breaches ?? []).map(j => j.region).filter(Boolean))).sort(), [data]);
  const assignees = useMemo(() => Array.from(new Set((data?.breaches ?? []).map(j => j.assignee).filter(v => v && v !== '—'))).sort(), [data]);
  const types     = useMemo(() => Array.from(new Set((data?.breaches ?? []).map(j => j.jobType).filter(Boolean))).sort(), [data]);

  const handleExport = () => {
    if (!data) return;
    downloadCSV(
      `sla-breaches-${new Date().toISOString().split('T')[0]}.csv`,
      ['Job #', 'Address', 'Assignee', 'Status', 'Type', 'Region', 'SLA Rule', 'SLA Days', 'Days Overdue', 'Severity', 'Auth Total', 'Created', 'Days Since Created', 'Prime URL'],
      sorted.map(j => [
        j.jobNumber, j.address, j.assignee, j.status, j.jobType, j.region,
        j.slaRule, j.slaDays, j.daysOverdue, SEVERITY_LABEL[j.severity],
        j.authorisedTotal, j.createdAt, j.daysSinceCreated, j.primeUrl,
      ])
    );
  };

  if (loading) return <LoadingSpinner message="Calculating SLA breaches…" />;
  if (error)   return <ErrorMessage message={error} />;
  if (!data)   return null;

  const { summary } = data;
  const hasFilters = severityFilter || regionFilter || assigneeFilter || typeFilter;

  return (
    <div>
      <PageHeader
        title="SLA Tracker"
        subtitle="Monitor SLA breaches and at-risk jobs across the open portfolio"
        actions={
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
        }
      />

      {/* Critical alert banner */}
      {summary.critical > 0 && (
        <div className="mb-6 flex items-start gap-3 bg-red-950/40 border border-red-700/50 rounded-xl px-5 py-4">
          <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold text-sm">
              {summary.critical} critical SLA breach{summary.critical !== 1 ? 'es' : ''} — immediate action required
            </p>
            <p className="text-red-400/70 text-xs mt-0.5">
              These jobs are more than 14 days overdue their SLA target. Please escalate and action urgently.
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setSeverityFilter(severityFilter === '' ? '' : '')}
          className={`rounded-xl border p-5 text-left transition-all ${
            !severityFilter
              ? 'border-gray-600 bg-gray-800/60 ring-1 ring-gray-600/40'
              : 'border-gray-800 bg-gray-900 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">Total Breaches</span>
            <ShieldAlert size={16} className="text-gray-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{summary.totalBreaches}</p>
          <p className="text-xs text-gray-500 mt-1">Across all SLA rules</p>
        </button>

        <button
          onClick={() => setSeverityFilter(severityFilter === 'critical' ? '' : 'critical')}
          className={`rounded-xl border p-5 text-left transition-all ${
            severityFilter === 'critical'
              ? 'border-red-500 bg-red-950/30 ring-1 ring-red-500/30'
              : 'border-red-800/50 bg-red-950/10 hover:border-red-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-red-300 font-medium">Critical</span>
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-red-400">{summary.critical}</p>
          <p className="text-xs text-red-400/60 mt-1">&gt;14 days overdue</p>
        </button>

        <button
          onClick={() => setSeverityFilter(severityFilter === 'warning' ? '' : 'warning')}
          className={`rounded-xl border p-5 text-left transition-all ${
            severityFilter === 'warning'
              ? 'border-amber-500 bg-amber-950/30 ring-1 ring-amber-500/30'
              : 'border-gray-800 bg-gray-900 hover:border-amber-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-amber-300 font-medium">Warning</span>
            <Clock size={16} className="text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-400">{summary.warning}</p>
          <p className="text-xs text-gray-500 mt-1">7–14 days overdue</p>
        </button>

        <button
          onClick={() => setSeverityFilter(severityFilter === 'at_risk' ? '' : 'at_risk')}
          className={`rounded-xl border p-5 text-left transition-all ${
            severityFilter === 'at_risk'
              ? 'border-yellow-500 bg-yellow-950/30 ring-1 ring-yellow-500/30'
              : 'border-gray-800 bg-gray-900 hover:border-yellow-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-yellow-300 font-medium">At Risk</span>
            <Clock size={16} className="text-yellow-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-yellow-400">{summary.atRisk}</p>
          <p className="text-xs text-gray-500 mt-1">Approaching SLA limit</p>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="at_risk">At Risk</option>
        </select>

        <select
          value={regionFilter}
          onChange={e => setRegionFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto"
        >
          <option value="">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto"
        >
          <option value="">All Assignees</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto"
        >
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setSeverityFilter(''); setRegionFilter(''); setAssigneeFilter(''); setTypeFilter(''); }}
            className="text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg transition-colors"
          >
            Clear filters
          </button>
        )}

        <span className="text-xs text-gray-500 ml-auto">
          {sorted.length} job{sorted.length !== 1 ? 's' : ''}
          {hasFilters ? ' (filtered)' : ''}
          {data.generatedAt && (
            <span className="ml-2 text-gray-600">
              · Updated {formatDate(data.generatedAt)}
            </span>
          )}
        </span>
      </div>

      {/* Breach table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">⚠️ SLA Breaches &amp; At-Risk Jobs</h2>
          <span className="text-xs text-gray-500">— sorted by overdue days</span>
        </div>

        {sorted.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-gray-300 font-medium">No SLA breaches found</p>
            <p className="text-gray-500 text-sm mt-1">
              {hasFilters ? 'Try clearing your filters' : 'All jobs are within SLA targets'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Severity</th>
                  <SortTh col="jobNumber"     label="Job #"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Address</th>
                  <SortTh col="assignee"      label="Assignee"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="status"        label="Status"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="jobType"       label="Type"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="region"        label="Region"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="slaRule"       label="SLA Rule"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="daysOverdue"   label="Days Overdue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="authorisedTotal" label="Value"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((job, idx) => (
                  <tr
                    key={job.id}
                    className={`border-b transition-colors hover:brightness-110 ${severityRowClass(job.severity)} ${idx % 2 !== 0 ? 'brightness-[0.92]' : ''}`}
                  >
                    <td className="py-2 px-3 whitespace-nowrap">
                      {severityBadge(job.severity)}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                      {job.primeUrl ? (
                        <a
                          href={job.primeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`underline underline-offset-2 ${
                            job.severity === 'critical' ? 'text-red-400 hover:text-red-300' :
                            job.severity === 'warning'  ? 'text-amber-400 hover:text-amber-300' :
                            'text-yellow-400 hover:text-yellow-300'
                          }`}
                        >
                          {job.jobNumber}
                        </a>
                      ) : (
                        <span className="text-red-400">{job.jobNumber}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-xs max-w-[140px] truncate">{job.address}</td>
                    <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">{job.assignee}</td>
                    <td className="py-2 px-3 text-xs text-gray-400 max-w-[120px] truncate">{job.status}</td>
                    <td className="py-2 px-3 hidden sm:table-cell">{job.jobType ? <JobTypeBadge label={job.jobType} /> : <span className="text-gray-600 text-xs">—</span>}</td>
                    <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap hidden sm:table-cell">{job.region}</td>
                    <td className="py-2 px-3 text-xs whitespace-nowrap">
                      <span className={
                        job.severity === 'critical' ? 'text-red-400' :
                        job.severity === 'warning'  ? 'text-amber-400' :
                        'text-yellow-400'
                      }>
                        {job.slaRule}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs font-mono font-bold whitespace-nowrap">
                      {job.daysOverdue > 0 ? (
                        <span className={
                          job.severity === 'critical' ? 'text-red-400' :
                          job.severity === 'warning'  ? 'text-amber-400' :
                          'text-yellow-400'
                        }>
                          +{job.daysOverdue}d
                        </span>
                      ) : (
                        <span className="text-yellow-400/70">due soon</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs font-mono text-gray-400 whitespace-nowrap hidden md:table-cell">
                      {job.authorisedTotal > 0 ? formatCurrency(job.authorisedTotal) : '—'}
                    </td>
                    <td className="py-2 px-3">
                      {job.primeUrl && (
                        <a
                          href={job.primeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-red-400"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Missing Build Schedules — Suncorp KPI */}
      <MissingSchedulesSection />
    </div>
  );
}
