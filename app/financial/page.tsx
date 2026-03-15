'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/prime-helpers';
import { ExternalLink, DollarSign, AlertTriangle, Briefcase, TrendingUp } from 'lucide-react';

interface FinancialSummary {
  totalJobs: number;
  totalAuthIncTax: number;
  totalAuthExTax: number;
  zeroDollarCount: number;
  invoicingCount: number;
  byRegion: { region: string; count: number; total: number }[];
  byStatus: { status: string; count: number; total: number }[];
  byJobType: { jobType: string; count: number; total: number }[];
  invoicingJobs: {
    id: string; jobNumber: string; address: string; status: string;
    region: string; jobType: string; authorisedTotal: number; updatedAt: string; primeUrl: string;
  }[];
  zeroDollarJobs: {
    id: string; jobNumber: string; address: string; status: string;
    region: string; jobType: string; createdAt: string; updatedAt: string; primeUrl: string;
  }[];
}

function JobLink({ jobNumber, primeUrl }: { jobNumber: string; primeUrl: string }) {
  return primeUrl ? (
    <a href={primeUrl} target="_blank" rel="noopener noreferrer"
      className="font-mono text-red-400 text-xs hover:text-red-300 underline underline-offset-2">
      {jobNumber}
    </a>
  ) : <span className="font-mono text-red-400 text-xs">{jobNumber}</span>;
}

export default function FinancialPage() {
  const [data, setData] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllZero, setShowAllZero] = useState(false);

  useEffect(() => {
    fetch('/api/prime/financial')
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error || 'Failed')))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading financial data…" />;
  if (error)   return <ErrorMessage message={error} />;
  if (!data)   return null;

  const pctWithValue = data.totalJobs > 0
    ? Math.round(((data.totalJobs - data.zeroDollarCount) / data.totalJobs) * 100)
    : 0;

  const zeroShown = showAllZero ? data.zeroDollarJobs : data.zeroDollarJobs.slice(0, 25);

  return (
    <div>
      <PageHeader title="Financial" subtitle="Authorised value pipeline across all 670 open jobs" />

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="Total Auth. Value (inc. GST)"
          value={formatCurrency(data.totalAuthIncTax)}
          icon={<DollarSign size={18} />}
          subtitle="All open jobs"
        />
        <KpiCard
          title="Total Auth. Value (ex. GST)"
          value={formatCurrency(data.totalAuthExTax)}
          icon={<TrendingUp size={18} />}
          subtitle="All open jobs"
        />
        <KpiCard
          title="$0 Authorised"
          value={`${data.zeroDollarCount} jobs`}
          icon={<AlertTriangle size={18} />}
          accent={data.zeroDollarCount > 0}
          subtitle={`${100 - pctWithValue}% of open jobs`}
        />
        <KpiCard
          title="Ready to Invoice"
          value={data.invoicingCount}
          icon={<Briefcase size={18} />}
          subtitle="In invoicing pipeline"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">

        {/* By Region */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-base font-semibold text-white mb-4">Auth. Value by Region</h2>
          <div className="space-y-2">
            {data.byRegion.map(r => {
              const pct = data.totalAuthIncTax > 0 ? (r.total / data.totalAuthIncTax) * 100 : 0;
              return (
                <div key={r.region}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300 truncate max-w-[140px]">{r.region}</span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-gray-500">{r.count} jobs</span>
                      <span className="text-white font-mono font-medium">{formatCurrency(r.total)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full">
                    <div className="h-full bg-red-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Job Type */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-base font-semibold text-white mb-4">Auth. Value by Job Type</h2>
          <div className="space-y-2">
            {data.byJobType.map(t => {
              const pct = data.totalAuthIncTax > 0 ? (t.total / data.totalAuthIncTax) * 100 : 0;
              return (
                <div key={t.jobType}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300 truncate max-w-[140px]">{t.jobType}</span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-gray-500">{t.count} jobs</span>
                      <span className="text-white font-mono font-medium">{formatCurrency(t.total)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Status (top 12) */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-base font-semibold text-white mb-4">Auth. Value by Status (top 12)</h2>
          <div className="space-y-2">
            {data.byStatus.slice(0, 12).map(s => {
              const pct = data.totalAuthIncTax > 0 ? (s.total / data.totalAuthIncTax) * 100 : 0;
              return (
                <div key={s.status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300 truncate max-w-[140px]">{s.status}</span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-gray-500">{s.count} jobs</span>
                      <span className="text-white font-mono font-medium">{formatCurrency(s.total)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Invoicing pipeline */}
      {data.invoicingJobs.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
          <h2 className="text-base font-semibold text-white mb-4">
            Ready to Invoice ({data.invoicingJobs.length} jobs)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pr-4 font-medium">Job #</th>
                  <th className="text-left py-2 pr-4 font-medium">Address</th>
                  <th className="text-left py-2 pr-4 font-medium hidden sm:table-cell">Status</th>
                  <th className="text-left py-2 pr-4 font-medium hidden md:table-cell">Region</th>
                  <th className="text-left py-2 pr-4 font-medium hidden md:table-cell">Type</th>
                  <th className="text-left py-2 pr-4 font-medium">Auth. Total</th>
                  <th className="text-left py-2 pr-4 font-medium hidden sm:table-cell">Updated</th>
                  <th className="text-left py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {data.invoicingJobs.map(j => (
                  <tr key={j.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2 pr-4"><JobLink jobNumber={j.jobNumber} primeUrl={j.primeUrl} /></td>
                    <td className="py-2 pr-4 text-gray-300 text-xs max-w-[140px] truncate">{j.address}</td>
                    <td className="py-2 pr-4 text-xs text-gray-400 hidden sm:table-cell">{j.status}</td>
                    <td className="py-2 pr-4 text-xs text-gray-500 hidden md:table-cell">{j.region}</td>
                    <td className="py-2 pr-4 text-xs text-gray-500 hidden md:table-cell">{j.jobType}</td>
                    <td className="py-2 pr-4 text-xs font-mono text-green-400">{formatCurrency(j.authorisedTotal)}</td>
                    <td className="py-2 pr-4 text-xs text-gray-500 hidden sm:table-cell">{formatDate(j.updatedAt)}</td>
                    <td className="py-2">
                      {j.primeUrl && <a href={j.primeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-red-400"><ExternalLink size={14} /></a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* $0 authorised jobs */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Open Jobs with $0 Authorised ({data.zeroDollarCount})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">These jobs have no authorised value yet — may need attention</p>
          </div>
          {data.zeroDollarJobs.length > 25 && (
            <button
              onClick={() => setShowAllZero(v => !v)}
              className="text-xs bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              {showAllZero ? 'Show fewer' : `Show all ${data.zeroDollarCount}`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-4 font-medium">Job #</th>
                <th className="text-left py-2 pr-4 font-medium">Address</th>
                <th className="text-left py-2 pr-4 font-medium hidden sm:table-cell">Status</th>
                <th className="text-left py-2 pr-4 font-medium hidden md:table-cell">Region</th>
                <th className="text-left py-2 pr-4 font-medium hidden md:table-cell">Type</th>
                <th className="text-left py-2 pr-4 font-medium hidden sm:table-cell">Created</th>
                <th className="text-left py-2 pr-4 font-medium hidden lg:table-cell">Updated</th>
                <th className="text-left py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {zeroShown.map(j => (
                <tr key={j.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 pr-4"><JobLink jobNumber={j.jobNumber} primeUrl={j.primeUrl} /></td>
                  <td className="py-2 pr-4 text-gray-300 text-xs max-w-[140px] truncate">{j.address}</td>
                  <td className="py-2 pr-4 text-xs text-gray-400 max-w-[120px] truncate hidden sm:table-cell">{j.status}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500 hidden md:table-cell">{j.region}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500 hidden md:table-cell">{j.jobType}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500 hidden sm:table-cell">{formatDate(j.createdAt)}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500 hidden lg:table-cell">{formatDate(j.updatedAt)}</td>
                  <td className="py-2">
                    {j.primeUrl && <a href={j.primeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-red-400"><ExternalLink size={14} /></a>}
                  </td>
                </tr>
              ))}
              {data.zeroDollarJobs.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-gray-500 text-sm">All open jobs have an authorised value</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
