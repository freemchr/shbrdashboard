'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/prime-helpers';
import { ExternalLink, Clock } from 'lucide-react';

// Shape returned by /api/prime/jobs/aging
interface AgingData {
  buckets: {
    over30: number;
    over60: number;
    over90: number;
  };
  jobs: FlatJob[];
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
  updatedAt: string;
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
        if (!res.ok) throw new Error(`Aging API error: ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
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

  const filteredJobs = data.jobs.filter(j => j.daysOpen > threshold);

  const columns: Column<FlatJob>[] = [
    {
      key: 'jobNumber', label: 'Job #', sortable: true, render: (j) => (
        j.primeUrl
          ? <a href={j.primeUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-red-400 text-xs hover:text-red-300 underline underline-offset-2">{j.jobNumber}</a>
          : <span className="font-mono text-red-400 text-xs">{j.jobNumber}</span>
      )
    },
    { key: 'address', label: 'Address', sortable: true, render: (j) => <span className="text-xs">{j.address}</span> },
    { key: 'region', label: 'Region', sortable: true, render: (j) => <span className="text-xs text-gray-400">{j.region}</span> },
    { key: 'jobType', label: 'Type', sortable: true, render: (j) => <span className="text-xs">{j.jobType}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (j) => <span className="text-xs">{j.status}</span> },
    {
      key: 'daysOpen',
      label: 'Days Open',
      sortable: true,
      render: (j) => (
        <span className={`font-bold font-mono text-sm ${
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
      render: (j) => <span className="text-xs">{formatCurrency(j.authorisedTotal)}</span>,
    },
    {
      key: 'updatedAt',
      label: 'Last Updated',
      sortable: true,
      render: (j) => <span className="text-xs text-gray-500">{formatDate(j.updatedAt)}</span>,
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
      <PageHeader title="Aging Jobs" subtitle="Open jobs by how long they've been open" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard
          title=">30 Days Open"
          value={data.buckets.over30}
          icon={<Clock size={18} />}
          subtitle="Needs attention"
        />
        <KpiCard
          title=">60 Days Open"
          value={data.buckets.over60}
          icon={<Clock size={18} />}
          accent={data.buckets.over60 > 0}
          subtitle="Overdue"
        />
        <KpiCard
          title=">90 Days Open"
          value={data.buckets.over90}
          icon={<Clock size={18} />}
          accent={data.buckets.over90 > 0}
          subtitle="Critical"
        />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-white">
            Jobs Older Than {threshold} Days ({filteredJobs.length})
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
          data={filteredJobs}
          keyFn={(item) => item.id}
          pageSize={25}
          emptyMessage={`No open jobs older than ${threshold} days.`}
          exportFilename={`aging-over${threshold}days-${new Date().toISOString().split('T')[0]}.csv`}
        />
      </div>
    </div>
  );
}
