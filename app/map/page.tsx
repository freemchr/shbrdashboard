'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import { MapPin, RefreshCw, AlertTriangle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { formatCurrency } from '@/lib/prime-helpers';

// Load map client-side only (Leaflet requires window)
const JobMap = dynamic(
  () => import('@/components/ui/JobMap').then(m => m.JobMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl bg-gray-900 border border-gray-800" style={{ height: 580 }}>
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
  lat: number | null;
  lng: number | null;
}

type FilterKey = 'all' | 'mapped' | 'unmapped';

const BATCH_SIZE = 40; // geocode 40 addresses per Vercel function call (~44s at 1.1s/req)
const POLL_INTERVAL_MS = 3000; // poll for new results every 3s while geocoding

export default function MapPage() {
  const [jobs, setJobs] = useState<GeocodedJob[]>([]);
  const [complete, setComplete] = useState(false);
  const [total, setTotal] = useState(0);
  const [geocoded, setGeocoded] = useState(0);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('mapped');
  const [regionFilter, setRegionFilter] = useState('');
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

        if (!done) await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      geocodingRef.current = false;
      setGeocoding(false);
    }
  }, []);

  useEffect(() => {
    // On mount: check cache first (GET), then geocode if needed
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

        setJobs(data.jobs);
        setTotal(data.total);
        setGeocoded(data.geocoded ?? data.jobs.filter(j => j.lat !== null).length);
        setComplete(data.complete);

        // If not complete (cache miss or partial), kick off geocoding
        if (!data.complete) {
          runGeocoding(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [runGeocoding]);

  const mapped = jobs.filter(j => j.lat !== null && j.lng !== null);
  const unmapped = jobs.filter(j => j.lat === null || j.lng === null);
  const regions = Array.from(new Set(jobs.map(j => j.region).filter(r => r && r !== '—'))).sort();

  const filteredForMap = mapped.filter(j => !regionFilter || j.region === regionFilter);
  const filteredList = (filter === 'mapped' ? mapped : filter === 'unmapped' ? unmapped : jobs)
    .filter(j => !regionFilter || j.region === regionFilter);

  const pct = total > 0 ? Math.round((geocoded / total) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Jobs Map"
        subtitle="Open jobs plotted on OpenStreetMap — click a pin for details"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <MapPin size={20} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="text-2xl font-bold text-white">{mapped.length}</p>
            <p className="text-xs text-gray-500">Mapped Jobs</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-yellow-500 flex-shrink-0" />
          <div>
            <p className="text-2xl font-bold text-white">{unmapped.length}</p>
            <p className="text-xs text-gray-500">Unmapped</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <MapPin size={20} className="text-gray-500 flex-shrink-0" />
          <div>
            <p className="text-2xl font-bold text-white">{total || jobs.length}</p>
            <p className="text-xs text-gray-500">Total Open Jobs</p>
          </div>
        </div>
      </div>

      {/* Geocoding progress bar */}
      {geocoding && (
        <div className="mb-4 bg-gray-900 border border-yellow-800/40 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-yellow-400 mb-2">
            <RefreshCw size={13} className="animate-spin flex-shrink-0" />
            Geocoding addresses via OpenStreetMap… {geocoded}/{total} ({pct}%)
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {complete && !geocoding && (
        <div className="mb-4 flex items-center gap-2 text-xs text-green-500 bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2">
          ✓ All addresses geocoded — results cached for 2 hours
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={regionFilter}
          onChange={e => setRegionFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <button
          onClick={() => { setJobs([]); setComplete(false); setGeocoded(0); runGeocoding(true); }}
          disabled={geocoding}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} className={geocoding ? 'animate-spin' : ''} />
          Re-geocode all
        </button>

        <span className="text-xs text-gray-500 ml-auto">
          {filteredForMap.length} pin{filteredForMap.length !== 1 ? 's' : ''} on map
          {regionFilter ? ` · ${regionFilter}` : ''}
        </span>
      </div>

      {/* Map */}
      {loading ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 flex items-center justify-center mb-6" style={{ height: 580 }}>
          <LoadingSpinner message="Loading cached results…" />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden mb-6">
          <JobMap jobs={filteredForMap} height={580} />
        </div>
      )}

      {/* Job list */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="text-lg font-semibold text-white">Job List</h2>
          <div className="flex gap-1">
            {(['all', 'mapped', 'unmapped'] as FilterKey[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  filter === f ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {f === 'all' ? `All (${jobs.length})` : f === 'mapped' ? `Mapped (${mapped.length})` : `Unmapped (${unmapped.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-medium">Job #</th>
                <th className="text-left py-2 pr-3 font-medium">Address</th>
                <th className="text-left py-2 pr-3 font-medium">Status</th>
                <th className="text-left py-2 pr-3 font-medium">Region</th>
                <th className="text-left py-2 pr-3 font-medium">Auth Total</th>
                <th className="text-left py-2 font-medium">Pin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredList.slice(0, 150).map(job => (
                <tr key={job.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 pr-3">
                    {job.primeUrl ? (
                      <a href={job.primeUrl} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-red-400 text-xs hover:text-red-300 underline underline-offset-2">
                        {job.jobNumber}
                      </a>
                    ) : (
                      <span className="font-mono text-red-400 text-xs">{job.jobNumber}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-gray-300 text-xs max-w-[200px] truncate">{job.address}</td>
                  <td className="py-2 pr-3 text-xs text-gray-400">{job.status}</td>
                  <td className="py-2 pr-3 text-xs text-gray-500">{job.region}</td>
                  <td className="py-2 pr-3 text-xs text-gray-400">{formatCurrency(job.authorisedTotal)}</td>
                  <td className="py-2 text-xs">
                    {job.lat !== null ? <span className="text-green-500">✓</span> : <span className="text-yellow-600">—</span>}
                  </td>
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 text-sm">No jobs</td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredList.length > 150 && (
            <p className="text-xs text-gray-600 text-center mt-3">Showing first 150 of {filteredList.length}</p>
          )}
        </div>
      </div>
    </div>
  );
}
