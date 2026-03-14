'use client';

import { useEffect, useState } from 'react';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { BarChartComponent } from '@/components/charts/BarChartComponent';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate, daysSince } from '@/lib/prime-helpers';
import type { PrimeJob } from '@/lib/prime-helpers';
import { ExternalLink, Briefcase, AlertTriangle, DollarSign, Calendar } from 'lucide-react';

interface OverviewData {
  openJobs: PrimeJob[];
  countsByStatus: { status: string; count: number; statusType: string }[];
  recentJobs: PrimeJob[];
  kpis: {
    totalOpen: number;
    stuckOver7Days: number;
    pipelineValue: number;
    createdThisWeek: number;
    createdThisMonth: number;
  };
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Fetch jobs and counts in parallel
        const [jobsRes, countsRes] = await Promise.all([
          fetch('/api/prime/jobs?per_page=100&order=updatedAt&sort=desc'),
          fetch('/api/prime/jobs/counts-by-status'),
        ]);

        if (!jobsRes.ok) throw new Error('Failed to load jobs');
        const jobsData = await jobsRes.json();
        const countsByStatus = countsRes.ok ? await countsRes.json() : [];

        const allJobs: PrimeJob[] = jobsData.data || [];

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());

        const openJobs = allJobs.filter((j) => {
          const st = (j.attributes?.statusType || '').toLowerCase();
          return st === 'open' || st === 'active';
        });

        const stuckOver7Days = openJobs.filter((j) => daysSince(j.attributes?.updatedAt) >= 7).length;
        const pipelineValue = openJobs.reduce((sum, j) => sum + (j.attributes?.authorisedTotalIncludingTax || 0), 0);
        const createdThisWeek = allJobs.filter((j) => j.attributes?.createdAt && new Date(j.attributes.createdAt) >= weekStart).length;
        const createdThisMonth = allJobs.filter((j) => j.attributes?.createdAt && new Date(j.attributes.createdAt) >= monthStart).length;

        const recentJobs = [...allJobs].sort((a, b) => {
          const aDate = new Date(a.attributes?.updatedAt || 0).getTime();
          const bDate = new Date(b.attributes?.updatedAt || 0).getTime();
          return bDate - aDate;
        }).slice(0, 10);

        setData({
          openJobs,
          countsByStatus,
          recentJobs,
          kpis: {
            totalOpen: openJobs.length,
            stuckOver7Days,
            pipelineValue,
            createdThisWeek,
            createdThisMonth,
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading overview data..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const chartData = data.countsByStatus
    .filter((s) => {
      const st = s.statusType?.toLowerCase();
      return st === 'open' || st === 'active';
    })
    .slice(0, 10)
    .map((s) => ({ name: s.status, value: s.count }));

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Real-time snapshot of SHBR operations"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <KpiCard
          title="Total Open Jobs"
          value={data.kpis.totalOpen}
          icon={<Briefcase size={18} />}
        />
        <KpiCard
          title="Stuck >7 Days"
          value={data.kpis.stuckOver7Days}
          icon={<AlertTriangle size={18} />}
          accent={data.kpis.stuckOver7Days > 0}
        />
        <KpiCard
          title="Pipeline Value"
          value={formatCurrency(data.kpis.pipelineValue)}
          icon={<DollarSign size={18} />}
        />
        <KpiCard
          title="Created This Week"
          value={data.kpis.createdThisWeek}
          icon={<Calendar size={18} />}
        />
        <KpiCard
          title="Created This Month"
          value={data.kpis.createdThisMonth}
          icon={<Calendar size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* Open Jobs by Status Chart */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Open Jobs by Status (Top 10)</h2>
          {chartData.length > 0 ? (
            <BarChartComponent data={chartData} height={300} />
          ) : (
            <p className="text-gray-500 text-sm py-8 text-center">No status data available</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity (Last 10)</h2>
          <div className="space-y-2">
            {data.recentJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg text-sm hover:bg-gray-800 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-red-400 text-xs">
                      {job.attributes?.jobNumber || job.id}
                    </span>
                    <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                      {job.attributes?.statusName || job.attributes?.status || '—'}
                    </span>
                  </div>
                  <p className="text-gray-300 truncate mt-0.5">
                    {job.attributes?.address || job.attributes?.description || '—'}
                  </p>
                  <p className="text-gray-600 text-xs mt-0.5">
                    Updated {formatDate(job.attributes?.updatedAt)} by {job.attributes?.updatedBy || '—'}
                  </p>
                </div>
                {job.attributes?.primeUrl && (
                  <a
                    href={job.attributes.primeUrl as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-3 text-gray-500 hover:text-red-400 flex-shrink-0"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
            {data.recentJobs.length === 0 && (
              <p className="text-gray-500 text-sm py-8 text-center">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
