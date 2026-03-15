'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import { MapPin, RefreshCw, AlertTriangle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { formatCurrency } from '@/lib/prime-helpers';

// Load map client-side only (Leaflet requires window)
const JobMap = dynamic(
  () => import('@/components/ui/JobMap').then(m => m.JobMap),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-[600px] bg-gray-900 rounded-xl"><LoadingSpinner message="Loading map…" /></div> }
);

interface GeocodedJob {
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

export default function MapPage() {
  const [jobs, setJobs] = useState<GeocodedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('mapped');
  const [regionFilter, setRegionFilter] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setGeocoding(false);

    fetch('/api/prime/jobs/open')
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load open jobs'))
      .then((openJobs: GeocodedJob[]) => {
        // Show open jobs immediately (without coordinates) while geocoding loads
        setJobs(openJobs.map(j => ({ ...j, lat: null, lng: null })));
        setLoading(false);
        setGeocoding(true);

        // Now fetch geocoded version (may take a while first time)
        return fetch('/api/prime/jobs/geocode');
      })
      .then(r => r.ok ? r.json() : Promise.reject('Failed to geocode jobs'))
      .then((geocoded: GeocodedJob[]) => {
        setJobs(geocoded);
        setGeocoding(false);
      })
      .catch(e => {
        setError(String(e));
        setLoading(false);
        setGeocoding(false);
      });
  }, [refreshKey]);

  const mapped = jobs.filter(j => j.lat !== null && j.lng !== null);
  const unmapped = jobs.filter(j => j.lat === null || j.lng === null);
  const regions = Array.from(new Set(jobs.map(j => j.region).filter(Boolean))).sort();

  const filteredForMap = mapped.filter(j => !regionFilter || j.region === regionFilter);

  const filteredList = (() => {
    const base = filter === 'mapped' ? mapped : filter === 'unmapped' ? unmapped : jobs;
    return base.filter(j => !regionFilter || j.region === regionFilter);
  })();

  return (
    <div>
      <PageHeader
        title="Jobs Map"
        subtitle="Open jobs plotted on OpenStreetMap — click a pin for details"
      />

      {/* Stats bar */}
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
            <p className="text-xs text-gray-500">Unmapped (bad address)</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
          <MapPin size={20} className="text-gray-500 flex-shrink-0" />
          <div>
            <p className="text-2xl font-bold text-white">{jobs.length}</p>
            <p className="text-xs text-gray-500">Total Open Jobs</p>
          </div>
        </div>
      </div>

      {geocoding && (
        <div className="mb-4 flex items-center gap-2 text-sm text-yellow-400 bg-yellow-900/20 border border-yellow-800/40 rounded-lg px-4 py-3">
          <RefreshCw size={14} className="animate-spin" />
          Geocoding addresses via OpenStreetMap… this may take a minute on first load.
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
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>

        <span className="text-xs text-gray-500 ml-auto">
          Showing {filteredForMap.length} pinned job{filteredForMap.length !== 1 ? 's' : ''} on map
        </span>
      </div>

      {/* Map */}
      {loading ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 flex items-center justify-center" style={{ height: 600 }}>
          <LoadingSpinner message="Loading open jobs…" />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden mb-6">
          {/* Leaflet CSS */}
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
            crossOrigin=""
          />
          <JobMap jobs={filteredForMap} height={600} />
        </div>
      )}

      {/* Unmapped jobs list */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold text-white">Job List</h2>
          <div className="flex gap-1">
            {(['all', 'mapped', 'unmapped'] as FilterKey[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  filter === f
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
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
              {filteredList.slice(0, 100).map(job => (
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
                    {job.lat !== null
                      ? <span className="text-green-500">✓</span>
                      : <span className="text-yellow-600">—</span>
                    }
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
          {filteredList.length > 100 && (
            <p className="text-xs text-gray-600 text-center mt-3">
              Showing first 100 of {filteredList.length}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
