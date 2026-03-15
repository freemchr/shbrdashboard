'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/prime-helpers';
import type { PrimeJob } from '@/lib/prime-helpers';
import { Search, ExternalLink, X, ChevronDown, ChevronUp } from 'lucide-react';

interface FlatJob {
  id: string;
  jobNumber: string;
  address: string;
  clientReference: string;
  description: string;
  status: string;
  region: string;
  jobType: string;
  authorisedTotal: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  primeUrl: string;
  _raw: PrimeJob;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [allJobs, setAllJobs] = useState<FlatJob[]>([]);
  const [filtered, setFiltered] = useState<FlatJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [selectedJob, setSelectedJob] = useState<FlatJob | null>(null);

  const statuses = Array.from(new Set(allJobs.map((j) => j.status).filter(Boolean))).sort();
  const regions = Array.from(new Set(allJobs.map((j) => j.region).filter((r) => r && r !== '—'))).sort();
  const types = Array.from(new Set(allJobs.map((j) => j.jobType).filter((t) => t && t !== '—'))).sort();

  useEffect(() => {
    async function loadJobs() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/prime/jobs?per_page=200');
        if (!res.ok) throw new Error('Failed to load jobs');
        const data = await res.json();
        const raw: PrimeJob[] = data.data || [];
        const flat: FlatJob[] = raw.map((j) => ({
          id: j.id,
          jobNumber: j.attributes?.jobNumber || j.id,
          address: typeof j.attributes?.address === 'object' && j.attributes?.address ? [j.attributes.address.addressLine1, j.attributes.address.suburb, j.attributes.address.state].filter(Boolean).join(', ') || '—' : String(j.attributes?.address || '—'),
          clientReference: j.attributes?.clientReference || '',
          description: j.attributes?.description || '',
          status: j.attributes?.statusName || j.attributes?.status || '—',
          region: j.attributes?.region || '—',
          jobType: j.attributes?.jobType || '—',
          authorisedTotal: j.attributes?.authorisedTotalIncludingTax || 0,
          createdAt: j.attributes?.createdAt || '',
          updatedAt: j.attributes?.updatedAt || '',
          updatedBy: j.attributes?.updatedBy || '—',
          primeUrl: (j.attributes?.primeUrl as string) || '',
          _raw: j,
        }));
        setAllJobs(flat);
        setFiltered(flat);
        setLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    loadJobs();
  }, []);

  const applyFilters = useCallback(() => {
    let result = allJobs;

    if (query) {
      const q = query.toLowerCase();
      result = result.filter((j) =>
        j.jobNumber.toLowerCase().includes(q) ||
        j.address.toLowerCase().includes(q) ||
        j.clientReference.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q)
      );
    }

    if (statusFilter) result = result.filter((j) => j.status === statusFilter);
    if (regionFilter) result = result.filter((j) => j.region === regionFilter);
    if (typeFilter) result = result.filter((j) => j.jobType === typeFilter);

    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((j) => j.createdAt && new Date(j.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((j) => j.createdAt && new Date(j.createdAt) <= to);
    }

    setFiltered(result);
  }, [allJobs, query, statusFilter, regionFilter, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  return (
    <div>
      <PageHeader title="Job Search" subtitle="Search and filter all jobs" />

      {/* Search & Filters */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by job number, address, client reference..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-red-500"
          >
            <option value="">All Statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

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

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From date"
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-red-500"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To date"
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-red-500"
          />

          {(query || statusFilter || regionFilter || typeFilter || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setQuery('');
                setStatusFilter('');
                setRegionFilter('');
                setTypeFilter('');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <X size={12} />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading && (
        <div className="text-center py-8 text-gray-500">Loading jobs...</div>
      )}

      {loaded && !loading && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 text-sm text-gray-400">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            {allJobs.length !== filtered.length && ` of ${allJobs.length} total`}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-400">Job #</th>
                  <th className="text-left py-3 px-4 text-gray-400">Address</th>
                  <th className="text-left py-3 px-4 text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 text-gray-400">Region</th>
                  <th className="text-left py-3 px-4 text-gray-400">Type</th>
                  <th className="text-right py-3 px-4 text-gray-400">Auth. Total</th>
                  <th className="text-left py-3 px-4 text-gray-400">Updated</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((job) => (
                  <>
                    <tr
                      key={job.id}
                      onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                      className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-mono text-red-400 text-xs">{job.jobNumber}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-300 max-w-[200px] truncate">{job.address}</td>
                      <td className="py-3 px-4">
                        <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{job.region}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{job.jobType}</td>
                      <td className="py-3 px-4 text-right text-gray-300 text-xs">
                        {formatCurrency(job.authorisedTotal)}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(job.updatedAt)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {job.primeUrl && (
                            <a
                              href={job.primeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-gray-500 hover:text-red-400"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                          {selectedJob?.id === job.id ? (
                            <ChevronUp size={13} className="text-gray-500" />
                          ) : (
                            <ChevronDown size={13} className="text-gray-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                    {selectedJob?.id === job.id && (
                      <tr key={`${job.id}-detail`} className="bg-gray-800/40">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Job Number</p>
                              <p className="text-white font-mono">{job.jobNumber}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Address</p>
                              <p className="text-white">{job.address}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Client Reference</p>
                              <p className="text-white">{job.clientReference || '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Description</p>
                              <p className="text-gray-300 text-xs">{job.description || '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Status</p>
                              <p className="text-white">{job.status}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Region</p>
                              <p className="text-white">{job.region}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Job Type</p>
                              <p className="text-white">{job.jobType}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Authorised Total</p>
                              <p className="text-green-400 font-medium">{formatCurrency(job.authorisedTotal)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Created</p>
                              <p className="text-white">{formatDate(job.createdAt)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Last Updated</p>
                              <p className="text-white">{formatDate(job.updatedAt)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Updated By</p>
                              <p className="text-white">{job.updatedBy}</p>
                            </div>
                            {job.primeUrl && (
                              <div>
                                <p className="text-gray-500 text-xs mb-1">Prime Link</p>
                                <a
                                  href={job.primeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                                >
                                  Open in Prime <ExternalLink size={11} />
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      No jobs found matching your search.
                    </td>
                  </tr>
                )}
                {filtered.length > 100 && (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-gray-500 text-sm">
                      Showing first 100 results. Refine your search to see more.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
