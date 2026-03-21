'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency } from '@/lib/prime-helpers';
import {
  Users, Briefcase, DollarSign, ExternalLink,
  ChevronDown, ChevronRight, Download,
  ChevronsUpDown, CheckCircle2, Clock, FileSearch,
} from 'lucide-react';
import { downloadCSV } from '@/lib/export-csv';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalCategory = 'atp' | 'awaiting' | 'assessing';

interface EstimatorJob {
  id: string;
  jobNumber: string;
  clientReference: string;
  address: string;
  status: string;
  statusId: string;
  region: string;
  jobType: string;
  authorisedTotal: number;
  createdAt: string;
  updatedAt: string;
  daysOpen: number;
  daysToLastUpdate: number;
  startDate: string;
  endDate: string;
  primeUrl: string;
  approvalCategory: ApprovalCategory;
  tags: string[];
}

interface EstimatorMember {
  id: string;
  name: string;
  email: string;
  totalJobs: number;
  totalValue: number;
  jobs: EstimatorJob[];
  jobsByStatus: Record<string, EstimatorJob[]>;
  green: number;
  amber: number;
  red: number;
  darkRed: number;
  atpCount: number;
  awaitingCount: number;
  assessingCount: number;
  pendingReports: number;
  readyToSubmit: number;
  qualityReview: number;
  avgDaysAtp: number;
  avgDaysAwaiting: number;
}

type ViewTab = 'all' | 'atp' | 'awaiting' | 'assessing';
type SortKey = 'name' | 'totalJobs' | 'aging' | 'reports' | 'totalValue' | 'atp' | 'awaiting';

// ─── Sub-components ───────────────────────────────────────────────────────────

function TrafficLight({ green, amber, red, darkRed }: {
  green: number; amber: number; red: number; darkRed: number;
}) {
  const total = green + amber + red + darkRed;
  if (total === 0) return <span className="text-gray-600 text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      {green > 0 && (
        <span className="flex items-center gap-1 text-xs font-mono">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" title="< 30 days" />
          <span className="text-green-400">{green}</span>
        </span>
      )}
      {amber > 0 && (
        <span className="flex items-center gap-1 text-xs font-mono">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" title="30–59 days" />
          <span className="text-amber-400">{amber}</span>
        </span>
      )}
      {red > 0 && (
        <span className="flex items-center gap-1 text-xs font-mono">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" title="60–89 days" />
          <span className="text-red-400">{red}</span>
        </span>
      )}
      {darkRed > 0 && (
        <span className="flex items-center gap-1 text-xs font-mono">
          <span className="w-2.5 h-2.5 rounded-full bg-red-900 border border-red-600 flex-shrink-0" title="90+ days" />
          <span className="text-red-300 font-bold">{darkRed}</span>
        </span>
      )}
    </div>
  );
}

function DaysBadge({ days }: { days: number }) {
  const cls =
    days >= 90 ? 'bg-red-900/50 text-red-300 border border-red-700' :
    days >= 60 ? 'bg-red-800/40 text-red-400 border border-red-800' :
    days >= 30 ? 'bg-amber-900/40 text-amber-400 border border-amber-800' :
                 'bg-green-900/30 text-green-400 border border-green-900';
  return (
    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${cls}`}>
      {days}d
    </span>
  );
}

function ApprovalBadge({ category }: { category: ApprovalCategory }) {
  if (category === 'atp') return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-900/50 text-green-300 border border-green-800 whitespace-nowrap">
      ATP
    </span>
  );
  if (category === 'awaiting') return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-800 whitespace-nowrap">
      AWAITING
    </span>
  );
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-800 whitespace-nowrap">
      ASSESSING
    </span>
  );
}

function CategorySplit({ atp, awaiting, assessing }: {
  atp: number; awaiting: number; assessing: number;
}) {
  const total = atp + awaiting + assessing;
  if (total === 0) return <span className="text-gray-600 text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {atp > 0 && (
        <span className="flex items-center gap-1 text-xs font-mono">
          <CheckCircle2 size={11} className="text-green-400 flex-shrink-0" />
          <span className="text-green-400">{atp}</span>
        </span>
      )}
      {awaiting > 0 && (
        <span className="flex items-center gap-1 text-xs font-mono">
          <Clock size={11} className="text-amber-400 flex-shrink-0" />
          <span className="text-amber-400">{awaiting}</span>
        </span>
      )}
      {assessing > 0 && (
        <span className="flex items-center gap-1 text-xs font-mono">
          <FileSearch size={11} className="text-blue-400 flex-shrink-0" />
          <span className="text-blue-400">{assessing}</span>
        </span>
      )}
    </div>
  );
}

function EstimatorRow({
  estimator,
  activeTab,
}: {
  estimator: EstimatorMember;
  activeTab: ViewTab;
}) {
  const [expanded, setExpanded] = useState(false);

  const visibleJobs = activeTab === 'all'
    ? estimator.jobs
    : estimator.jobs.filter(j => j.approvalCategory === activeTab);

  const shownCount = visibleJobs.length;
  if (shownCount === 0) return null;

  return (
    <>
      <tr
        className="border-b border-gray-800/60 hover:bg-gray-800/30 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Name */}
        <td className="px-4 py-3 pl-5 whitespace-nowrap">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
              : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
            }
            <div>
              <div className="font-medium text-white text-sm">{estimator.name}</div>
              <div className="text-xs text-gray-500 hidden sm:block">{estimator.email}</div>
            </div>
          </div>
        </td>

        {/* Open jobs count */}
        <td className="px-4 py-3 whitespace-nowrap">
          <span className={`font-bold font-mono text-sm ${
            shownCount > 20 ? 'text-red-400' :
            shownCount > 10 ? 'text-amber-400' :
            'text-green-400'
          }`}>
            {shownCount}
          </span>
          {activeTab !== 'all' && (
            <span className="text-gray-600 text-xs ml-1">/ {estimator.totalJobs}</span>
          )}
        </td>

        {/* Aging traffic light */}
        <td className="px-4 py-3 whitespace-nowrap">
          {activeTab === 'all'
            ? <TrafficLight
                green={estimator.green}
                amber={estimator.amber}
                red={estimator.red}
                darkRed={estimator.darkRed}
              />
            : (() => {
                const g = visibleJobs.filter(j => j.daysOpen < 30).length;
                const a = visibleJobs.filter(j => j.daysOpen >= 30 && j.daysOpen < 60).length;
                const r = visibleJobs.filter(j => j.daysOpen >= 60 && j.daysOpen < 90).length;
                const d = visibleJobs.filter(j => j.daysOpen >= 90).length;
                return <TrafficLight green={g} amber={a} red={r} darkRed={d} />;
              })()
          }
        </td>

        {/* Category split (only in All tab) */}
        {activeTab === 'all' && (
          <td className="px-4 py-3 whitespace-nowrap hidden xl:table-cell">
            <CategorySplit
              atp={estimator.atpCount}
              awaiting={estimator.awaitingCount}
              assessing={estimator.assessingCount}
            />
          </td>
        )}

        {/* Report pipeline */}
        <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">
          <div className="flex items-center gap-2">
            {estimator.pendingReports > 0 && (
              <span className="text-xs font-mono bg-blue-900/40 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full" title="Reports being written">
                ✍️ {estimator.pendingReports}
              </span>
            )}
            {estimator.readyToSubmit > 0 && (
              <span className="text-xs font-mono bg-green-900/40 text-green-300 border border-green-800 px-2 py-0.5 rounded-full" title="Ready to submit">
                📤 {estimator.readyToSubmit}
              </span>
            )}
            {estimator.qualityReview > 0 && (
              <span className="text-xs font-mono bg-purple-900/40 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full" title="Quality review required">
                🔍 {estimator.qualityReview}
              </span>
            )}
            {estimator.pendingReports === 0 && estimator.readyToSubmit === 0 && estimator.qualityReview === 0 && (
              <span className="text-xs text-gray-600">—</span>
            )}
          </div>
        </td>

        {/* Avg days waiting (shown in awaiting tab or all) */}
        {(activeTab === 'awaiting' || activeTab === 'all') && estimator.awaitingCount > 0 && (
          <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
            <span className={`text-xs font-mono ${
              estimator.avgDaysAwaiting >= 60 ? 'text-red-400' :
              estimator.avgDaysAwaiting >= 30 ? 'text-amber-400' :
              'text-gray-400'
            }`}>
              {estimator.avgDaysAwaiting}d avg wait
            </span>
          </td>
        )}
        {!((activeTab === 'awaiting' || activeTab === 'all') && estimator.awaitingCount > 0) && (
          <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
            <span className="text-xs text-gray-600">—</span>
          </td>
        )}

        {/* Value */}
        <td className="px-4 py-3 text-xs font-mono text-gray-300 whitespace-nowrap hidden md:table-cell">
          {estimator.totalValue > 0 ? formatCurrency(estimator.totalValue) : '—'}
        </td>
      </tr>

      {/* Expanded job rows */}
      {expanded && visibleJobs.map(job => (
        <tr
          key={job.id}
          className="border-b border-gray-800/30 bg-gray-900/60 hover:bg-gray-800/20 transition-colors"
        >
          {/* Job number + address */}
          <td className="px-4 py-2.5 pl-10 whitespace-nowrap" colSpan={activeTab === 'all' ? 1 : 1}>
            <div className="flex flex-col gap-0.5">
              {job.primeUrl ? (
                <a
                  href={job.primeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-red-400 hover:text-red-300 underline underline-offset-2 flex items-center gap-1"
                  onClick={e => e.stopPropagation()}
                >
                  {job.jobNumber}
                  <ExternalLink size={10} />
                </a>
              ) : (
                <span className="font-mono text-xs text-red-400">{job.jobNumber}</span>
              )}
              <span className="text-[11px] text-gray-500 truncate max-w-[180px]">{job.address}</span>
            </div>
          </td>

          {/* Status */}
          <td className="px-4 py-2.5 whitespace-nowrap">
            <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full truncate max-w-[140px] block">
              {job.status}
            </span>
          </td>

          {/* Days open */}
          <td className="px-4 py-2.5 whitespace-nowrap">
            <DaysBadge days={job.daysOpen} />
          </td>

          {/* Approval category (only in All tab) */}
          {activeTab === 'all' && (
            <td className="px-4 py-2.5 whitespace-nowrap hidden xl:table-cell">
              <ApprovalBadge category={job.approvalCategory} />
            </td>
          )}

          {/* Report pipeline placeholder */}
          <td className="px-4 py-2.5 hidden lg:table-cell">
            {job.startDate && (
              <span className="text-[11px] text-gray-500">
                Start: {job.startDate.slice(0, 10)}
                {job.endDate ? ` → ${job.endDate.slice(0, 10)}` : ''}
              </span>
            )}
          </td>

          {/* Avg wait placeholder */}
          <td className="px-4 py-2.5 whitespace-nowrap hidden md:table-cell">
            <span className="text-xs text-gray-500 font-mono">
              {job.daysToLastUpdate > 0 ? `${job.daysToLastUpdate}d since update` : '—'}
            </span>
          </td>

          {/* Value */}
          <td className="px-4 py-2.5 text-xs font-mono text-gray-400 hidden md:table-cell whitespace-nowrap">
            {job.authorisedTotal > 0 ? formatCurrency(job.authorisedTotal) : '—'}
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EstimatorsPage() {
  const [estimators, setEstimators] = useState<EstimatorMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDays, setFilterDays] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('totalJobs');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  useEffect(() => {
    fetch('/api/prime/jobs/estimators')
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error || 'Failed')))
      .then((d: EstimatorMember[]) => setEstimators(Array.isArray(d) ? d : []))
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading estimator workloads…" />;
  if (error)   return <ErrorMessage message={error} />;

  // Filter by overdue band
  const afterDaysFilter = filterDays === null
    ? estimators
    : estimators.filter(e => {
        const jobs = activeTab === 'all' ? e.jobs : e.jobs.filter(j => j.approvalCategory === activeTab);
        if (filterDays === 30) return jobs.some(j => j.daysOpen >= 30);
        if (filterDays === 60) return jobs.some(j => j.daysOpen >= 60);
        if (filterDays === 90) return jobs.some(j => j.daysOpen >= 90);
        return true;
      });

  // Sort
  const displayed = [...afterDaysFilter].sort((a, b) => {
    let cmp = 0;
    const aJobs = activeTab === 'all' ? a.jobs : a.jobs.filter(j => j.approvalCategory === activeTab);
    const bJobs = activeTab === 'all' ? b.jobs : b.jobs.filter(j => j.approvalCategory === activeTab);
    switch (sortKey) {
      case 'name':       cmp = a.name.localeCompare(b.name); break;
      case 'totalJobs':  cmp = aJobs.length - bJobs.length; break;
      case 'aging':      cmp =
        (a.darkRed * 1000 + a.red * 100 + a.amber * 10 + a.green) -
        (b.darkRed * 1000 + b.red * 100 + b.amber * 10 + b.green); break;
      case 'reports':    cmp = (a.pendingReports + a.readyToSubmit + a.qualityReview) -
                               (b.pendingReports + b.readyToSubmit + b.qualityReview); break;
      case 'totalValue': cmp = a.totalValue - b.totalValue; break;
      case 'atp':        cmp = a.atpCount - b.atpCount; break;
      case 'awaiting':   cmp = a.awaitingCount - b.awaitingCount; break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  }).filter(e => {
    // Hide rows with 0 visible jobs in filtered tab
    const count = activeTab === 'all' ? e.totalJobs : e.jobs.filter(j => j.approvalCategory === activeTab).length;
    return count > 0;
  });

  // KPI totals
  const allJobs   = estimators.reduce((s, e) => s + e.totalJobs, 0);
  const allValue  = estimators.reduce((s, e) => s + e.totalValue, 0);
  const totalAtp       = estimators.reduce((s, e) => s + e.atpCount, 0);
  const totalAwaiting  = estimators.reduce((s, e) => s + e.awaitingCount, 0);
  const totalAssessing = estimators.reduce((s, e) => s + e.assessingCount, 0);
  const totalOver30 = estimators.reduce((s, e) => s + e.amber + e.red + e.darkRed, 0);
  const totalOver90 = estimators.reduce((s, e) => s + e.darkRed, 0);

  const handleExport = () => {
    const rows: (string | number)[][] = [];
    for (const e of displayed) {
      const jobs = activeTab === 'all' ? e.jobs : e.jobs.filter(j => j.approvalCategory === activeTab);
      for (const job of jobs) {
        rows.push([
          e.name, e.email,
          job.jobNumber, job.clientReference, job.address,
          job.status, job.approvalCategory, job.region, job.jobType,
          job.daysOpen, job.daysToLastUpdate,
          job.startDate, job.endDate,
          job.authorisedTotal,
          job.createdAt, job.updatedAt,
          job.primeUrl,
        ]);
      }
    }
    downloadCSV(
      `estimators-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`,
      ['Estimator', 'Email', 'Job #', 'Client Ref', 'Address',
       'Status', 'Category', 'Region', 'Type',
       'Days Open', 'Days Since Update',
       'Start Date', 'End Date',
       'Auth. Total', 'Created', 'Updated', 'Prime URL'],
      rows
    );
  };

  const tabs: { key: ViewTab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'all',       label: 'All Jobs',         count: allJobs,        icon: <Briefcase size={13} /> },
    { key: 'atp',       label: 'ATP / Active',      count: totalAtp,       icon: <CheckCircle2 size={13} /> },
    { key: 'awaiting',  label: 'Awaiting Approval', count: totalAwaiting,  icon: <Clock size={13} /> },
    { key: 'assessing', label: 'Assessing',         count: totalAssessing, icon: <FileSearch size={13} /> },
  ];

  const colCount = activeTab === 'all' ? 7 : 6;

  return (
    <div>
      <PageHeader
        title="Estimators"
        subtitle="Open jobs per estimator — approval status, aging and report pipeline"
        actions={
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <KpiCard title="Estimators" value={estimators.length} icon={<Users size={18} />} />
        <KpiCard
          title="ATP / Active"
          value={totalAtp}
          icon={<CheckCircle2 size={18} className="text-green-400" />}
        />
        <KpiCard
          title="Awaiting Approval"
          value={totalAwaiting}
          icon={<Clock size={18} className="text-amber-400" />}
          accent={totalAwaiting > 0}
        />
        <KpiCard
          title="Over 90 Days"
          value={totalOver90}
          icon={<span className="w-3 h-3 rounded-full bg-red-900 border border-red-600 inline-block" />}
          accent={totalOver90 > 0}
        />
      </div>

      {/* Total value */}
      <div className="mb-5">
        <div className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DollarSign size={18} className="text-gray-500 flex-shrink-0" />
            <span className="text-sm text-gray-400 font-medium">Total Authorised Value</span>
          </div>
          <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
            {formatCurrency(allValue)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800 pb-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setFilterDays(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-red-500 text-white bg-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Legend + tab description */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          {activeTab === 'all' || activeTab === 'atp' || activeTab === 'awaiting' || activeTab === 'assessing' ? (
            <>
              <span className="font-medium text-gray-400">Age (days open):</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> &lt; 30d</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> 30–59d</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> 60–89d</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-900 border border-red-600 inline-block" /> 90d+</span>
            </>
          ) : null}
          {activeTab === 'all' && (
            <>
              <span className="font-medium text-gray-400 ml-2">Category:</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-green-400" /> ATP</span>
              <span className="flex items-center gap-1"><Clock size={11} className="text-amber-400" /> Awaiting</span>
              <span className="flex items-center gap-1"><FileSearch size={11} className="text-blue-400" /> Assessing</span>
            </>
          )}
        </div>

        {/* Filter by overdue */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 hidden sm:inline">Show overdue:</span>
          {[
            { label: 'All', val: null },
            { label: '30+ days', val: 30 },
            { label: '60+ days', val: 60 },
            { label: '90+ days', val: 90 },
          ].map(({ label, val }) => (
            <button
              key={label}
              onClick={() => setFilterDays(val)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                filterDays === val
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Awaiting tab: extra context banner */}
      {activeTab === 'awaiting' && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-amber-800 bg-amber-900/20 text-amber-300 text-xs flex items-start gap-2">
          <Clock size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>{totalAwaiting} jobs</strong> are sitting with the insurer or awaiting client approval — the ball is not in SHBR&apos;s court.
            The <em>Avg Wait</em> column shows how long they&apos;ve been waiting. Jobs over 30 days should be chased.
          </span>
        </div>
      )}

      {activeTab === 'atp' && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-green-800 bg-green-900/20 text-green-300 text-xs flex items-start gap-2">
          <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>{totalAtp} jobs</strong> have Authority to Proceed — works are approved and active.
            Expand any estimator to see scheduled start/end dates and days since last update.
          </span>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">
            Estimator Workload
            <span className="text-gray-500 font-normal ml-1">
              ({displayed.length} estimator{displayed.length !== 1 ? 's' : ''}
              {activeTab !== 'all' ? `, ${activeTab} view` : ''})
            </span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {([
                  { key: 'name' as SortKey,       label: 'Estimator',         cls: 'pl-5',                  show: true },
                  { key: 'totalJobs' as SortKey,   label: 'Jobs',              cls: '',                      show: true },
                  { key: 'aging' as SortKey,       label: 'Aging',             cls: '',                      show: true },
                  { key: 'atp' as SortKey,         label: 'ATP/Wait/Assess',   cls: 'hidden xl:table-cell',  show: activeTab === 'all' },
                  { key: 'reports' as SortKey,     label: 'Reports Pipeline',  cls: 'hidden lg:table-cell',  show: true },
                  { key: 'awaiting' as SortKey,    label: 'Avg Wait',          cls: 'hidden md:table-cell',  show: true },
                  { key: 'totalValue' as SortKey,  label: 'Auth. Value',       cls: 'hidden md:table-cell',  show: true },
                ] as { key: SortKey; label: string; cls: string; show: boolean }[])
                  .filter(c => c.show)
                  .map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`px-4 py-2.5 text-left text-xs text-gray-500 font-medium cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap ${col.cls}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key
                          ? sortDir === 'asc'
                            ? <ChevronDown size={11} className="text-red-400 rotate-180" />
                            : <ChevronDown size={11} className="text-red-400" />
                          : <ChevronsUpDown size={11} className="text-gray-700" />
                        }
                      </span>
                    </th>
                  ))
                }
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-5 py-10 text-center text-gray-500 text-sm">
                    No estimators with open jobs in this view.
                  </td>
                </tr>
              ) : (
                displayed.map(e => (
                  <EstimatorRow key={e.id} estimator={e} activeTab={activeTab} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 grid grid-cols-3 sm:grid-cols-4 gap-4 text-xs text-gray-500">
          <div>Total: <span className="text-gray-300 font-mono">{allJobs}</span></div>
          <div>
            <span className="text-green-400 font-mono">{totalAtp}</span> ATP &nbsp;|&nbsp;
            <span className="text-amber-400 font-mono">{totalAwaiting}</span> Waiting &nbsp;|&nbsp;
            <span className="text-blue-400 font-mono">{totalAssessing}</span> Assessing
          </div>
          <div>
            30d+: <span className="text-amber-400 font-mono">{totalOver30}</span>
            &nbsp;|&nbsp; 90d+: <span className="text-red-300 font-bold font-mono">{totalOver90}</span>
          </div>
          <div className="text-right hidden sm:block">
            Value: <span className="text-gray-300 font-mono">{formatCurrency(allValue)}</span>
          </div>
        </div>
      </div>

      {/* Glossary */}
      <div className="mt-8 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Glossary</h2>
          <p className="text-xs text-gray-500 mt-0.5">What do the abbreviations and indicators on this page mean?</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs text-gray-400">

          {/* Approval Categories */}
          <div>
            <h3 className="text-gray-300 font-semibold mb-2 uppercase tracking-wider text-[10px]">Approval Categories</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-900/50 text-green-300 border border-green-800 whitespace-nowrap flex-shrink-0">ATP</span>
                <span><strong className="text-gray-300">Authority to Proceed</strong> — the insurer has approved the works and the job is active.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-800 whitespace-nowrap flex-shrink-0">AWAITING</span>
                <span><strong className="text-gray-300">Awaiting Approval</strong> — report or quote has been submitted; waiting on insurer or client to approve. The ball is not in SHBR&apos;s court.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-800 whitespace-nowrap flex-shrink-0">ASSESSING</span>
                <span><strong className="text-gray-300">Assessing / Quoting</strong> — job is being scoped, inspected or quoted by the estimator. Report not yet submitted.</span>
              </li>
            </ul>
          </div>

          {/* Aging Traffic Lights */}
          <div>
            <h3 className="text-gray-300 font-semibold mb-2 uppercase tracking-wider text-[10px]">Aging (Days Open)</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                <span><strong className="text-gray-300">Green — under 30 days.</strong> Job is within normal timeframe.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
                <span><strong className="text-gray-300">Amber — 30 to 59 days.</strong> Starting to age; worth monitoring.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                <span><strong className="text-gray-300">Red — 60 to 89 days.</strong> Overdue; follow-up required.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-900 border border-red-600 flex-shrink-0" />
                <span><strong className="text-gray-300">Dark Red — 90+ days.</strong> Critically overdue; urgent action needed.</span>
              </li>
            </ul>
          </div>

          {/* Report Pipeline & Other */}
          <div>
            <h3 className="text-gray-300 font-semibold mb-2 uppercase tracking-wider text-[10px]">Report Pipeline &amp; Other</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 text-base leading-none">✍️</span>
                <span><strong className="text-gray-300">Reports in progress</strong> — report is being written by the estimator.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 text-base leading-none">📤</span>
                <span><strong className="text-gray-300">Ready to submit</strong> — report is complete and ready to be sent to the insurer.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 text-base leading-none">🔍</span>
                <span><strong className="text-gray-300">Quality review</strong> — report is under internal peer review before submission.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 font-mono text-gray-300 whitespace-nowrap">Auth. Value</span>
                <span><strong className="text-gray-300">Authorised Total Value</strong> — the total dollar value approved by the insurer for works on that job.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 font-mono text-gray-300 whitespace-nowrap">Avg Wait</span>
                <span><strong className="text-gray-300">Average Wait (days)</strong> — average number of days jobs in the &quot;Awaiting&quot; category have been sitting without movement.</span>
              </li>
            </ul>
          </div>

        </div>
      </div>

    </div>
  );
}
