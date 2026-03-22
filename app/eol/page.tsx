'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import { Droplets, ExternalLink, TrendingUp, Clock, BarChart2, MapPin } from 'lucide-react';

interface EolJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  assignee: string;
  region: string;
  daysOpen: number;
  createdAt: string;
  perilName: string;
  matchedOn: string;
  primeUrl: string;
}

interface EolStats {
  total: number;
  totalOpen: number;
  completedThisMonth: number;
  avgDaysOpen: number;
  percentOfPortfolio: number;
  byRegion: Record<string, number>;
}

interface EolResponse {
  stats: EolStats;
  openJobs: EolJob[];
  generatedAt: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-6 flex flex-col gap-2 ${accent ? 'bg-blue-950/30 border-blue-700/50' : 'bg-gray-900 border-gray-800'}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium uppercase tracking-wide ${accent ? 'text-blue-300' : 'text-gray-400'}`}>{label}</span>
        <Icon size={16} className={accent ? 'text-blue-400' : 'text-gray-600'} />
      </div>
      <p className={`text-4xl font-bold tabular-nums ${accent ? 'text-blue-300' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function matchedOnBadge(matchedOn: string) {
  if (matchedOn === 'peril') return <span className="text-xs bg-blue-900/40 border border-blue-700/40 text-blue-300 px-2 py-0.5 rounded-full">peril</span>;
  if (matchedOn === 'description') return <span className="text-xs bg-purple-900/40 border border-purple-700/40 text-purple-300 px-2 py-0.5 rounded-full">description</span>;
  return <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">notes</span>;
}

export default function EolPage() {
  const [data, setData] = useState<EolResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/prime/jobs/eol')
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? 'Failed')))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading EOL portfolio…" />;
  if (error)   return <ErrorMessage message={error} />;
  if (!data)   return null;

  const { stats, openJobs } = data;
  const byRegionSorted = Object.entries(stats.byRegion).sort(([, a], [, b]) => b - a);

  return (
    <div>
      {/* Tagline header */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <Droplets size={20} className="text-blue-400" />
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Suncorp&apos;s #1 risk reduction priority</span>
        </div>
      </div>

      <PageHeader
        title="Escape of Liquid Portfolio"
        subtitle="SHBR's Flexi Hose & Escape of Liquid Portfolio — Suncorp's #1 risk reduction priority"
      />

      {/* Hero stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total EOL Jobs"
          value={stats.total}
          icon={Droplets}
          sub="Open + completed this month"
          accent
        />
        <StatCard
          label="Active Open"
          value={stats.totalOpen}
          icon={TrendingUp}
          sub="Currently in progress"
        />
        <StatCard
          label="% of Portfolio"
          value={`${stats.percentOfPortfolio}%`}
          icon={BarChart2}
          sub="Of all open jobs"
        />
        <StatCard
          label="Avg Days Open"
          value={stats.avgDaysOpen}
          icon={Clock}
          sub="Average age of open EOL jobs"
        />
      </div>

      {/* By Region breakdown */}
      {byRegionSorted.length > 0 && (
        <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-blue-400" />
            <h2 className="text-sm font-semibold text-white">EOL Jobs by Region</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {byRegionSorted.map(([region, count]) => (
              <div key={region} className="bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-gray-400 truncate">{region}</span>
                <span className="text-sm font-bold text-blue-300 ml-2 flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed this month */}
      {stats.completedThisMonth > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-emerald-950/20 border border-emerald-700/40 rounded-xl px-5 py-3">
          <span className="text-emerald-400">✓</span>
          <p className="text-emerald-300 text-sm font-medium">
            {stats.completedThisMonth} EOL job{stats.completedThisMonth !== 1 ? 's' : ''} completed this month
          </p>
        </div>
      )}

      {/* Open EOL jobs table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
          <Droplets size={16} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Open EOL Jobs</h2>
          <span className="text-xs text-gray-500">— {openJobs.length} job{openJobs.length !== 1 ? 's' : ''}, sorted by age</span>
        </div>

        {openJobs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">💧</div>
            <p className="text-gray-300 font-medium">No open EOL jobs found</p>
            <p className="text-gray-500 text-sm mt-1">No matching escape of liquid jobs in the current open portfolio</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Job #</th>
                  <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Address</th>
                  <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Status</th>
                  <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Assignee</th>
                  <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Region</th>
                  <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Days Open</th>
                  <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium hidden md:table-cell">Matched On</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {openJobs.map(job => (
                  <tr
                    key={job.id}
                    className={`border-b border-gray-800 hover:bg-gray-800/40 transition-colors ${
                      job.daysOpen > 30 ? 'bg-amber-950/5' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                      {job.primeUrl ? (
                        <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                          {job.jobNumber}
                        </a>
                      ) : <span className="text-gray-300">{job.jobNumber}</span>}
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-xs max-w-[160px] truncate">{job.address}</td>
                    <td className="py-2 px-3 text-xs text-gray-400 max-w-[120px] truncate">{job.status}</td>
                    <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">{job.assignee}</td>
                    <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap hidden sm:table-cell">{job.region}</td>
                    <td className="py-2 px-3 text-xs font-mono font-bold whitespace-nowrap">
                      <span className={job.daysOpen > 30 ? 'text-amber-400' : job.daysOpen > 14 ? 'text-yellow-400' : 'text-gray-300'}>
                        {job.daysOpen}d
                      </span>
                    </td>
                    <td className="py-2 px-3 hidden md:table-cell">{matchedOnBadge(job.matchedOn)}</td>
                    <td className="py-2 px-3">
                      {job.primeUrl && (
                        <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-400">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.generatedAt && (
        <p className="text-xs text-gray-600 mt-4">Data generated: {new Date(data.generatedAt).toLocaleString('en-AU')}</p>
      )}
    </div>
  );
}
