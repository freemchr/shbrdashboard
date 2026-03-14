'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate, daysSince } from '@/lib/prime-helpers';
import type { PrimeJob } from '@/lib/prime-helpers';
import { ExternalLink, Clock } from 'lucide-react';

interface AgingBucket {
  count: number;
  jobs: PrimeJob[];
}

interface AgingData {
  buckets: {
    over30: AgingBucket;
    over60: AgingBucket;
    over90: AgingBucket;
  };
}

interface FlatJob {
  id: string;
  jobNumber: string;
  address: string;
  region: string;
  jobType: string;
  status: string;
  daysOpen: number;
  authorisedTotal: number;
  createdAt: string;
  primeUrl: string;
}

const THRESHOLD_OPTIONS = [30, 60, 90];

export default function AgingPage() {
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(30);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/prime/jobs/aging');
        if (!res.ok) throw new Error('Failed to load aging data');
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading aging data..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const getBucketJobs = (): PrimeJob[] => {
    if (threshold === 90) return data.buckets.over90.jobs;
    if (threshold === 60) return [...data.buckets.over60.jobs, ...data.buckets.over90.jobs];
    return [...data.buckets.over30.jobs, ...data.buckets.over60.jobs, ...data.buckets.over90.jobs];
  };

  const activeJobs = getBucketJobs();

  const flatJobs: FlatJob[] = activeJobs.map((j) => ({
    id: j.id,
    jobNumber: j.attributes?.jobNumber || j.id,
    address: j.attributes?.address || '—',
    region: j.attributes?.region || '—',
    jobType: j.attributes?.jobType || '—',
    status: j.attributes?.statusName || j.attributes?.status || '—',
    daysOpen: daysSince(j.attributes?.createdAt),
    authorisedTotal: j.attributes?.authorisedTotalIncludingTax || 0,
    createdAt: j.attributes?.createdAt || '',
    primeUrl: (j.attributes?.primeUrl as string) || '',
  }));

  flatJobs.sort((a, b) => a.daysOpen - b.daysOpen);

  const columns: Column<FlatJob>[] = [
    { key: 'jobNumber', label: 'Job #', sortable: true, render: (j) => (
      <span className="font-mono text-red-400 text-xs">{j.jobNumber}</span>
    )},
    { key: 'address', label: 'Address', sortable: true },
    { key: 'region', label: 'Region', sortable: true },
    { key: 'jobType', label: 'Type', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    {
      key: 'daysOpen',
      label: 'Days Open',
      sortable: true,
      render: (j) => (
        <span className={`font-bold font-mono ${
          j.daysOpen > 90 ? 'text-red-500' : j.daysOpen > 60 ? 'text-orange-400' : 'text-yellow-400'
        }`}>
          {j.daysOpen}d
        </span>
      ),
    },
    {
      key: 'authorisedTotal',
      label: 'Auth. Total',
      sortable: true,
      render: (j) => formatCurrency(j.authorisedTotal),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (j) => formatDate(j.createdAt),
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
      <PageHeader title="Aging Jobs" subtitle="Open jobs by age threshold" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard
          title=">30 Days Open"
          value={data.buckets.over30.count}
          icon={<Clock size={18} />}
          subtitle="Needs attention"
        />
        <KpiCard
          title=">60 Days Open"
          value={data.buckets.over60.count}
          icon={<Clock size={18} />}
          accent={data.buckets.over60.count > 0}
          subtitle="Overdue"
        />
        <KpiCard
          title=">90 Days Open"
          value={data.buckets.over90.count}
          icon={<Clock size={18} />}
          accent={data.buckets.over90.count > 0}
          subtitle="Critical"
        />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-white">
            Jobs Older Than Threshold ({activeJobs.length})
          </h2>
          <div className="flex gap-2">
            {THRESHOLD_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setThreshold(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  threshold === t
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                &gt;{t}d
              </button>
            ))}
          </div>
        </div>
        <DataTable
          columns={columns}
          data={flatJobs}
          keyFn={(item) => item.id}
          pageSize={25}
          emptyMessage={`No open jobs older than ${threshold} days.`}
        />
      </div>
    </div>
  );
}
