'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import { DataRefreshButton } from '@/components/ui/DataRefreshButton';
import {
  AlertTriangle,
  Zap,
  Thermometer,
  Droplets,
  Info,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import type { CATForecastResponse, StateCAT, BomWarning } from '@/app/api/weather/bom-warnings/route';

// ─── Animated counter ─────────────────────────────────────────────────────────
// Only fires after `enabled` flips true (i.e. data confirmed loaded). Safe for
// async fetches — no animation runs on SSR or during the loading state.

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

// ─── Spotlight hook ───────────────────────────────────────────────────────────
// Radial gradient that follows the mouse within a card div.
// 21st.dev easemize/spotlight-card pattern — zero deps, pure inline style.

function useSpotlightDiv() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const onMouseLeave = useCallback(() => setPos(null), []);

  const overlayStyle: React.CSSProperties = pos
    ? {
        background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, rgba(255,255,255,0.055), transparent 40%)`,
        pointerEvents: 'none',
      }
    : { pointerEvents: 'none' };

  return { ref, onMouseMove, onMouseLeave, overlayStyle };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateShort(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Australia/Sydney',
  });
}

function SeverityBadge({ severity }: { severity: BomWarning['severity'] }) {
  const styles: Record<BomWarning['severity'], string> = {
    Extreme:  'text-red-400 bg-red-500/10 border border-red-500/40',
    Severe:   'text-orange-400 bg-orange-500/10 border border-orange-500/40',
    Moderate: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30',
    Minor:    'text-gray-400 bg-gray-500/10 border border-gray-500/30',
    Unknown:  'text-gray-500 bg-gray-800 border border-gray-700',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function ConfidenceBadge({ level }: { level: StateCAT['confidenceLevel'] }) {
  const styles: Record<StateCAT['confidenceLevel'], string> = {
    high:   'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30',
    medium: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30',
    low:    'text-gray-400 bg-gray-500/10 border border-gray-500/20',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${styles[level]}`}>
      {level} confidence
    </span>
  );
}

// Gradient severity bar: green → yellow → orange → red via CSS linear-gradient
function SeverityBar({ score }: { score: number }) {
  const label       = score >= 80 ? 'Extreme' : score >= 60 ? 'High' : score >= 30 ? 'Moderate' : 'Low';
  const labelColour = score >= 80 ? 'text-red-400' : score >= 60 ? 'text-orange-400' : score >= 30 ? 'text-yellow-400' : 'text-green-400';

  // Gradient fill: always renders the full green→red spectrum, clipped to score%
  // This gives a richer visual than a single flat colour.
  const fillStyle: React.CSSProperties = {
    width: `${score}%`,
    background: 'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)',
    transition: 'width 0.6s ease',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Weather Severity</span>
        <span className={`text-xs font-semibold ${labelColour}`}>{label} ({score}/100)</span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={fillStyle} />
      </div>
    </div>
  );
}

// ─── State Card (Spotlight + pulse dot) ──────────────────────────────────────

function StateCard({
  state,
  enabled,
  generatedAt,
}: {
  state: StateCAT;
  enabled: boolean;
  generatedAt: string;
}) {
  const { ref, onMouseMove, onMouseLeave, overlayStyle } = useSpotlightDiv();

  const multiplierPct = Math.round((state.multiplier - 1) * 100);
  const hasWarnings   = state.activeWarnings.length > 0;

  const borderColour =
    state.weatherSeverityScore >= 80 ? 'border-red-700'
    : state.weatherSeverityScore >= 60 ? 'border-orange-600'
    : state.weatherSeverityScore >= 30 ? 'border-yellow-700'
    : 'border-gray-800';

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`relative overflow-hidden bg-gray-900 rounded-xl border-2 ${borderColour}`}
    >
      {/* Spotlight overlay */}
      <div className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300" style={overlayStyle} />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white font-bold text-lg">{state.state}</h3>
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-mono">
                  {state.city}
                </span>
                {/* Pulsing dot when active warnings present */}
                {hasWarnings && (
                  <span className="flex items-center gap-1">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                    <span className="text-xs text-red-400 font-medium">
                      {state.activeWarnings.length} warning{state.activeWarnings.length !== 1 ? 's' : ''}
                    </span>
                  </span>
                )}
                {state.fetchError && (
                  <span className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 px-2 py-0.5 rounded-full">
                    Feed Error
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Thermometer size={12} className="text-gray-500" />
                  Max {state.tempMax}°C
                </span>
                <span className="text-gray-700">|</span>
                <span className="flex items-center gap-1">
                  <Droplets size={12} className="text-blue-400" />
                  {state.precipProbability}% rain
                </span>
              </div>
            </div>

            {/* Animated predicted jobs */}
            <div className="text-right flex-shrink-0 ml-2">
              <p className={`text-2xl font-bold tabular-nums ${
                state.predictedJobsThisWeek > 60 ? 'text-red-400'
                : state.predictedJobsThisWeek > 50 ? 'text-orange-400'
                : 'text-white'
              }`}>
                ~<AnimatedCounter
                  key={`${state.state}-jobs-${generatedAt}`}
                  value={state.predictedJobsThisWeek}
                  enabled={enabled}
                />
              </p>
              <p className="text-xs text-gray-500">jobs predicted</p>
              {multiplierPct > 0 && (
                <p className={`text-xs font-semibold mt-0.5 ${
                  multiplierPct >= 50 ? 'text-red-400'
                  : multiplierPct >= 20 ? 'text-orange-400'
                  : 'text-yellow-400'
                }`}>
                  +{multiplierPct}% above baseline
                </p>
              )}
            </div>
          </div>

          {/* Gradient severity bar */}
          <div className="mb-4">
            <SeverityBar score={state.weatherSeverityScore} />
          </div>

          {/* Confidence */}
          <ConfidenceBadge level={state.confidenceLevel} />

          {/* Weather alert chips */}
          {state.weatherAlerts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {state.weatherAlerts.map(alert => (
                <span
                  key={alert}
                  className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700"
                >
                  {alert}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* BOM Warnings */}
        <div className="p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-3">
            Active BOM Warnings
          </p>
          {state.activeWarnings.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No active severe warnings</p>
          ) : (
            <div className="space-y-2">
              {state.activeWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <SeverityBadge severity={w.severity} />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-300 truncate">{w.title}</p>
                    {w.event && <p className="text-xs text-gray-500">{w.event}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CATForecastPage() {
  const [data, setData]         = useState<CATForecastResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  // dataLoaded: only true after successful API response — gates AnimatedCounter
  const [dataLoaded, setDataLoaded] = useState(false);
  // Sort state — declared here (before early returns) to satisfy Rules of Hooks
  type SortKey = 'state' | 'predictedJobsThisWeek' | 'weatherSeverityScore' | 'activeWarnings' | 'multiplier';
  const [sortKey, setSortKey] = useState<SortKey>('predictedJobsThisWeek');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    fetch('/api/weather/bom-warnings')
      .then(r =>
        r.ok
          ? r.json()
          : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? 'Failed'))
      )
      .then((d: CATForecastResponse) => {
        setData(d);
        setDataLoaded(true); // ← animation gate: only open on confirmed success
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Fetching BOM warnings and weather forecasts…" />;
  if (error)   return <ErrorMessage message={error} />;
  if (!data)   return null;

  const hasActiveWarnings = data.activeWarningCount > 0;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedStates = [...data.states].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    if (sortKey === 'state') { av = a.state; bv = b.state; }
    else if (sortKey === 'activeWarnings') { av = a.activeWarnings.length; bv = b.activeWarnings.length; }
    else { av = a[sortKey] as number; bv = b[sortKey] as number; }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown size={13} className="text-gray-600" />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-red-400" />
      : <ChevronDown size={13} className="text-red-400" />;
  }

  return (
    <div>
      <PageHeader
        title="CAT Demand Forecasting"
        subtitle="Predicted claim volume based on BOM severe weather warnings & 14-day forecasts"
        actions={<DataRefreshButton />}
      />

      {/* Active warnings alert banner */}
      {hasActiveWarnings && (
        <div className="mb-6 flex items-start gap-3 bg-red-950/40 border border-red-700/50 rounded-xl px-5 py-4">
          <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold text-sm">
              {data.activeWarningCount} active BOM severe weather warning{data.activeWarningCount !== 1 ? 's' : ''} detected
            </p>
            <p className="text-red-400/70 text-xs mt-0.5">
              Elevated claim volume expected. Ensure teams in affected regions are prepared.
            </p>
          </div>
        </div>
      )}

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total predicted jobs — animated */}
        <div className={`rounded-xl border p-5 col-span-2 lg:col-span-1 ${
          data.totalPredictedJobs > 60
            ? 'border-red-700/60 bg-red-950/20'
            : 'border-gray-800 bg-gray-900'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">Total Predicted Jobs</span>
            <Zap size={16} className={data.totalPredictedJobs > 60 ? 'text-red-400' : 'text-gray-400'} />
          </div>
          <p className={`text-3xl font-bold tabular-nums ${
            data.totalPredictedJobs > 60 ? 'text-red-400' : 'text-white'
          }`}>
            ~<AnimatedCounter
              key={`total-${data.fetchedAt}`}
              value={data.totalPredictedJobs}
              enabled={dataLoaded}
            />
          </p>
          <p className="text-xs text-gray-500 mt-1">This week across all states</p>
        </div>

        {/* Active warnings */}
        <div className={`rounded-xl border p-5 ${
          hasActiveWarnings
            ? 'border-red-700/50 bg-red-950/10'
            : 'border-gray-800 bg-gray-900'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${hasActiveWarnings ? 'text-red-300' : 'text-gray-400'}`}>
              Active Warnings
            </span>
            <AlertTriangle size={16} className={hasActiveWarnings ? 'text-red-400' : 'text-gray-500'} />
          </div>
          <p className={`text-3xl font-bold tabular-nums ${hasActiveWarnings ? 'text-red-400' : 'text-gray-400'}`}>
            <AnimatedCounter
              key={`warnings-${data.fetchedAt}`}
              value={data.activeWarningCount}
              enabled={dataLoaded}
            />
          </p>
          <p className="text-xs text-gray-500 mt-1">BOM severe warnings</p>
        </div>

        {/* Highest risk state */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">Highest Risk</span>
            <Thermometer size={16} className="text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-orange-400">{data.highestRiskState}</p>
          <p className="text-xs text-gray-500 mt-1">Most severe weather activity</p>
        </div>

        {/* Last updated */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">Last Refreshed</span>
            <Info size={16} className="text-gray-500" />
          </div>
          <p className="text-sm font-semibold text-gray-300 mt-1">{formatDateShort(data.fetchedAt)}</p>
          <p className="text-xs text-gray-600 mt-1">Updates weekly</p>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-gray-500 mr-1">Sort by:</span>
        {([
          { key: 'predictedJobsThisWeek', label: 'Predicted Jobs' },
          { key: 'weatherSeverityScore',  label: 'Severity Score' },
          { key: 'activeWarnings',        label: 'Active Warnings' },
          { key: 'multiplier',            label: 'Multiplier' },
          { key: 'state',                 label: 'State' },
        ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              sortKey === key
                ? 'bg-red-600 border-red-500 text-white'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
            }`}
          >
            {label}
            <SortIcon col={key} />
          </button>
        ))}
      </div>

      {/* Single-column state cards */}
      <div className="flex flex-col gap-4">
        {sortedStates.map(state => (
          <StateCard
            key={state.state}
            state={state}
            enabled={dataLoaded}
            generatedAt={data.fetchedAt}
          />
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-6 flex items-center gap-2 text-xs text-gray-600">
        <Info size={12} />
        <span>
          Baseline of 45 jobs/week — refine as historical data accumulates.{' '}
          Next weekly refresh: {formatDateShort(data.nextRefreshAt)}.
        </span>
      </div>
    </div>
  );
}
