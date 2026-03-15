'use client';

import { useEffect, useState } from 'react';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { BarChartComponent } from '@/components/charts/BarChartComponent';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate, formatCurrency } from '@/lib/prime-helpers';
import { ExternalLink, Briefcase, AlertTriangle, Calendar, Hash, X, ChevronRight } from 'lucide-react';

interface Kpis {
  totalJobs: number;
  openStatusCount: number;
  createdThisWeek: number;
  createdThisMonth: number;
  stuckOver7Days: number;
}

interface StatusCount { status: string; count: number; statusType: string; }

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

function JobRow({ job }: { job: FlatJob }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {job.primeUrl ? (
            <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
              className="font-mono text-red-400 text-xs hover:text-red-300 underline underline-offset-2">
              {job.jobNumber}
            </a>
          ) : (
            <span className="font-mono text-red-400 text-xs">{job.jobNumber}</span>
          )}
          {job.clientReference && (
            <span className="text-xs text-gray-500">{job.clientReference}</span>
          )}
          <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{job.jobType}</span>
          <span className="text-xs text-gray-500">{job.region}</span>
        </div>
        <p className="text-gray-300 truncate mt-0.5 text-xs">{job.address}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-gray-600 text-xs">Updated {formatDate(job.updatedAt)} by {job.updatedBy || '—'}</p>
          {job.authorisedTotal > 0 && (
            <p className="text-gray-500 text-xs font-mono">{formatCurrency(job.authorisedTotal)}</p>
          )}
        </div>
      </div>
      {job.primeUrl && (
        <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
          className="ml-3 text-gray-500 hover:text-red-400 flex-shrink-0">
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const [openJobs, setOpenJobs] = useState<FlatJob[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [openCounts, setOpenCounts] = useState<StatusCount[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drilldown state
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  useEffect(() => {
    // Load all open jobs (cached 30 min) — used for both panels
    fetch('/api/prime/jobs/open')
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load open jobs'))
      .then(d => setOpenJobs(Array.isArray(d) ? d : []))
      .catch(e => setError(String(e)))
      .finally(() => setLoadingJobs(false));

    fetch('/api/prime/jobs/kpis')
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load KPIs'))
      .then(d => setKpis(d))
      .catch(() => setKpis(null))
      .finally(() => setLoadingKpis(false));

    fetch('/api/prime/jobs/counts-by-status')
      .then(r => r.ok ? r.json() : [])
      .then(d => setOpenCounts(Array.isArray(d) ? d.filter((s: StatusCount) => s.statusType === 'Open') : []))
      .catch(() => setOpenCounts([]))
      .finally(() => setLoadingCounts(false));
  }, []);

  const chartData = openCounts.slice(0, 10).map(s => ({ name: s.status, value: s.count }));
  const totalOpen = openCounts.reduce((sum, s) => sum + s.count, 0);

  // Jobs for the drilldown panel
  const drilledJobs = selectedStatus
    ? openJobs.filter(j => j.status === selectedStatus)
    : [];

  // Jobs with status "Report/Quote Sent"
  const reportQuoteJobs = openJobs
    .filter(j => j.status === 'Report/Quote Sent')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleBarClick = (name: string) => {
    setSelectedStatus(prev => prev === name ? null : name);
  };

  return (
    <div>
      <PageHeader title="Overview" subtitle="Real-time snapshot of SHBR operations" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <KpiCard title="Total Jobs" value={loadingKpis ? '…' : (kpis?.totalJobs ?? '—')} icon={<Hash size={18} />} />
        <KpiCard title="Open Jobs" value={loadingCounts ? '…' : totalOpen} icon={<Briefcase size={18} />} />
        <KpiCard
          title="Stuck >7 Days"
          value={loadingKpis ? '…' : (kpis?.stuckOver7Days ?? '—')}
          icon={<AlertTriangle size={18} />}
          accent={!loadingKpis && (kpis?.stuckOver7Days ?? 0) > 0}
        />
        <KpiCard title="Created This Week" value={loadingKpis ? '…' : (kpis?.createdThisWeek ?? '—')} icon={<Calendar size={18} />} />
        <KpiCard title="Created This Month" value={loadingKpis ? '…' : (kpis?.createdThisMonth ?? '—')} icon={<Calendar size={18} />} />
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Open Jobs by Status Chart */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-lg font-semibold text-white mb-1">Open Jobs by Status (Top 10)</h2>
          <p className="text-xs text-gray-500 mb-4">Click a bar to see those jobs below ↓</p>
          {loadingCounts ? (
            <LoadingSpinner message="Loading status counts..." />
          ) : chartData.length > 0 ? (
            <BarChartComponent
              data={chartData}
              height={300}
              onBarClick={handleBarClick}
              activeBar={selectedStatus ?? undefined}
            />
          ) : (
            <p className="text-gray-500 text-sm py-8 text-center">No data</p>
          )}
        </div>

        {/* Report/Quote Sent */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Report/Quote Sent</h2>
              <p className="text-xs text-gray-500 mt-0.5">Jobs awaiting client response</p>
            </div>
            {!loadingJobs && (
              <span className="text-sm font-bold text-red-400 bg-red-900/20 px-3 py-1 rounded-full">
                {reportQuoteJobs.length}
              </span>
            )}
          </div>
          {loadingJobs ? (
            <LoadingSpinner message="Loading jobs..." />
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {reportQuoteJobs.slice(0, 20).map(job => <JobRow key={job.id} job={job} />)}
              {reportQuoteJobs.length === 0 && (
                <p className="text-gray-500 text-sm py-8 text-center">No jobs with this status</p>
              )}
              {reportQuoteJobs.length > 20 && (
                <p className="text-xs text-gray-600 text-center pt-2">
                  Showing 20 of {reportQuoteJobs.length} — use Job Search to see all
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drilldown panel — appears below when a bar is clicked */}
      {selectedStatus && (
        <div className="mt-6 bg-gray-900 rounded-xl border border-red-900/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ChevronRight size={16} className="text-red-400" />
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedStatus}</h2>
                <p className="text-xs text-gray-500">
                  {loadingJobs ? '…' : `${drilledJobs.length} open job${drilledJobs.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedStatus(null)}
              className="text-gray-500 hover:text-white transition-colors p-1 rounded"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {loadingJobs ? (
            <LoadingSpinner message="Loading jobs…" />
          ) : drilledJobs.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No jobs found for this status.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {drilledJobs.slice(0, 60).map(job => <JobRow key={job.id} job={job} />)}
              </div>
              {drilledJobs.length > 60 && (
                <p className="text-xs text-gray-600 text-center mt-4">
                  Showing 60 of {drilledJobs.length} — use Job Search to see all
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
