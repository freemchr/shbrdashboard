'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import {
  Droplets, ExternalLink, TrendingUp, Clock, BarChart2, MapPin,
  ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, CheckSquare, Square,
} from 'lucide-react';

// ─── EOL Types ────────────────────────────────────────────────────────────────

interface EolJob {
  id: string; jobNumber: string; address: string; status: string;
  assignee: string; region: string; daysOpen: number; createdAt: string;
  perilName: string; matchedOn: string; primeUrl: string;
}
interface EolStats {
  total: number; totalOpen: number; completedThisMonth: number;
  avgDaysOpen: number; percentOfPortfolio: number; byRegion: Record<string, number>;
}
interface EolResponse { stats: EolStats; openJobs: EolJob[]; generatedAt: string; }

type EolSortCol = keyof Pick<EolJob, 'jobNumber' | 'address' | 'status' | 'assignee' | 'region' | 'daysOpen' | 'matchedOn'>;

// ─── Vulnerable Types ─────────────────────────────────────────────────────────

interface VulnerableJob {
  id: string; jobNumber: string; address: string; assignee: string;
  region: string; status: string; matchedKeyword: string; notes: string; primeUrl: string;
}
interface VulnerableResponse { total: number; jobs: VulnerableJob[]; generatedAt: string; }

// ─── EOL helpers ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, sub, accent }: {
  label: string; value: string | number; icon: React.ElementType; sub?: string; accent?: boolean;
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
  if (matchedOn === 'peril')       return <span className="text-xs bg-blue-900/40 border border-blue-700/40 text-blue-300 px-2 py-0.5 rounded-full">peril</span>;
  if (matchedOn === 'description') return <span className="text-xs bg-purple-900/40 border border-purple-700/40 text-purple-300 px-2 py-0.5 rounded-full">description</span>;
  return <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">notes</span>;
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={11} className="text-gray-700 inline ml-1" />;
  return dir === 'asc'
    ? <ChevronUp size={11} className="text-blue-400 inline ml-1" />
    : <ChevronDown size={11} className="text-blue-400 inline ml-1" />;
}

// ─── Vulnerable helpers ───────────────────────────────────────────────────────

function highlightKeyword(text: string, keyword: string): React.ReactNode {
  if (!text || !keyword) return text;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-red-500/30 text-red-200 rounded px-0.5">{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </>
  );
}

// ─── EOL Tab ─────────────────────────────────────────────────────────────────

function EolTab() {
  const [data, setData]       = useState<EolResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<EolSortCol>('daysOpen');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (col: EolSortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir(col === 'daysOpen' ? 'desc' : 'asc'); }
  };

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

  const sortedJobs = [...openJobs].sort((a, b) => {
    const av = a[sortCol] ?? '';
    const bv = b[sortCol] ?? '';
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total EOL Jobs"   value={stats.total}                   icon={Droplets}  sub="Open + completed this month" accent />
        <StatCard label="Active Open"      value={stats.totalOpen}               icon={TrendingUp} sub="Currently in progress" />
        <StatCard label="% of Portfolio"   value={`${stats.percentOfPortfolio}%`} icon={BarChart2} sub="Of all open jobs" />
        <StatCard label="Avg Days Open"    value={stats.avgDaysOpen}             icon={Clock}     sub="Average age of open EOL jobs" />
      </div>

      {byRegionSorted.length > 0 && (
        <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-blue-400" />
            <h2 className="text-sm font-semibold text-white">EOL Jobs by Region</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {byRegionSorted.map(([region, count], idx) => {
              // Top 3 get progressively warmer tints
              const tileClass = idx === 0
                ? 'bg-amber-950/40 border border-amber-700/40'
                : idx === 1
                  ? 'bg-amber-950/20 border border-amber-800/30'
                  : idx === 2
                    ? 'bg-yellow-950/20 border border-yellow-900/20'
                    : 'bg-gray-800 border border-gray-700/50';
              const countClass = idx === 0 ? 'text-amber-300' : idx <= 2 ? 'text-yellow-300' : 'text-blue-300';
              return (
                <div key={region} className={`rounded-lg px-4 py-3 flex items-center justify-between ${tileClass}`}>
                  <span className="text-xs text-gray-400 truncate">{region}</span>
                  <span className={`text-sm font-bold ml-2 flex-shrink-0 ${countClass}`}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.completedThisMonth > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-emerald-950/20 border border-emerald-700/40 rounded-xl px-5 py-3">
          <span className="text-emerald-400">✓</span>
          <p className="text-emerald-300 text-sm font-medium">
            {stats.completedThisMonth} EOL job{stats.completedThisMonth !== 1 ? 's' : ''} completed this month
          </p>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
          <Droplets size={16} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Open EOL Jobs</h2>
          <span className="text-xs text-gray-500">— {openJobs.length} job{openJobs.length !== 1 ? 's' : ''}</span>
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
                  {([
                    ['jobNumber', 'Job #'], ['address', 'Address'], ['status', 'Status'],
                    ['assignee', 'Assignee'], ['region', 'Region'], ['daysOpen', 'Days Open'], ['matchedOn', 'Matched On'],
                  ] as [EolSortCol, string][]).map(([col, label]) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className={`py-2 px-3 text-left text-xs text-gray-500 font-medium cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap ${col === 'matchedOn' ? 'hidden md:table-cell' : ''} ${col === 'region' ? 'hidden sm:table-cell' : ''}`}
                    >
                      {label}<SortIcon active={sortCol === col} dir={sortDir} />
                    </th>
                  ))}
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map(job => (
                  <tr key={job.id} className={`border-b border-gray-800 hover:bg-gray-800/40 transition-colors ${job.daysOpen > 30 ? 'bg-amber-950/5' : ''}`}>
                    <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                      {job.primeUrl ? (
                        <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">{job.jobNumber}</a>
                      ) : <span className="text-gray-300">{job.jobNumber}</span>}
                    </td>
                    <td className="py-2 px-3 text-gray-300 text-xs max-w-[160px] truncate">{job.address}</td>
                    <td className="py-2 px-3 text-xs text-gray-400 max-w-[120px] truncate">{job.status}</td>
                    <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">{job.assignee}</td>
                    <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap hidden sm:table-cell">{job.region}</td>
                    <td className="py-2 px-3 text-xs font-mono font-bold whitespace-nowrap">
                      <span className={job.daysOpen > 30 ? 'text-amber-400' : job.daysOpen > 14 ? 'text-yellow-400' : 'text-gray-300'}>{job.daysOpen}d</span>
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
        <p className="text-xs text-gray-600 mt-4">Data generated: {new Date(data.generatedAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</p>
      )}
    </div>
  );
}

// ─── Vulnerable Tab ───────────────────────────────────────────────────────────

function VulnerableTab() {
  const [data, setData]       = useState<VulnerableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [notified, setNotified] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/prime/jobs/vulnerable')
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? 'Failed')))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const toggleNotified = (id: string) => {
    setNotified(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <LoadingSpinner message="Scanning for vulnerable customers…" />;
  if (error)   return <ErrorMessage message={error} />;
  if (!data)   return null;

  const notifiedCount = notified.size;

  return (
    <div>
      <div className={`mb-6 flex items-start gap-3 rounded-xl px-5 py-4 border ${
        data.total === 0 ? 'bg-emerald-950/20 border-emerald-700/40' : 'bg-red-950/40 border-red-700/50'
      }`}>
        <AlertTriangle size={20} className={data.total === 0 ? 'text-emerald-400 flex-shrink-0 mt-0.5' : 'text-red-400 flex-shrink-0 mt-0.5'} />
        <div className="flex-1">
          {data.total === 0 ? (
            <p className="text-emerald-300 font-semibold text-sm">No vulnerable customer flags detected</p>
          ) : (
            <>
              <p className="text-red-300 font-semibold text-sm">
                ⚠️ {data.total} job{data.total !== 1 ? 's' : ''} may involve a vulnerable customer
              </p>
              <p className="text-red-400/70 text-xs mt-0.5">
                Suncorp requires builders to notify them when a vulnerable customer is identified. Please confirm notification for each job below.
                {notifiedCount > 0 && <span className="text-emerald-400 ml-2 font-medium">{notifiedCount} marked as notified (this session only).</span>}
              </p>
            </>
          )}
        </div>
      </div>

      {data.total === 0 ? (
        <div className="py-20 text-center bg-gray-900 rounded-xl border border-gray-800">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-gray-300 font-medium">No vulnerable customer flags</p>
          <p className="text-gray-500 text-sm mt-1">No keywords detected in current open jobs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.jobs.map(job => {
            const isNotified = notified.has(job.id);
            return (
              <div key={job.id} className={`bg-gray-900 rounded-xl border overflow-hidden transition-all ${isNotified ? 'border-emerald-700/40 opacity-70' : 'border-red-800/50'}`}>
                <div className="px-5 py-4 flex items-start gap-4">
                  <button
                    onClick={() => toggleNotified(job.id)}
                    className={`flex-shrink-0 mt-0.5 transition-colors ${isNotified ? 'text-emerald-400' : 'text-gray-600 hover:text-red-400'}`}
                    title={isNotified ? 'Mark as not notified' : 'Mark Suncorp as notified'}
                  >
                    {isNotified ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-sm font-bold text-white">
                          {job.primeUrl ? (
                            <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 underline underline-offset-2">
                              {job.jobNumber}
                            </a>
                          ) : job.jobNumber}
                        </span>
                        <span className="text-xs bg-red-900/40 border border-red-700/40 text-red-300 px-2 py-0.5 rounded-full font-medium">
                          🔍 &ldquo;{job.matchedKeyword}&rdquo;
                        </span>
                        {isNotified && (
                          <span className="text-xs bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                            ✓ Suncorp notified
                          </span>
                        )}
                      </div>
                      {job.primeUrl && (
                        <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-red-400 flex-shrink-0">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>

                    <p className="text-gray-300 text-sm mt-1">{job.address}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                      <span>Assignee: <span className="text-gray-400">{job.assignee}</span></span>
                      <span>Region: <span className="text-gray-400">{job.region}</span></span>
                      <span>Status: <span className="text-gray-400">{job.status}</span></span>
                    </div>

                    {job.notes && (
                      <div className="mt-3 bg-gray-800/60 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wide">Notes excerpt</p>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {highlightKeyword(job.notes, job.matchedKeyword)}
                          {job.notes.length >= 200 && <span className="text-gray-600"> …</span>}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.generatedAt && (
        <p className="text-xs text-gray-600 mt-4">Data generated: {new Date(data.generatedAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'eol' | 'vulnerable';

export default function FlaggedPage() {
  const [activeTab, setActiveTab] = useState<Tab>('eol');

  return (
    <div>
      <PageHeader title="Flagged Jobs" subtitle="Special category jobs requiring extra attention" />

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        {([['eol', 'EOL'], ['vulnerable', 'Vulnerable']] as [Tab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'eol'        && <EolTab />}
      {activeTab === 'vulnerable' && <VulnerableTab />}
    </div>
  );
}
