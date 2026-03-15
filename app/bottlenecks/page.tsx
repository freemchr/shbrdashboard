'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/prime-helpers';
import { ExternalLink, Download } from 'lucide-react';

interface FlatJob {
  id: string;
  jobNumber?: string;
  address?: string;
  clientReference?: string;
  description?: string;
  jobType?: string;
  region?: string;
  authorisedTotal?: number;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  daysSince?: number;
  primeUrl?: string;
}

interface StatusGroup { status: string; count: number; jobs: FlatJob[]; }
interface BottleneckData { days: number; totalStuck: number; groups: StatusGroup[]; }

const DAY_OPTIONS = [7, 14, 30, 60, 90];

function exportToCSV(data: BottleneckData) {
  const headers = ['Status','Job #','Address','Client Ref','Description','Type','Region','Auth. Total','Created','Created By','Days Stuck','Updated By','Prime URL'];
  const rows: string[][] = [];
  for (const group of data.groups) {
    for (const j of group.jobs) {
      rows.push([
        group.status, j.jobNumber||'', j.address||'', j.clientReference||'', j.description||'',
        j.jobType||'', j.region||'', String(j.authorisedTotal||0),
        formatDate(j.createdAt), j.createdBy||'', String(j.daysSince||0), j.updatedBy||'', j.primeUrl||'',
      ]);
    }
  }
  const csv = [headers,...rows].map(r=>r.map(c=>`"${c.replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `bottlenecks-${data.days}days-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

export default function BottlenecksPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<BottleneckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/prime/jobs/bottlenecks?days=${days}`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load bottlenecks'))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div>
      <PageHeader
        title="Bottlenecks"
        subtitle="Open jobs stuck without updates"
        actions={data && (
          <button onClick={() => exportToCSV(data)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors">
            <Download size={14} /> Export CSV
          </button>
        )}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {DAY_OPTIONS.map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${days===d?'bg-red-600 text-white':'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
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
              Found <span className="text-red-400 font-bold text-lg">{data.totalStuck}</span> open jobs stuck &gt;{data.days} days
            </span>
          </div>

          {data.groups.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No stuck jobs — great work! 🎉</div>
          ) : (
            <div className="space-y-6">
              {data.groups.map(group => (
                <div key={group.status} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-white">{group.status}</h2>
                    <span className="bg-red-900/40 text-red-400 text-xs px-2 py-1 rounded-full font-medium">
                      {group.count} job{group.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          {['Job #','Address','Client Ref','Type','Region','Auth. Total','Created','Days Stuck','Updated By',''].map(h=>(
                            <th key={h} className={`py-2 px-2 text-gray-400 whitespace-nowrap ${h==='Auth. Total'||h==='Days Stuck'?'text-right':'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.jobs.map(job => (
                          <tr key={job.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="py-2.5 px-2 font-mono text-red-400 text-xs whitespace-nowrap">{job.jobNumber||job.id}</td>
                            <td className="py-2.5 px-2 text-gray-300 max-w-[180px] truncate">{job.address||'—'}</td>
                            <td className="py-2.5 px-2 text-gray-400 text-xs">{job.clientReference||'—'}</td>
                            <td className="py-2.5 px-2 text-gray-400 text-xs whitespace-nowrap">{job.jobType||'—'}</td>
                            <td className="py-2.5 px-2 text-gray-400 text-xs whitespace-nowrap">{job.region||'—'}</td>
                            <td className="py-2.5 px-2 text-right text-gray-300 text-xs whitespace-nowrap">{formatCurrency(job.authorisedTotal)}</td>
                            <td className="py-2.5 px-2 text-gray-400 text-xs whitespace-nowrap">
                              <div>{formatDate(job.createdAt)}</div>
                              <div className="text-gray-600">{job.createdBy||'—'}</div>
                            </td>
                            <td className={`py-2.5 px-2 text-right font-bold text-xs whitespace-nowrap ${(job.daysSince||0)>30?'text-red-500':(job.daysSince||0)>14?'text-yellow-500':'text-orange-400'}`}>
                              {job.daysSince}d
                            </td>
                            <td className="py-2.5 px-2 text-gray-400 text-xs whitespace-nowrap">{job.updatedBy||'—'}</td>
                            <td className="py-2.5 px-2">
                              {job.primeUrl && (
                                <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-red-400">
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
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
