'use client';

import { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage, SkeletonTable } from '@/components/ui/LoadingSpinner';
import { KpiCard } from '@/components/ui/KpiCard';
import { DataRefreshButton } from '@/components/ui/DataRefreshButton';
import { downloadCSV } from '@/lib/export-csv';
import {
  Briefcase,
  CalendarCheck,
  CalendarClock,
  Wrench,
  ThumbsUp,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Download,
  X,
  ExternalLink,
} from 'lucide-react';

interface OpsJob {
  id: string;
  jobNumber: string;
  clientReference: string;
  description: string;
  address: string;
  status: string;
  jobType: string;
  region: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  createdBy: string;
  primeUrl: string;
  postcode: string;
  assignee: string;
  insurer: string;
}

interface OpsData {
  jobs: OpsJob[];
  insurers: string[];
  assignees: string[];
  actionQueues: {
    needsAppointment: OpsJob[];
    appointmentRequired: OpsJob[];
    apptTBC: OpsJob[];
    awaitingTrade: OpsJob[];
    awaitingApproval: OpsJob[];
  };
  lastUpdated: string;
}

type SortKey = 'jobNumber' | 'insurer' | 'address' | 'postcode' | 'status' | 'assignee' | 'age' | 'action';

function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function AgeCell({ days }: { days: number }) {
  const colour =
    days > 90 ? 'text-red-400' :
    days >= 30 ? 'text-amber-400' :
    'text-green-400';
  return <span className={`font-mono text-xs ${colour}`}>{days}d</span>;
}

function ActionBadge({ job, needsAppointment, awaitingTrade, awaitingApproval }: {
  job: OpsJob;
  needsAppointment: Set<string>;
  awaitingTrade: Set<string>;
  awaitingApproval: Set<string>;
}) {
  if (needsAppointment.has(job.id))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-900/50 text-blue-300 border border-blue-700/50">Appointment</span>;
  if (awaitingTrade.has(job.id))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-900/50 text-orange-300 border border-orange-700/50">Trade</span>;
  if (awaitingApproval.has(job.id))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-900/50 text-purple-300 border border-purple-700/50">Approval</span>;
  return <span className="text-gray-700 text-xs">—</span>;
}

function actionLabel(job: OpsJob, needsAppointment: Set<string>, awaitingTrade: Set<string>, awaitingApproval: Set<string>): string {
  if (needsAppointment.has(job.id)) return 'Appointment';
  if (awaitingTrade.has(job.id)) return 'Trade';
  if (awaitingApproval.has(job.id)) return 'Approval';
  return '';
}

export default function OpsPage() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [insurerFilter, setInsurerFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [queueFilter, setQueueFilter] = useState<'all' | 'needsAppointment' | 'appointmentRequired' | 'apptTBC' | 'awaitingTrade' | 'awaitingApproval'>('all');
  const [statusFilter, setStatusFilter] = useState('');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('age');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/prime/ops')
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error || 'Failed to load')))
      .then((d: OpsData) => setData(d))
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const needsAppointmentSet = useMemo(
    () => new Set((data?.actionQueues.needsAppointment || []).map(j => j.id)),
    [data]
  );
  const appointmentRequiredSet = useMemo(
    () => new Set((data?.actionQueues.appointmentRequired || []).map(j => j.id)),
    [data]
  );
  const apptTBCSet = useMemo(
    () => new Set((data?.actionQueues.apptTBC || []).map(j => j.id)),
    [data]
  );
  const awaitingTradeSet = useMemo(
    () => new Set((data?.actionQueues.awaitingTrade || []).map(j => j.id)),
    [data]
  );
  const awaitingApprovalSet = useMemo(
    () => new Set((data?.actionQueues.awaitingApproval || []).map(j => j.id)),
    [data]
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    let jobs = data.jobs;

    if (insurerFilter) jobs = jobs.filter(j => j.insurer === insurerFilter);
    if (assigneeFilter) jobs = jobs.filter(j => j.assignee === assigneeFilter);
    if (statusFilter) jobs = jobs.filter(j => j.status.toLowerCase().includes(statusFilter.toLowerCase()));

    if (queueFilter === 'needsAppointment') jobs = jobs.filter(j => needsAppointmentSet.has(j.id));
    else if (queueFilter === 'appointmentRequired') jobs = jobs.filter(j => appointmentRequiredSet.has(j.id));
    else if (queueFilter === 'apptTBC') jobs = jobs.filter(j => apptTBCSet.has(j.id));
    else if (queueFilter === 'awaitingTrade') jobs = jobs.filter(j => awaitingTradeSet.has(j.id));
    else if (queueFilter === 'awaitingApproval') jobs = jobs.filter(j => awaitingApprovalSet.has(j.id));

    return [...jobs].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;

      switch (sortKey) {
        case 'jobNumber': av = a.jobNumber; bv = b.jobNumber; break;
        case 'insurer': av = a.insurer; bv = b.insurer; break;
        case 'address': av = a.address; bv = b.address; break;
        case 'postcode': av = a.postcode; bv = b.postcode; break;
        case 'status': av = a.status; bv = b.status; break;
        case 'assignee': av = a.assignee; bv = b.assignee; break;
        case 'age': av = daysSince(a.createdAt); bv = daysSince(b.createdAt); break;
        case 'action':
          av = actionLabel(a, needsAppointmentSet, awaitingTradeSet, awaitingApprovalSet);
          bv = actionLabel(b, needsAppointmentSet, awaitingTradeSet, awaitingApprovalSet);
          break;
      }

      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, insurerFilter, assigneeFilter, queueFilter, statusFilter, sortKey, sortDir, needsAppointmentSet, appointmentRequiredSet, apptTBCSet, awaitingTradeSet, awaitingApprovalSet]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const clearFilters = () => {
    setInsurerFilter('');
    setAssigneeFilter('');
    setQueueFilter('all');
    setStatusFilter('');
  };

  const hasFilters = insurerFilter || assigneeFilter || queueFilter !== 'all' || statusFilter;

  const handleExport = () => {
    downloadCSV(
      `ops-dashboard-${new Date().toISOString().split('T')[0]}.csv`,
      ['Job #', 'Insurer', 'Client Ref', 'Address', 'Postcode', 'Status', 'Assignee', 'Age (days)', 'Action Queue', 'Job Type', 'Region', 'Created At'],
      filtered.map(j => [
        j.jobNumber,
        j.insurer,
        j.clientReference,
        j.address,
        j.postcode,
        j.status,
        j.assignee,
        daysSince(j.createdAt),
        actionLabel(j, needsAppointmentSet, awaitingTradeSet, awaitingApprovalSet),
        j.jobType,
        j.region,
        j.createdAt,
      ])
    );
  };

  const SortTh = ({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-4 py-2.5 text-left text-xs text-gray-500 font-medium cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap ${className}`}
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

  if (loading) return <SkeletonTable rows={10} />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const totalJobs = data.jobs.length;
  const apptRequiredCount = data.actionQueues.appointmentRequired.length;
  const apptTBCCount = data.actionQueues.apptTBC.length;
  const tradeCount = data.actionQueues.awaitingTrade.length;
  const approvalCount = data.actionQueues.awaitingApproval.length;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Operations Dashboard"
        subtitle="Live job view — filter by insurer, assignee, or action queue"
        actions={<DataRefreshButton />}
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <KpiCard
          title="Total Open Jobs"
          value={totalJobs}
          icon={<Briefcase size={18} />}
        />
        <KpiCard
          title="Appointment Required"
          value={apptRequiredCount}
          icon={<CalendarCheck size={18} />}
          onClick={() => setQueueFilter(q => q === 'appointmentRequired' ? 'all' : 'appointmentRequired')}
          active={queueFilter === 'appointmentRequired'}
        />
        <KpiCard
          title="Appt TBC"
          value={apptTBCCount}
          icon={<CalendarClock size={18} />}
          onClick={() => setQueueFilter(q => q === 'apptTBC' ? 'all' : 'apptTBC')}
          active={queueFilter === 'apptTBC'}
        />
        <KpiCard
          title="Awaiting Trade/Specialist"
          value={tradeCount}
          icon={<Wrench size={18} />}
          onClick={() => setQueueFilter(q => q === 'awaitingTrade' ? 'all' : 'awaitingTrade')}
          active={queueFilter === 'awaitingTrade'}
        />
        <KpiCard
          title="Awaiting Approval"
          value={approvalCount}
          icon={<ThumbsUp size={18} />}
          onClick={() => setQueueFilter(q => q === 'awaitingApproval' ? 'all' : 'awaitingApproval')}
          active={queueFilter === 'awaitingApproval'}
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Insurer dropdown */}
          <select
            value={insurerFilter}
            onChange={e => setInsurerFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 transition-colors"
          >
            <option value="">All Insurers</option>
            {data.insurers.map(ins => (
              <option key={ins} value={ins}>{ins}</option>
            ))}
          </select>

          {/* Assignee dropdown */}
          <select
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 transition-colors"
          >
            <option value="">All Assignees</option>
            {data.assignees.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Action Queue filter */}
          <select
            value={queueFilter}
            onChange={e => setQueueFilter(e.target.value as typeof queueFilter)}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 transition-colors"
          >
            <option value="all">All Queues</option>
            <option value="appointmentRequired">Appointment Required</option>
            <option value="apptTBC">Appt TBC</option>
            <option value="awaitingTrade">Awaiting Trade</option>
            <option value="awaitingApproval">Awaiting Approval</option>
          </select>

          {/* Status text filter */}
          <input
            type="text"
            placeholder="Filter by status…"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 placeholder-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 transition-colors min-w-[160px]"
          />

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
            >
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-white">
            Jobs{' '}
            <span className="text-gray-500 font-normal">
              (Showing {filtered.length} of {totalJobs} jobs)
            </span>
          </h2>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <SortTh col="jobNumber" label="Job #" className="pl-5" />
                <SortTh col="insurer" label="Insurer" />
                <SortTh col="address" label="Address" />
                <SortTh col="postcode" label="Postcode" />
                <SortTh col="status" label="Status" />
                <SortTh col="assignee" label="Assignee" />
                <SortTh col="age" label="Age" />
                <SortTh col="action" label="Action" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(job => {
                const age = daysSince(job.createdAt);
                return (
                  <tr key={job.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-2.5 pl-5 whitespace-nowrap">
                      {job.primeUrl ? (
                        <a
                          href={job.primeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-mono text-xs font-medium transition-colors"
                        >
                          {job.jobNumber}
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-gray-300">{job.jobNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="text-xs text-gray-300">{job.insurer}</span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <span className="text-xs text-gray-400 block truncate" title={job.address}>
                        {job.address || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="font-mono text-xs text-gray-400">{job.postcode || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[160px]">
                      <span className="text-xs text-gray-300 block truncate" title={job.status}>{job.status}</span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="text-xs text-gray-400">{job.assignee || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <AgeCell days={age} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <ActionBadge
                        job={job}
                        needsAppointment={needsAppointmentSet}
                        awaitingTrade={awaitingTradeSet}
                        awaitingApproval={awaitingApprovalSet}
                      />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                      </div>
                      <div>
                        <p className="text-gray-300 font-semibold text-sm">No jobs match filters</p>
                        <p className="text-gray-500 text-xs mt-1">Try adjusting your filters.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data.lastUpdated && (
          <div className="px-5 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-600">
              Last updated: {new Date(data.lastUpdated).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
