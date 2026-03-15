'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { BarChartComponent } from '@/components/charts/BarChartComponent';
import { DataTable, Column } from '@/components/ui/DataTable';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/prime-helpers';
import type { PrimeJob } from '@/lib/prime-helpers';
import { ExternalLink } from 'lucide-react';

interface StatusCount {
  status: string;
  count: number;
  statusType: string;
}

interface WeekData {
  week: string;
  label: string;
  count: number;
}

interface FlatJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  region: string;
  jobType: string;
  authorisedTotal: number;
  updatedAt: string;
  primeUrl: string;
}

export default function PipelinePage() {
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([]);
  const [jobs, setJobs] = useState<FlatJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [regionFilter, setRegionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [countsRes, pipelineRes, jobsRes] = await Promise.all([
          fetch('/api/prime/jobs/counts-by-status'),
          fetch('/api/prime/jobs/pipeline'),
          fetch('/api/prime/jobs?per_page=100'),
        ]);

        const [countsData, pipelineData, jobsData] = await Promise.all([
          countsRes.json(),
          pipelineRes.json(),
          jobsRes.json(),
        ]);

        setCounts(countsData);
        setWeeklyData(pipelineData);

        const rawJobs: PrimeJob[] = jobsData.data || [];
        const openJobs = rawJobs
          .filter((j) => {
            const st = (j.attributes?.statusType || '').toLowerCase();
            return st === 'open' || st === 'active';
          })
          .map((j) => ({
            id: j.id,
            jobNumber: j.attributes?.jobNumber || j.id,
            address: typeof j.attributes?.address === 'object' && j.attributes?.address ? [j.attributes.address.addressLine1, j.attributes.address.suburb, j.attributes.address.state].filter(Boolean).join(', ') || '—' : String(j.attributes?.address || '—'),
            status: j.attributes?.statusName || j.attributes?.status || '—',
            region: j.attributes?.region || '—',
            jobType: j.attributes?.jobType || '—',
            authorisedTotal: j.attributes?.authorisedTotalIncludingTax || 0,
            updatedAt: j.attributes?.updatedAt || '',
            primeUrl: (j.attributes?.primeUrl as string) || '',
          }));
        setJobs(openJobs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading pipeline data..." />;
  if (error) return <ErrorMessage message={error} />;

  const openCounts = counts.filter((c) => {
    const st = c.statusType?.toLowerCase();
    return st === 'open' || st === 'active';
  });
  const closedCounts = counts.filter((c) => {
    const st = c.statusType?.toLowerCase();
    return st !== 'open' && st !== 'active';
  });

  const regions = Array.from(new Set(jobs.map((j) => j.region).filter((r) => r && r !== '—')));
  const types = Array.from(new Set(jobs.map((j) => j.jobType).filter((t) => t && t !== '—')));
  const statuses = Array.from(new Set(jobs.map((j) => j.status).filter((s) => s && s !== '—')));

  const filteredJobs = jobs.filter((j) => {
    if (regionFilter && j.region !== regionFilter) return false;
    if (typeFilter && j.jobType !== typeFilter) return false;
    if (statusFilter && j.status !== statusFilter) return false;
    return true;
  });

  const columns: Column<FlatJob>[] = [
    { key: 'jobNumber', label: 'Job #', sortable: true },
    { key: 'address', label: 'Address', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'region', label: 'Region', sortable: true },
    { key: 'jobType', label: 'Type', sortable: true },
    {
      key: 'authorisedTotal',
      label: 'Auth. Total',
      sortable: true,
      render: (j) => formatCurrency(j.authorisedTotal),
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      render: (j) => formatDate(j.updatedAt),
    },
    {
      key: 'primeUrl',
      label: '',
      render: (j) =>
        j.primeUrl ? (
          <a href={j.primeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-red-400">
            <ExternalLink size={14} />
          </a>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="Pipeline" subtitle="Job flow and status distribution" />

      {/* Status tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-base font-semibold text-white mb-3">Open Statuses</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-3 text-gray-400">Status</th>
                  <th className="text-right py-2 px-3 text-gray-400">Count</th>
                </tr>
              </thead>
              <tbody>
                {openCounts.map((c) => (
                  <tr key={c.status} className="border-b border-gray-800/50">
                    <td className="py-2 px-3 text-gray-300">{c.status}</td>
                    <td className="py-2 px-3 text-right text-red-400 font-mono">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-base font-semibold text-white mb-3">Closed Statuses</h2>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-3 text-gray-400">Status</th>
                  <th className="text-right py-2 px-3 text-gray-400">Count</th>
                </tr>
              </thead>
              <tbody>
                {closedCounts.map((c) => (
                  <tr key={c.status} className="border-b border-gray-800/50">
                    <td className="py-2 px-3 text-gray-400">{c.status}</td>
                    <td className="py-2 px-3 text-right text-gray-500 font-mono">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Weekly chart */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-8">
        <h2 className="text-base font-semibold text-white mb-4">Jobs Created per Week (Last 12 Weeks)</h2>
        <BarChartComponent
          data={weeklyData.map((w) => ({ name: w.label, value: w.count }))}
          height={250}
          color="#DC2626"
        />
      </div>

      {/* Open jobs table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-white">All Open Jobs ({filteredJobs.length})</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-red-500"
            >
              <option value="">All Regions</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-red-500"
            >
              <option value="">All Types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-red-500"
            >
              <option value="">All Statuses</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={filteredJobs}
          keyFn={(item) => item.id}
          pageSize={25}
        />
      </div>
    </div>
  );
}
