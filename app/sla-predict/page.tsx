'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import { formatDate } from '@/lib/prime-helpers';
import { downloadCSV } from '@/lib/export-csv';
import { DataRefreshButton } from '@/components/ui/DataRefreshButton';
import {
  TrendingUp,
  Download,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertTriangle,
  Clock,
  Activity,
} from 'lucide-react';
import type { SlaPredictJob, SlaPredictResponse } from '@/app/api/prime/jobs/sla-predict/route';

// ─── Animated counter ─────────────────────────────────────────────────────────
// Safe: only runs after data is confirmed loaded. Never fires on SSR or during
// the async fetch. Tied to `enabled` so a failed fetch shows 0 without animation.

function AnimatedCounter({ value, enabled }: { value: number; enabled: boolean }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!enabled || value === 0) {
      setDisplay(value);
      return;
    }
    let start: number | null = null;
    const duration = 800;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(Math.round(ease * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, enabled]);

  return <>{display}</>;
}

// ─── Spotlight card ───────────────────────────────────────────────────────────
// Subtle radial gradient that follows the mouse within each card.
// Pattern: 21st.dev easemize/spotlight-card — pure Tailwind + inline style, no deps.

function useSpotlight() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const onMouseLeave = useCallback(() => setPos(null), []);

  const overlayStyle: React.CSSProperties = pos
    ? {
        background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, rgba(255,255,255,0.06), transparent 40%)`,
        pointerEvents: 'none',
      }
    : { pointerEvents: 'none' };

  return { ref, onMouseMove, onMouseLeave, overlayStyle };
}

// ─── Sort helper types ───────────────────────────────────────────────────────

type SortKey = keyof Pick<
  SlaPredictJob,
  | 'jobNumber'
  | 'address'
  | 'assignee'
  | 'status'
  | 'slaRule'
  | 'daysUntilBreach'
  | 'riskScore'
  | 'predictedBreachDate'
  | 'riskTier'
>;

// ─── Sub-components ──────────────────────────────────────────────────────────

function SortTh({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
}: {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
}) {
  return (
    <th
      onClick={() => onSort(col)}
      className="py-2 px-3 text-left text-xs text-gray-500 font-medium whitespace-nowrap cursor-pointer select-none hover:text-white transition-colors"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === col ? (
          sortDir === 'asc' ? (
            <ChevronUp size={11} className="text-red-400" />
          ) : (
            <ChevronDown size={11} className="text-red-400" />
          )
        ) : (
          <ChevronsUpDown size={11} className="text-gray-700" />
        )}
      </span>
    </th>
  );
}

function RiskTierBadge({ tier }: { tier: SlaPredictJob['riskTier'] }) {
  const styles: Record<SlaPredictJob['riskTier'], string> = {
    critical: 'text-red-400 bg-red-500/10 border border-red-500/30',
    high:     'text-orange-400 bg-orange-500/10 border border-orange-500/30',
    medium:   'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30',
    low:      'text-gray-400 bg-gray-500/10 border border-gray-500/30',
  };
  const labels: Record<SlaPredictJob['riskTier'], string> = {
    critical: 'Critical',
    high:     'High',
    medium:   'Medium',
    low:      'Low',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[tier]}`}>
      {labels[tier]}
    </span>
  );
}

function DaysUntilBreachCell({ days }: { days: number }) {
  const colour = days <= 3 ? 'text-red-400' : days <= 7 ? 'text-orange-400' : 'text-yellow-400';
  return (
    <span className={`font-mono font-bold text-xs ${colour}`}>
      {days}d
    </span>
  );
}

// Risk score: number + 10px-tall inline progress bar coloured by tier
function RiskScoreBar({ score, tier }: { score: number; tier: SlaPredictJob['riskTier'] }) {
  const barColour = tier === 'critical' ? 'bg-red-500'
    : tier === 'high'   ? 'bg-orange-500'
    : tier === 'medium' ? 'bg-yellow-500'
    : 'bg-gray-500';

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <span className="text-xs font-mono text-white w-6 text-right flex-shrink-0">{score}</span>
      <div className="flex-1 h-[10px] bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColour}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ─── KPI Spotlight Card ───────────────────────────────────────────────────────

function KpiCard({
  onClick,
  active,
  className,
  children,
}: {
  onClick: () => void;
  active: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const { ref, onMouseMove, onMouseLeave, overlayStyle } = useSpotlight();
  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`relative overflow-hidden rounded-xl border p-5 text-left transition-all ${className} ${
        active ? 'ring-1' : ''
      }`}
    >
      {/* Spotlight overlay */}
      <div className="absolute inset-0 rounded-xl transition-opacity duration-300" style={overlayStyle} />
      {/* Content above overlay */}
      <div className="relative z-10">{children}</div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SlaPredictPage() {
  const [data, setData]           = useState<SlaPredictResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  // dataLoaded: only true after a successful API response — drives AnimatedCounter
  const [dataLoaded, setDataLoaded] = useState(false);

  const [regionFilter, setRegionFilter] = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const [tierFilter, setTierFilter]     = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('riskScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/prime/jobs/sla-predict')
      .then(r =>
        r.ok
          ? r.json()
          : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? 'Failed'))
      )
      .then((d: SlaPredictResponse) => {
        setData(d);
        setDataLoaded(true); // ← animation gate: only open after confirmed success
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.jobs.filter(
      j =>
        (!regionFilter || j.region   === regionFilter) &&
        (!typeFilter   || j.jobType  === typeFilter) &&
        (!tierFilter   || j.riskTier === tierFilter)
    );
  }, [data, regionFilter, typeFilter, tierFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const regions = useMemo(
    () => Array.from(new Set((data?.jobs ?? []).map(j => j.region).filter(Boolean))).sort(),
    [data]
  );
  const types = useMemo(
    () => Array.from(new Set((data?.jobs ?? []).map(j => j.jobType).filter(Boolean))).sort(),
    [data]
  );

  const handleExport = () => {
    if (!data) return;
    downloadCSV(
      `sla-predict-${new Date().toISOString().split('T')[0]}.csv`,
      [
        'Job #', 'Address', 'Assignee', 'Status', 'Type', 'Region',
        'SLA Rule', 'SLA Days', 'Days Until Breach', 'Risk Score',
        'Risk Tier', 'Predicted Breach Date', 'Prime URL',
      ],
      sorted.map(j => [
        j.jobNumber, j.address, j.assignee, j.status, j.jobType, j.region,
        j.slaRule, j.slaDays, j.daysUntilBreach, j.riskScore, j.riskTier,
        j.predictedBreachDate, j.primeUrl,
      ])
    );
  };

  if (loading) return <LoadingSpinner message="Scoring SLA risk for open jobs…" />;
  if (error)   return <ErrorMessage message={error} />;
  if (!data)   return null;

  const { summary } = data;
  const hasFilters = regionFilter || typeFilter || tierFilter;

  return (
    <div>
      <PageHeader
        title="SLA Risk Predictor"
        subtitle="Jobs predicted to breach in the next 14 days"
        actions={
          <div className="flex items-center gap-2">
            <DataRefreshButton />
            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        }
      />

      {/* Critical alert banner */}
      {summary.critical > 0 && (
        <div className="mb-6 flex items-start gap-3 bg-red-950/40 border border-red-700/50 rounded-xl px-5 py-4">
          <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold text-sm">
              {summary.critical} job{summary.critical !== 1 ? 's' : ''} at critical risk — predicted to breach within days
            </p>
            <p className="text-red-400/70 text-xs mt-0.5">
              These jobs have a very high likelihood of breaching their SLA target soon. Action required.
            </p>
          </div>
        </div>
      )}

      {/* KPI cards — spotlight + animated counters
          key=generatedAt ensures clean re-mount on data refresh without flashing on first load */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* Total */}
        <KpiCard
          onClick={() => setTierFilter('')}
          active={!tierFilter}
          className={
            !tierFilter
              ? 'border-gray-600 bg-gray-800/60 ring-gray-600/40'
              : 'border-gray-800 bg-gray-900 hover:border-gray-600'
          }
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">Total At Risk</span>
            <TrendingUp size={16} className="text-gray-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            <AnimatedCounter
              key={`total-${data.generatedAt}`}
              value={summary.total}
              enabled={dataLoaded}
            />
          </p>
          <p className="text-xs text-gray-500 mt-1">Jobs at risk of breach</p>
        </KpiCard>

        {/* Critical */}
        <KpiCard
          onClick={() => setTierFilter(tierFilter === 'critical' ? '' : 'critical')}
          active={tierFilter === 'critical'}
          className={
            tierFilter === 'critical'
              ? 'border-red-500 bg-red-950/30 ring-red-500/30'
              : 'border-red-800/50 bg-red-950/10 hover:border-red-600'
          }
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-red-300 font-medium">Critical</span>
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-red-400">
            <AnimatedCounter
              key={`critical-${data.generatedAt}`}
              value={summary.critical}
              enabled={dataLoaded}
            />
          </p>
          <p className="text-xs text-red-400/60 mt-1">Score ≥75 — urgent</p>
        </KpiCard>

        {/* High */}
        <KpiCard
          onClick={() => setTierFilter(tierFilter === 'high' ? '' : 'high')}
          active={tierFilter === 'high'}
          className={
            tierFilter === 'high'
              ? 'border-orange-500 bg-orange-950/30 ring-orange-500/30'
              : 'border-gray-800 bg-gray-900 hover:border-orange-700'
          }
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-orange-300 font-medium">High</span>
            <Activity size={16} className="text-orange-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-orange-400">
            <AnimatedCounter
              key={`high-${data.generatedAt}`}
              value={summary.high}
              enabled={dataLoaded}
            />
          </p>
          <p className="text-xs text-gray-500 mt-1">Score 55–74</p>
        </KpiCard>

        {/* Medium */}
        <KpiCard
          onClick={() => setTierFilter(tierFilter === 'medium' ? '' : 'medium')}
          active={tierFilter === 'medium'}
          className={
            tierFilter === 'medium'
              ? 'border-yellow-500 bg-yellow-950/30 ring-yellow-500/30'
              : 'border-gray-800 bg-gray-900 hover:border-yellow-700'
          }
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-yellow-300 font-medium">Medium</span>
            <Clock size={16} className="text-yellow-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-yellow-400">
            <AnimatedCounter
              key={`medium-${data.generatedAt}`}
              value={summary.medium}
              enabled={dataLoaded}
            />
          </p>
          <p className="text-xs text-gray-500 mt-1">Score 35–54</p>
        </KpiCard>
      </div>

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
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto"
        >
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-auto"
        >
          <option value="">All Risk Tiers</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setRegionFilter(''); setTypeFilter(''); setTierFilter(''); }}
            className="text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg transition-colors"
          >
            Clear filters
          </button>
        )}

        <span className="text-xs text-gray-500 ml-auto">
          {sorted.length} job{sorted.length !== 1 ? 's' : ''}
          {hasFilters ? ' (filtered)' : ''}
          {data.generatedAt && (
            <span className="ml-2 text-gray-600">· Updated {formatDate(data.generatedAt)}</span>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
          <TrendingUp size={16} className="text-orange-400" />
          <h2 className="text-sm font-semibold text-white">At-Risk Jobs</h2>
          <span className="text-xs text-gray-500">— sorted by risk score</span>
        </div>

        {sorted.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-gray-300 font-medium">No jobs predicted to breach</p>
            <p className="text-gray-500 text-sm mt-1">
              {hasFilters ? 'Try clearing your filters' : 'All open jobs are safely within their SLA window'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <SortTh col="jobNumber"          label="Job #"             sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="py-2 px-3 text-left text-xs text-gray-500 font-medium">Address</th>
                  <SortTh col="assignee"           label="Assignee"          sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="status"             label="Status"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="slaRule"            label="SLA Rule"          sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="daysUntilBreach"    label="Days Until Breach" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="riskScore"          label="Risk Score"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="predictedBreachDate" label="Predicted Breach" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="riskTier"           label="Risk Tier"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((job, idx) => {
                  const rowColour =
                    job.riskTier === 'critical' ? 'border-red-900/60 bg-red-950/10'
                    : job.riskTier === 'high'   ? 'border-orange-900/40 bg-orange-950/10'
                    : job.riskTier === 'medium' ? 'border-yellow-900/30 bg-yellow-950/5'
                    : 'border-gray-800 bg-gray-900';

                  return (
                    <tr
                      key={job.id}
                      className={`border-b transition-colors hover:brightness-110 ${rowColour} ${
                        idx % 2 !== 0 ? 'brightness-[0.92]' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                        {job.primeUrl ? (
                          <a
                            href={job.primeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`underline underline-offset-2 ${
                              job.riskTier === 'critical' ? 'text-red-400 hover:text-red-300'
                              : job.riskTier === 'high'   ? 'text-orange-400 hover:text-orange-300'
                              : job.riskTier === 'medium' ? 'text-yellow-400 hover:text-yellow-300'
                              : 'text-gray-400 hover:text-gray-300'
                            }`}
                          >
                            {job.jobNumber}
                          </a>
                        ) : (
                          <span className="text-gray-400">{job.jobNumber}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-gray-300 text-xs max-w-[140px] truncate">{job.address}</td>
                      <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">{job.assignee}</td>
                      <td className="py-2 px-3 text-xs text-gray-400 max-w-[120px] truncate">{job.status}</td>
                      <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">{job.slaRule}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <DaysUntilBreachCell days={job.daysUntilBreach} />
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <RiskScoreBar score={job.riskScore} tier={job.riskTier} />
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap hidden md:table-cell">
                        {formatDate(job.predictedBreachDate)}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <RiskTierBadge tier={job.riskTier} />
                      </td>
                      <td className="py-2 px-3">
                        {job.primeUrl && (
                          <a
                            href={job.primeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-orange-400"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
