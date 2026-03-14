'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate, daysSince } from '@/lib/prime-helpers';
import type { PrimeJob } from '@/lib/prime-helpers';
import { ExternalLink, Download } from 'lucide-react';

interface BottleneckData {
  days: number;
  totalStuck: number;
  byStatus: Record<string, PrimeJob[]>;
}

const DAY_OPTIONS = [7, 14, 30, 60, 90];

function exportToCSV(data: BottleneckData) {
  const headers = [
    'Status', 'Job Number', 'Address', 'Client Reference', 'Description',
    'Job Type', 'Region', 'Authorised Total', 'Created Date', 'Created By',
    'Days Since Update', 'Last Updated By', 'Prime URL'
  ];

  const rows: string[][] = [];
  for (const [status, jobs] of Object.entries(data.byStatus)) {
    for (const job of jobs) {
      rows.push([
        status,
        job.attributes?.jobNumber || '',
        job.attributes?.address || '',
        job.attributes?.clientReference || '',
        job.attributes?.description || '',
        job.attributes?.jobType || '',
        job.attributes?.region || '',
        String(job.attributes?.authorisedTotalIncludingTax || 0),
        formatDate(job.attributes?.createdAt),
        job.attributes?.createdBy || '',
        String(daysSince(job.attributes?.updatedAt)),
        job.attributes?.updatedBy || '',
        (job.attributes?.primeUrl as string) || '',
      ]);
    }
  }

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bottlenecks-${data.days}days-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BottlenecksPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<BottleneckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/prime/jobs/bottlenecks?days=${days}`);
        if (!res.ok) throw new Error('Failed to load bottlenecks');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [days]);

  return (
    <div>
      <PageHeader
        title="Bottlenecks"
        subtitle="Open jobs stuck without updates"
        actions={
          data && (
            <button
              onClick={() => exportToCSV(data)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <Download size={14} />
              Export CSV
            </button>
          )
        }
      />

      {/* Days filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              days === d
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            &gt;{d} days
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner message="Loading bottleneck data..." />}
      {error && <ErrorMessage message={error} />}

      {data && !loading && (
        <>
          <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 px-5 py-4">
            <span className="text-gray-400 text-sm">
              Found{' '}
              <span className="text-red-400 font-bold text-lg">{data.totalStuck}</span>
              {' '}jobs stuck for more than {data.days} days
            </span>
          </div>

          {Object.entries(data.byStatus).length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No jobs stuck for more than {data.days} days — great job! 🎉
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(data.byStatus)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([status, jobs]) => (
                  <div key={status} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold text-white">{status}</h2>
                      <span className="bg-red-900/40 text-red-400 text-xs px-2 py-1 rounded-full font-medium">
                        {jobs.length} job{jobs.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-800">
                            <th className="text-left py-2 px-2 text-gray-400 whitespace-nowrap">Job #</th>
                            <th className="text-left py-2 px-2 text-gray-400">Address</th>
                            <th className="text-left py-2 px-2 text-gray-400 whitespace-nowrap">Client Ref</th>
                            <th className="text-left py-2 px-2 text-gray-400">Type</th>
                            <th className="text-left py-2 px-2 text-gray-400">Region</th>
                            <th className="text-right py-2 px-2 text-gray-400 whitespace-nowrap">Auth. Total</th>
                            <th className="text-left py-2 px-2 text-gray-400 whitespace-nowrap">Created</th>
                            <th className="text-right py-2 px-2 text-gray-400 whitespace-nowrap">Days Stuck</th>
                            <th className="text-left py-2 px-2 text-gray-400 whitespace-nowrap">Updated By</th>
                            <th className="py-2 px-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobs.map((job) => {
                            const stuck = daysSince(job.attributes?.updatedAt);
                            return (
                              <tr key={job.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                <td className="py-2.5 px-2 font-mono text-red-400 text-xs whitespace-nowrap">
                                  {job.attributes?.jobNumber || job.id}
                                </td>
                                <td className="py-2.5 px-2 text-gray-300 max-w-[200px] truncate">
                                  {job.attributes?.address || '—'}
                                </td>
                                <td className="py-2.5 px-2 text-gray-400 text-xs whitespace-nowrap">
                                  {job.attributes?.clientReference || '—'}
                                </td>
                                <td className="py-2.5 px-2 text-gray-400 text-xs whitespace-nowrap">
                                  {job.attributes?.jobType || '—'}
                                </td>
                                <td className="py-2.5 px-2 text-gray-400 text-xs whitespace-nowrap">
                                  {job.attributes?.region || '—'}
                                </td>
                                <td className="py-2.5 px-2 text-right text-gray-300 text-xs whitespace-nowrap">
                                  {formatCurrency(job.attributes?.authorisedTotalIncludingTax)}
                                </td>
                                <td className="py-2.5 px-2 text-gray-400 text-xs whitespace-nowrap">
                                  <div>{formatDate(job.attributes?.createdAt)}</div>
                                  <div className="text-gray-600">{job.attributes?.createdBy || '—'}</div>
                                </td>
                                <td className={`py-2.5 px-2 text-right font-bold text-xs whitespace-nowrap ${
                                  stuck > 30 ? 'text-red-500' : stuck > 14 ? 'text-yellow-500' : 'text-orange-400'
                                }`}>
                                  {stuck}d
                                </td>
                                <td className="py-2.5 px-2 text-gray-400 text-xs whitespace-nowrap">
                                  {job.attributes?.updatedBy || '—'}
                                </td>
                                <td className="py-2.5 px-2">
                                  {job.attributes?.primeUrl && (
                                    <a
                                      href={job.attributes.primeUrl as string}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-600 hover:text-red-400"
                                    >
                                      <ExternalLink size={13} />
                                    </a>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
