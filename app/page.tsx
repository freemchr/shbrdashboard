'use client';

import { useEffect, useState } from 'react';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { BarChartComponent } from '@/components/charts/BarChartComponent';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate } from '@/lib/prime-helpers';
import type { PrimeJob } from '@/lib/prime-helpers';
import { ExternalLink, Briefcase, AlertTriangle, Calendar, Hash } from 'lucide-react';

interface Kpis {
  totalJobs: number;
  openStatusCount: number;
  createdThisWeek: number;
  createdThisMonth: number;
  stuckOver7Days: number;
}

interface StatusCount { status: string; count: number; statusType: string; }

export default function OverviewPage() {
  const [recentJobs, setRecentJobs] = useState<PrimeJob[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [openCounts, setOpenCounts] = useState<StatusCount[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load recent jobs fast (one API call)
    fetch('/api/prime/jobs?per_page=10&order=updatedAt|DESC')
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load jobs'))
      .then(d => setRecentJobs(d.data || []))
      .catch(e => setError(String(e)))
      .finally(() => setLoadingRecent(false));

    // Load KPIs fast (parallel queries)
    fetch('/api/prime/jobs/kpis')
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load KPIs'))
      .then(d => setKpis(d))
      .catch(() => setKpis(null))
      .finally(() => setLoadingKpis(false));

    // Load status counts (slower, but loads independently)
    fetch('/api/prime/jobs/counts-by-status')
      .then(r => r.ok ? r.json() : [])
      .then(d => setOpenCounts(Array.isArray(d) ? d.filter((s: StatusCount) => s.statusType === 'Open') : []))
      .catch(() => setOpenCounts([]))
      .finally(() => setLoadingCounts(false));
  }, []);

  const chartData = openCounts.slice(0, 10).map(s => ({ name: s.status, value: s.count }));
  const totalOpen = openCounts.reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <PageHeader title="Overview" subtitle="Real-time snapshot of SHBR operations" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <KpiCard
          title="Total Jobs"
          value={loadingKpis ? '…' : (kpis?.totalJobs ?? '—')}
          icon={<Hash size={18} />}
        />
        <KpiCard
          title="Open Jobs"
          value={loadingCounts ? '…' : totalOpen}
          icon={<Briefcase size={18} />}
        />
        <KpiCard
          title="Stuck >7 Days"
          value={loadingKpis ? '…' : (kpis?.stuckOver7Days ?? '—')}
          icon={<AlertTriangle size={18} />}
          accent={!loadingKpis && (kpis?.stuckOver7Days ?? 0) > 0}
        />
        <KpiCard
          title="Created This Week"
          value={loadingKpis ? '…' : (kpis?.createdThisWeek ?? '—')}
          icon={<Calendar size={18} />}
        />
        <KpiCard
          title="Created This Month"
          value={loadingKpis ? '…' : (kpis?.createdThisMonth ?? '—')}
          icon={<Calendar size={18} />}
        />
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Open Jobs by Status Chart */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Open Jobs by Status (Top 10)</h2>
          {loadingCounts ? (
            <LoadingSpinner message="Loading status counts..." />
          ) : chartData.length > 0 ? (
            <BarChartComponent data={chartData} height={300} />
          ) : (
            <p className="text-gray-500 text-sm py-8 text-center">No data</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Recently Updated Jobs</h2>
          {loadingRecent ? (
            <LoadingSpinner message="Loading recent jobs..." />
          ) : (
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg text-sm hover:bg-gray-800 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-red-400 text-xs">{job.attributes?.jobNumber || job.id}</span>
                      <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                        {job.attributes?.jobType || '—'}
                      </span>
                      <span className="text-xs text-gray-500">{job.attributes?.region || ''}</span>
                    </div>
                    <p className="text-gray-300 truncate mt-0.5 text-xs">
                      {[job.attributes?.address?.addressLine1, job.attributes?.address?.suburb, job.attributes?.address?.state].filter(Boolean).join(', ') || '—'}
                    </p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Updated {formatDate(job.attributes?.updatedAt)} by {job.attributes?.updatedBy || '—'}
                    </p>
                  </div>
                  {job.attributes?.primeUrl && (
                    <a href={String(job.attributes.primeUrl)} target="_blank" rel="noopener noreferrer"
                      className="ml-3 text-gray-500 hover:text-red-400 flex-shrink-0">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              ))}
              {recentJobs.length === 0 && (
                <p className="text-gray-500 text-sm py-8 text-center">No recent activity</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
