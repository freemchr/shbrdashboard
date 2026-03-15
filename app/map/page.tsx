'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import { MapPin, RefreshCw, AlertTriangle, CheckCircle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import { formatCurrency } from '@/lib/prime-helpers';

type SortKey = 'jobNumber' | 'address' | 'status' | 'region' | 'jobType' | 'authorisedTotal';
type SortDir = 'asc' | 'desc';

const JobMap = dynamic(
  () => import('@/components/ui/JobMap').then(m => m.JobMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl bg-gray-900 border border-gray-800 h-[320px] sm:h-[450px] lg:h-[580px]">
        <LoadingSpinner message="Initialising map…" />
      </div>
    ),
  }
);

export interface GeocodedJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  jobType: string;
  region: string;
  primeUrl: string;
  authorisedTotal: number;
  updatedAt: string;
  updatedBy: string;
  lat: number | null;
  lng: number | null;
  failed?: boolean;
}

const BATCH_SIZE = 30;

export default function MapPage() {
  const [jobs, setJobs] = useState<GeocodedJob[]>([]);
  const [complete, setComplete] = useState(false);
  const [total, setTotal] = useState(0);
  const [geocoded, setGeocoded] = useState(0);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [listTab, setListTab] = useState<'mapped' | 'unmapped' | 'all'>('mapped');

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('jobNumber');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const geocodingRef = useRef(false);

  const runGeocoding = useCallback(async (reset = false) => {
    if (geocodingRef.current) return;
    geocodingRef.current = true;
    setGeocoding(true);
    setError(null);

    try {
      let done = false;
      while (!done) {
        const res = await fetch('/api/prime/jobs/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchSize: BATCH_SIZE, reset }),
        });
        if (!res.ok) throw new Error(`Geocode error: ${res.status}`);
        const data = await res.json() as {
          jobs: GeocodedJob[];
          complete: boolean;
          total: number;
          geocoded: number;
          error?: string;
        };
        if (data.error) throw new Error(data.error);

        setJobs(data.jobs);
        setTotal(data.total);
        setGeocoded(data.geocoded);
        setComplete(data.complete);
        done = data.complete;

        if (!done) await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      geocodingRef.current = false;
      setGeocoding(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const res = await fetch('/api/prime/jobs/geocode');
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json() as {
          jobs: GeocodedJob[];
          complete: boolean;
          total: number;
          geocoded?: number;
          error?: string;
        };
        if (data.error) throw new Error(data.error);
        setJobs(data.jobs ?? []);
        setTotal(data.total ?? 0);
        setGeocoded(data.geocoded ?? data.jobs?.filter((j: GeocodedJob) => j.lat !== null).length ?? 0);
        setComplete(data.complete ?? false);
        if (!data.complete) runGeocoding(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [runGeocoding]);

  // Derived
  const regions = Array.from(new Set(jobs.map(j => j.region).filter(r => r && r !== '—'))).sort();
  const statuses = Array.from(new Set(jobs.map(j => j.status).filter(s => s && s !== '—'))).sort();

  const applyFilters = (list: GeocodedJob[]) =>
    list.filter(j =>
      (!regionFilter || j.region === regionFilter) &&
      (!statusFilter || j.status === statusFilter)
    );

  const mapped   = jobs.filter(j => j.lat !== null && j.lng !== null);
  // When complete, anything unresolved is a bad address. When still geocoding, it's pending.
  const unmapped = jobs.filter(j => j.lat === null && (j.failed === true || complete));
  const pending  = complete ? [] : jobs.filter(j => j.lat === null && !j.failed);

  const mapJobs  = applyFilters(mapped);
  const listJobs = applyFilters(listTab === 'mapped' ? mapped : listTab === 'unmapped' ? unmapped : jobs)
    .slice()
    .sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const pct = total > 0 ? Math.round((geocoded / total) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Jobs Map"
        subtitle="All open jobs pinpointed on OpenStreetMap — click a pin for details"
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <MapPin size={20} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="text-xl sm:text-2xl font-bold text-white">{mapped.length}</p>
            <p className="text-xs text-gray-500">Pinned on Map</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <RefreshCw size={20} className={`text-blue-400 flex-shrink-0 ${geocoding ? 'animate-spin' : ''}`} />
          <div>
            <p className="text-xl sm:text-2xl font-bold text-white">{pending.length}</p>
            <p className="text-xs text-gray-500">Pending Geocode</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-yellow-500 flex-shrink-0" />
          <div>
            <p className="text-xl sm:text-2xl font-bold text-white">{unmapped.length}</p>
            <p className="text-xs text-gray-500">Bad Address</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <MapPin size={20} className="text-gray-500 flex-shrink-0" />
          <div>
            <p className="text-xl sm:text-2xl font-bold text-white">{total || jobs.length}</p>
            <p className="text-xs text-gray-500">Total Open Jobs</p>
          </div>
        </div>
      </div>

      {/* Geocoding progress */}
      {geocoding && (
        <div className="mb-4 bg-gray-900 border border-yellow-800/40 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-yellow-400 mb-2">
            <RefreshCw size={13} className="animate-spin flex-shrink-0" />
            Geocoding via OpenStreetMap… {geocoded}/{total} ({pct}%) — dropping pins as they resolve
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {complete && !geocoding && (
        <div className="mb-4 flex items-center gap-2 text-xs text-green-400 bg-green-900/20 border border-green-800/30 rounded-xl px-4 py-2.5">
          <CheckCircle size={13} />
          All {total} addresses geocoded · results cached for 2 hours
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={regionFilter}
          onChange={e => setRegionFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto"
        >
          <option value="">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto"
        >
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {(regionFilter || statusFilter) && (
          <button
            onClick={() => { setRegionFilter(''); setStatusFilter(''); }}
            className="text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg transition-colors"
          >
            Clear filters
          </button>
        )}

        <button
          onClick={() => { setJobs([]); setComplete(false); setGeocoded(0); runGeocoding(true); }}
          disabled={geocoding}
          className="ml-auto flex items-center gap-2 text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={geocoding ? 'animate-spin' : ''} />
          Re-geocode all
        </button>

        <span className="text-xs text-gray-500">
          {mapJobs.length} pin{mapJobs.length !== 1 ? 's' : ''} on map
        </span>
      </div>

      {/* Map */}
      {loading ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 flex items-center justify-center mb-5 h-[320px] sm:h-[450px] lg:h-[580px]">
          <LoadingSpinner message="Loading cached results…" />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden mb-5 h-[320px] sm:h-[450px] lg:h-[580px]">
          <JobMap jobs={mapJobs} />
        </div>
      )}

      {/* Job list table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="text-base font-semibold text-white">Job List</h2>
          <div className="flex gap-1">
            {(['mapped', 'unmapped', 'all'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setListTab(tab)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  listTab === tab ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'all' ? `All (${jobs.length})` : tab === 'mapped' ? `Pinned (${mapped.length})` : `Bad Address (${unmapped.length})`}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-600 ml-auto">
            {listJobs.length} shown{regionFilter || statusFilter ? ' (filtered)' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                {([
                  { key: 'jobNumber',       label: 'Job #' },
                  { key: 'address',         label: 'Address' },
                  { key: 'status',          label: 'Status' },
                  { key: 'region',          label: 'Region' },
                  { key: 'jobType',         label: 'Type' },
                  { key: 'authorisedTotal', label: 'Auth Total' },
                ] as { key: SortKey; label: string }[]).map(col => (
                  <th key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="text-left py-2 pr-4 font-medium cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key
                        ? sortDir === 'asc'
                          ? <ChevronUp size={12} className="text-red-400" />
                          : <ChevronDown size={12} className="text-red-400" />
                        : <ChevronsUpDown size={12} className="text-gray-700" />
                      }
                    </span>
                  </th>
                ))}
                <th className="text-left py-2 font-medium">Pin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {listJobs.slice(0, 200).map(job => (
                <tr key={job.id} className="hover:bg-gray-800/30 transition-colors group">
                  <td className="py-2 pr-4">
                    {job.primeUrl ? (
                      <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-red-400 text-xs hover:text-red-300 underline underline-offset-2">
                        {job.jobNumber}
                      </a>
                    ) : (
                      <span className="font-mono text-red-400 text-xs">{job.jobNumber}</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-gray-300 text-xs max-w-[180px] truncate">{job.address}</td>
                  <td className="py-2 pr-4 text-xs text-gray-400 max-w-[140px] truncate">{job.status}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">{job.region}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">{job.jobType}</td>
                  <td className="py-2 pr-4 text-xs text-gray-400 font-mono">
                    {job.authorisedTotal > 0 ? formatCurrency(job.authorisedTotal) : '—'}
                  </td>
                  <td className="py-2 text-xs">
                    {job.lat !== null
                      ? <span className="text-green-500">✓</span>
                      : job.failed
                        ? <span className="text-yellow-600" title="Address could not be geocoded">✗</span>
                        : <span className="text-blue-500" title="Pending geocode">…</span>}
                  </td>
                </tr>
              ))}
              {listJobs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500 text-sm">No jobs match current filters</td>
                </tr>
              )}
            </tbody>
          </table>
          {listJobs.length > 200 && (
            <p className="text-xs text-gray-600 text-center mt-3">Showing 200 of {listJobs.length}</p>
          )}
        </div>
      </div>
    </div>
  );
}
