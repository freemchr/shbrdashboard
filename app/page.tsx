'use client';

import { useEffect, useState, useRef } from 'react';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate, formatCurrency } from '@/lib/prime-helpers';
import { ExternalLink, Briefcase, AlertTriangle, Calendar, Hash, X, Search } from 'lucide-react';

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
          {job.clientReference && (
            <span className="text-xs text-gray-500 font-mono">{job.clientReference}</span>
          )}
          <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{job.jobType}</span>
          <span className="text-xs text-gray-500">{job.region}</span>
        </div>
        <p className="text-gray-300 truncate mt-0.5 text-xs">{job.address}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <p className="text-gray-600 text-xs">Updated {formatDate(job.updatedAt)} · {job.updatedBy || '—'}</p>
          {job.authorisedTotal > 0 && (
            <p className="text-gray-500 text-xs font-mono">{formatCurrency(job.authorisedTotal)}</p>
          )}
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

export default function OverviewPage() {
  const [openJobs, setOpenJobs] = useState<FlatJob[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [openCounts, setOpenCounts] = useState<StatusCount[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [chipSearch, setChipSearch] = useState('');
  const drilldownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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

  const totalOpen = openCounts.reduce((sum, s) => sum + s.count, 0);

  // All statuses sorted by count desc, filtered by chip search
  const filteredCounts = openCounts
    .filter(s => !chipSearch || s.status.toLowerCase().includes(chipSearch.toLowerCase()));

  // Drilldown
  const drilledJobs = selectedStatus
    ? openJobs.filter(j => j.status === selectedStatus).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    : [];

  // Report/Quote Sent panel
  const reportQuoteJobs = openJobs
    .filter(j => j.status === 'Report/Quote Sent')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleChipClick = (status: string) => {
    const next = selectedStatus === status ? null : status;
    setSelectedStatus(next);
    if (next) {
      // Scroll to drilldown after state update
      setTimeout(() => drilldownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  };

  // Colour-code chips by count
  const chipColour = (count: number) => {
    if (count >= 10) return 'bg-red-900/30 text-red-300 border-red-800/50 hover:bg-red-900/50';
    if (count >= 5)  return 'bg-orange-900/20 text-orange-300 border-orange-800/40 hover:bg-orange-900/40';
    return 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700';
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">

        {/* ALL STATUS CHIPS — 2/3 width */}
        <div className="xl:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-white">Open Jobs by Status</h2>
              <p className="text-xs text-gray-500 mt-0.5">Click any status to see those jobs below ↓</p>
            </div>
            {/* Chip search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Filter statuses…"
                value={chipSearch}
                onChange={e => setChipSearch(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 w-44"
              />
            </div>
          </div>

          {loadingCounts ? (
            <LoadingSpinner message="Loading statuses…" />
          ) : (
            <div className="flex flex-wrap gap-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredCounts.map(s => (
                <button
                  key={s.status}
                  onClick={() => handleChipClick(s.status)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    selectedStatus === s.status
                      ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/30 scale-105'
                      : chipColour(s.count)
                  }`}
                >
                  <span>{s.status}</span>
                  <span className={`font-bold text-xs px-1.5 py-0.5 rounded-full ${
                    selectedStatus === s.status ? 'bg-red-700 text-white' : 'bg-black/20 text-current'
                  }`}>
                    {s.count}
                  </span>
                </button>
              ))}
              {filteredCounts.length === 0 && (
                <p className="text-gray-500 text-sm py-6 text-center w-full">No statuses match "{chipSearch}"</p>
              )}
            </div>
          )}
        </div>

        {/* Report/Quote Sent — 1/3 width */}
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
              {reportQuoteJobs.length === 0 && (
                <p className="text-gray-500 text-sm py-8 text-center">No jobs</p>
              )}
              {reportQuoteJobs.length > 30 && (
                <p className="text-xs text-gray-600 text-center pt-2">
                  +{reportQuoteJobs.length - 30} more · use Job Search to see all
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drilldown panel */}
      {selectedStatus && (
        <div ref={drilldownRef} className="bg-gray-900 rounded-xl border border-red-900/40 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-white">{selectedStatus}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {loadingJobs ? '…' : `${drilledJobs.length} open job${drilledJobs.length !== 1 ? 's' : ''}`}
                {drilledJobs.length > 0 && !loadingJobs && ` · sorted by most recently updated`}
              </p>
            </div>
            <button
              onClick={() => setSelectedStatus(null)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <X size={13} />
              Close
            </button>
          </div>

          {loadingJobs ? (
            <LoadingSpinner message="Loading jobs…" />
          ) : drilledJobs.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No jobs found for this status.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {drilledJobs.slice(0, 90).map(job => <JobRow key={job.id} job={job} />)}
              </div>
              {drilledJobs.length > 90 && (
                <p className="text-xs text-gray-600 text-center mt-4">
                  Showing 90 of {drilledJobs.length} — use Job Search to see all
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
