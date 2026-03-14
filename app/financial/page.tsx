'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/prime-helpers';
import type { PrimeJob } from '@/lib/prime-helpers';
import { ExternalLink, DollarSign } from 'lucide-react';

interface InvoiceSummary {
  byStatus: Record<string, { count: number; total: number }>;
  grandTotal: number;
  count: number;
}

const INVOICING_STATUSES = [
  'Preparing for Invoicing',
  'Invoice Number Required',
  'Invoice Number Supplied',
];

interface FlatJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  region: string;
  authorisedTotal: number;
  createdAt: string;
  primeUrl: string;
}

export default function FinancialPage() {
  const [jobs, setJobs] = useState<PrimeJob[]>([]);
  const [arData, setArData] = useState<InvoiceSummary | null>(null);
  const [apData, setApData] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [jobsRes, arRes, apRes] = await Promise.all([
          fetch('/api/prime/jobs?per_page=200'),
          fetch('/api/prime/invoices/ar'),
          fetch('/api/prime/invoices/ap'),
        ]);

        const [jobsData, arJson, apJson] = await Promise.all([
          jobsRes.json(),
          arRes.ok ? arRes.json() : null,
          apRes.ok ? apRes.json() : null,
        ]);

        setJobs(jobsData.data || []);
        setArData(arJson);
        setApData(apJson);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading financial data..." />;
  if (error) return <ErrorMessage message={error} />;

  const openJobs = jobs.filter((j) => {
    const st = (j.attributes?.statusType || '').toLowerCase();
    return st === 'open' || st === 'active';
  });

  const totalAuthorisedValue = openJobs.reduce(
    (sum, j) => sum + (j.attributes?.authorisedTotalIncludingTax || 0),
    0
  );

  const zeroDollarJobs = openJobs.filter(
    (j) => (j.attributes?.authorisedTotalIncludingTax || 0) === 0
  );

  const invoicingJobs = openJobs.filter((j) => {
    const status = j.attributes?.statusName || j.attributes?.status || '';
    return INVOICING_STATUSES.some((s) => s.toLowerCase() === status.toLowerCase());
  });

  const flatZeroDollarJobs: FlatJob[] = zeroDollarJobs.map((j) => ({
    id: j.id,
    jobNumber: j.attributes?.jobNumber || j.id,
    address: j.attributes?.address || '—',
    status: j.attributes?.statusName || j.attributes?.status || '—',
    region: j.attributes?.region || '—',
    authorisedTotal: 0,
    createdAt: j.attributes?.createdAt || '',
    primeUrl: (j.attributes?.primeUrl as string) || '',
  }));

  const flatInvoicingJobs: FlatJob[] = invoicingJobs.map((j) => ({
    id: j.id,
    jobNumber: j.attributes?.jobNumber || j.id,
    address: j.attributes?.address || '—',
    status: j.attributes?.statusName || j.attributes?.status || '—',
    region: j.attributes?.region || '—',
    authorisedTotal: j.attributes?.authorisedTotalIncludingTax || 0,
    createdAt: j.attributes?.createdAt || '',
    primeUrl: (j.attributes?.primeUrl as string) || '',
  }));

  const jobColumns: Column<FlatJob>[] = [
    { key: 'jobNumber', label: 'Job #', sortable: true, render: (j) => (
      <span className="font-mono text-red-400 text-xs">{j.jobNumber}</span>
    )},
    { key: 'address', label: 'Address', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'region', label: 'Region', sortable: true },
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
      <PageHeader title="Financial" subtitle="Revenue pipeline and invoice overview" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="Total Authorised Value"
          value={formatCurrency(totalAuthorisedValue)}
          icon={<DollarSign size={18} />}
          subtitle="Open jobs only"
        />
        <KpiCard
          title="$0 Authorised (Open)"
          value={zeroDollarJobs.length}
          accent={zeroDollarJobs.length > 0}
          subtitle="No authorised value yet"
        />
        <KpiCard
          title="In Invoicing"
          value={invoicingJobs.length}
          subtitle="Ready to invoice"
        />
        <KpiCard
          title="AR Total"
          value={arData ? formatCurrency(arData.grandTotal) : '—'}
          subtitle={arData ? `${arData.count} invoices` : 'Loading...'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* AR Invoices */}
        {arData && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-base font-semibold text-white mb-3">
              AR Invoices by Status ({arData.count} total)
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-3 text-gray-400">Status</th>
                  <th className="text-right py-2 px-3 text-gray-400">Count</th>
                  <th className="text-right py-2 px-3 text-gray-400">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(arData.byStatus).map(([status, info]) => (
                  <tr key={status} className="border-b border-gray-800/50">
                    <td className="py-2 px-3 text-gray-300">{status}</td>
                    <td className="py-2 px-3 text-right text-gray-400 font-mono">{info.count}</td>
                    <td className="py-2 px-3 text-right text-green-400 font-mono text-xs">
                      {formatCurrency(info.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* AP Invoices */}
        {apData && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-base font-semibold text-white mb-3">
              AP Invoices by Status ({apData.count} total)
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-3 text-gray-400">Status</th>
                  <th className="text-right py-2 px-3 text-gray-400">Count</th>
                  <th className="text-right py-2 px-3 text-gray-400">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(apData.byStatus).map(([status, info]) => (
                  <tr key={status} className="border-b border-gray-800/50">
                    <td className="py-2 px-3 text-gray-300">{status}</td>
                    <td className="py-2 px-3 text-right text-gray-400 font-mono">{info.count}</td>
                    <td className="py-2 px-3 text-right text-orange-400 font-mono text-xs">
                      {formatCurrency(info.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Jobs in invoicing statuses */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
        <h2 className="text-base font-semibold text-white mb-4">
          Jobs in Invoicing Stage ({invoicingJobs.length})
        </h2>
        <DataTable
          columns={jobColumns}
          data={flatInvoicingJobs}
          keyFn={(item) => item.id}
          pageSize={20}
          emptyMessage="No jobs currently in invoicing statuses."
        />
      </div>

      {/* $0 authorised jobs */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-base font-semibold text-white mb-4">
          Open Jobs with $0 Authorised ({zeroDollarJobs.length})
        </h2>
        <DataTable
          columns={jobColumns}
          data={flatZeroDollarJobs}
          keyFn={(item) => item.id}
          pageSize={20}
          emptyMessage="No open jobs with $0 authorised value."
        />
      </div>
    </div>
  );
}
