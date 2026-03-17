'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Briefcase,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Cloud,
  Wind,
  Thermometer,
  RefreshCw,
  Tv2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { WeatherForecastResponse, CityForecast } from '@/app/api/weather/forecast/route';
import type { TrendsResult } from '@/app/api/prime/jobs/trends/route';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface Kpis {
  totalJobs: number;
  openStatusCount: number;
  createdThisWeek: number;
  createdThisMonth: number;
  stuckOver7Days: number;
}

interface StatusCount {
  status: string;
  count: number;
  statusType: string;
}

// ─────────────────────────────────────────────────────────────────
// Trend delta helper
// ─────────────────────────────────────────────────────────────────

// "upIsGood" = true  → green when value goes up (e.g. jobs created — more work coming in)
// "upIsGood" = false → green when value goes down (e.g. stuck jobs, open backlog)
function TrendBadge({
  current,
  previous,
  upIsGood,
  label = 'week on week',
}: {
  current: number;
  previous: number;
  upIsGood: boolean;
  label?: string;
}) {
  if (previous === 0 && current === 0) return null;

  const diff = current - previous;
  const pct = previous > 0 ? Math.round(Math.abs(diff / previous) * 100) : null;

  const isUp   = diff > 0;
  const isDown = diff < 0;
  const flat   = diff === 0;

  // Determine colour: good = green, bad = red, flat = gray
  let colour = 'text-gray-500';
  if (!flat) {
    const good = (isUp && upIsGood) || (isDown && !upIsGood);
    colour = good ? 'text-emerald-400' : 'text-red-400';
  }

  const Icon = flat ? Minus : isUp ? TrendingUp : TrendingDown;
  const sign = isUp ? '+' : '';

  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${colour}`}>
      <Icon size={13} />
      <span>
        {flat ? 'No change' : `${sign}${diff}${pct !== null ? ` (${pct}%)` : ''}`}
      </span>
      <span className="text-gray-700 font-normal">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Weather helpers
// ─────────────────────────────────────────────────────────────────

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

function weatherLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow Showers';
  return 'Thunderstorm';
}

// ─────────────────────────────────────────────────────────────────
// Weather Ticker (scrolling strip)
// ─────────────────────────────────────────────────────────────────

function WeatherTicker({ cities }: { cities: CityForecast[] }) {
  // Build ticker items — include alert badge if severe
  const items = cities.map(c => {
    const alert = c.severity !== 'normal'
      ? ` ⚠️ ${c.alerts[0]}`
      : '';
    return `${weatherEmoji(c.current.weatherCode)} ${c.city} ${c.current.temp}°C · ${weatherLabel(c.current.weatherCode)} · ${c.current.windSpeed} km/h winds${alert}`;
  });
  const ticker = items.join('          •          ');

  return (
    <div className="bg-gray-900 border-b border-gray-800 overflow-hidden whitespace-nowrap">
      <div className="flex items-center">
        <div className="flex-shrink-0 bg-red-600 px-4 py-2 flex items-center gap-2 z-10">
          <Cloud size={14} className="text-white" />
          <span className="text-white text-xs font-bold tracking-widest uppercase">Weather</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="inline-block animate-marquee whitespace-nowrap text-gray-300 text-sm py-2 pl-6 pr-6">
            {ticker}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{ticker}
          </div>
        </div>
      </div>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────
// Big KPI Tile
// ─────────────────────────────────────────────────────────────────

function BigKpi({
  label,
  value,
  icon: Icon,
  accent,
  sub,
  loading,
  trendCurrent,
  trendPrevious,
  trendUpIsGood,
  trendLabel,
  trendLoading,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent?: boolean;
  sub?: string;
  loading?: boolean;
  trendCurrent?: number;
  trendPrevious?: number;
  trendUpIsGood?: boolean;
  trendLabel?: string;
  trendLoading?: boolean;
}) {
  const hasTrend = trendCurrent !== undefined && trendPrevious !== undefined && trendUpIsGood !== undefined;

  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col justify-between min-h-[160px] transition-all ${
        accent
          ? 'bg-red-950/40 border-red-700/60 shadow-lg shadow-red-950/40'
          : 'bg-gray-900 border-gray-800'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium uppercase tracking-wide ${accent ? 'text-red-300' : 'text-gray-400'}`}>
          {label}
        </span>
        <Icon size={20} className={accent ? 'text-red-400' : 'text-gray-600'} />
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="h-14 flex items-center">
            <div className="w-16 h-12 bg-gray-800 animate-pulse rounded-lg" />
          </div>
        ) : (
          <span className={`text-6xl font-bold tabular-nums tracking-tight ${accent ? 'text-red-400' : 'text-white'}`}>
            {value}
          </span>
        )}
        {sub && (
          <p className={`text-xs mt-2 ${accent ? 'text-red-400/70' : 'text-gray-600'}`}>{sub}</p>
        )}
        {/* Week-on-week trend */}
        <div className="mt-2 min-h-[18px]">
          {trendLoading ? (
            <div className="h-3 w-20 bg-gray-800 animate-pulse rounded" />
          ) : hasTrend ? (
            <TrendBadge
              current={trendCurrent!}
              previous={trendPrevious!}
              upIsGood={trendUpIsGood!}
              label={trendLabel ?? "week on week"}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Status Bar (open jobs breakdown)
// ─────────────────────────────────────────────────────────────────

function StatusDeltaPill({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return <span className="text-xs text-gray-700 w-16 text-right">no data</span>;

  const diff = current - previous;
  if (diff === 0) return (
    <span className="flex items-center gap-0.5 text-xs text-gray-600 w-16 justify-end">
      <Minus size={11} />
    </span>
  );

  const up = diff > 0;
  // Open job status counts going down = good (work being resolved)
  const colour = up ? 'text-red-400' : 'text-emerald-400';
  const Icon = up ? TrendingUp : TrendingDown;
  const sign = up ? '+' : '';

  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${colour} w-16 justify-end tabular-nums`}>
      <Icon size={11} />
      {sign}{diff}
    </span>
  );
}

function StatusBreakdown({
  counts,
  loading,
  statusDeltas,
  snapshotAge,
  trendsLoading,
}: {
  counts: StatusCount[];
  loading: boolean;
  statusDeltas?: Record<string, { current: number; previous: number | null }>;
  snapshotAge?: string | null;
  trendsLoading?: boolean;
}) {
  const top = [...counts].sort((a, b) => b.count - a.count).slice(0, 8);
  const maxVal = top[0]?.count ?? 1;

  // Format snapshot age into a human label
  const snapshotLabel = snapshotAge ? 'week on week' : null;

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <p className="text-sm text-gray-400 uppercase tracking-wide mb-4">Open Jobs by Status</p>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-800 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">Open Jobs by Status</p>
        {snapshotLabel && !trendsLoading && (
          <span className="text-xs text-gray-600">{snapshotLabel}</span>
        )}
        {trendsLoading && (
          <div className="h-3 w-16 bg-gray-800 animate-pulse rounded" />
        )}
      </div>
      <div className="space-y-2.5 flex-1">
        {top.map(s => {
          const delta = statusDeltas?.[s.status];
          return (
            <div key={s.status} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-40 flex-shrink-0 truncate">{s.status}</span>
              <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden">
                <div
                  className="h-full bg-red-600 rounded transition-all"
                  style={{ width: `${(s.count / maxVal) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-white w-8 text-right tabular-nums">{s.count}</span>
              {trendsLoading ? (
                <div className="h-3 w-10 bg-gray-800 animate-pulse rounded" />
              ) : delta ? (
                <StatusDeltaPill current={delta.current} previous={delta.previous} />
              ) : (
                <span className="w-16" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Weather Mini-Cards row
// ─────────────────────────────────────────────────────────────────

function WeatherRow({ cities }: { cities: CityForecast[] }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {cities.slice(0, 8).map(c => (
        <div
          key={c.city}
          className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
            c.severity === 'warning'
              ? 'bg-red-950/30 border-red-700/50'
              : c.severity === 'watch'
              ? 'bg-orange-950/20 border-orange-700/40'
              : 'bg-gray-900 border-gray-800'
          }`}
        >
          <span className="text-2xl leading-none">{weatherEmoji(c.current.weatherCode)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold text-sm">{c.city}</span>
              <span className="text-gray-600 text-xs font-mono">{c.state}</span>
              {c.severity !== 'normal' && (
                <span className={`w-1.5 h-1.5 rounded-full ${c.severity === 'warning' ? 'bg-red-500' : 'bg-orange-500'}`} />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
              <span className="text-white font-bold">{c.current.temp}°C</span>
              <span className="flex items-center gap-0.5">
                <Wind size={10} />
                {c.current.windSpeed}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Clock
// ─────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setDate(now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-right flex-shrink-0">
      <p className="text-4xl font-bold tabular-nums text-white leading-none">{time}</p>
      <p className="text-xs text-gray-500 mt-1">{date}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────

export default function CommandCentrePage() {
  return (
    <Suspense>
      <CommandCentreInner />
    </Suspense>
  );
}

function CommandCentreInner() {
  const searchParams = useSearchParams();
  const isKiosk = searchParams.get('kiosk') === '1';
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [trends, setTrends] = useState<TrendsResult | null>(null);
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [weather, setWeather] = useState<WeatherForecastResponse | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [kpiRes, trendsRes, countsRes, weatherRes] = await Promise.all([
        fetch('/api/prime/jobs/kpis'),
        fetch('/api/prime/jobs/trends'),
        fetch('/api/prime/jobs/counts-by-status'),
        fetch('/api/weather/forecast'),
      ]);

      if (kpiRes.ok) setKpis(await kpiRes.json());
      if (trendsRes.ok) setTrends(await trendsRes.json());
      if (countsRes.ok) {
        const d: StatusCount[] = await countsRes.json();
        setCounts(Array.isArray(d) ? d.filter(s => s.statusType === 'Open') : []);
      }
      if (weatherRes.ok) setWeather(await weatherRes.json());
    } catch {
      // silently fail — will retry on next cycle
    } finally {
      setLoadingKpis(false);
      setLoadingTrends(false);
      setLoadingCounts(false);
      setLoadingWeather(false);
      setLastRefresh(new Date());
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every hour
  useEffect(() => {
    intervalRef.current = setInterval(load, 60 * 60 * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const totalOpen = counts.reduce((sum, s) => sum + s.count, 0);
  const severeWeather = (weather?.cities ?? []).filter(c => c.severity !== 'normal').length;

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Weather ticker */}
      {!loadingWeather && weather && <WeatherTicker cities={weather.cities} />}
      {loadingWeather && (
        <div className="bg-gray-900 border-b border-gray-800 py-2 px-6">
          <div className="h-4 w-80 bg-gray-800 animate-pulse rounded" />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 p-6 flex flex-col gap-5">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 rounded-xl p-2.5">
              <Tv2 size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Command Centre</h1>
              <p className="text-xs text-gray-500 mt-0.5">SHBR Group — Live Operations Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            {/* Refresh + kiosk controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-400 hover:text-white transition-all disabled:opacity-50"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
              {lastRefresh && (
                <span className="text-xs text-gray-700">
                  Last update: {lastRefresh.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {!isKiosk && (
                <a
                  href="/command-centre?kiosk=1"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-xs text-white font-medium transition-all"
                  title="Enter TV Kiosk Mode — hides sidebar and topbar"
                >
                  <Maximize2 size={12} />
                  Kiosk Mode
                </a>
              )}
            </div>
            <LiveClock />
          </div>
        </div>

        {/* Severe weather tile */}
        {severeWeather > 0 && weather && (
          <div className="bg-red-950/30 border border-red-700/50 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
              <span className="text-red-300 text-sm font-bold uppercase tracking-wide">
                Active Weather Alerts — {severeWeather} region{severeWeather !== 1 ? 's' : ''}
              </span>
              <span className="text-red-400/50 text-xs ml-1">· Increased claim volume expected</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {weather.cities.filter(c => c.severity !== 'normal').map(city => (
                <div
                  key={city.city}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-sm ${
                    city.severity === 'warning'
                      ? 'bg-red-950/60 border-red-600/60 text-red-200'
                      : 'bg-orange-950/50 border-orange-600/50 text-orange-200'
                  }`}
                >
                  <span>{weatherEmoji(city.current.weatherCode)}</span>
                  <span className="font-semibold">{city.city} {city.state}</span>
                  <span className="text-xs opacity-70">{city.alerts[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Big KPI row */}
        <div className="grid grid-cols-5 gap-4">
          <BigKpi
            label="Total Jobs"
            value={kpis?.totalJobs ?? '—'}
            icon={TrendingUp}
            loading={loadingKpis}
            sub="All time"
          />
          <BigKpi
            label="Open Jobs"
            value={loadingCounts ? '—' : totalOpen}
            icon={Briefcase}
            loading={loadingCounts}
            sub="Currently active"
            trendCurrent={trends?.openNow}
            trendPrevious={trends?.openLastWeek}
            trendUpIsGood={false}
            trendLabel="week on week"
            trendLoading={loadingTrends}
          />
          <BigKpi
            label="Stuck >7 Days"
            value={kpis?.stuckOver7Days ?? '—'}
            icon={AlertTriangle}
            accent={(kpis?.stuckOver7Days ?? 0) > 0}
            loading={loadingKpis}
            sub="Open & not updated"
            trendCurrent={trends?.stuckNow}
            trendPrevious={trends?.stuckLastWeek}
            trendUpIsGood={false}
            trendLabel="week on week"
            trendLoading={loadingTrends}
          />
          <BigKpi
            label="This Week"
            value={kpis?.createdThisWeek ?? '—'}
            icon={CheckCircle}
            loading={loadingKpis}
            sub="Jobs created"
            trendCurrent={trends?.createdThisWeek}
            trendPrevious={trends?.createdLastWeek}
            trendUpIsGood={true}
            trendLabel="week on week"
            trendLoading={loadingTrends}
          />
          <BigKpi
            label="This Month"
            value={kpis?.createdThisMonth ?? '—'}
            icon={Clock}
            loading={loadingKpis}
            sub="Jobs created"
            trendCurrent={trends?.createdThisMonth}
            trendPrevious={trends?.createdLastMonth}
            trendUpIsGood={true}
            trendLabel="month on month"
            trendLoading={loadingTrends}
          />
        </div>

        {/* Middle row: status breakdown + weather mini */}
        <div className="grid grid-cols-3 gap-4 flex-1">
          <div className="col-span-2">
            <StatusBreakdown
              counts={counts}
              loading={loadingCounts}
              statusDeltas={trends?.statusDeltas}
              snapshotAge={trends?.snapshotAge}
              trendsLoading={loadingTrends}
            />
          </div>

          {/* Today's weather highlight */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Thermometer size={16} className="text-gray-500" />
              <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">Sydney Weather</p>
            </div>
            {loadingWeather ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-16 h-16 bg-gray-800 animate-pulse rounded-xl" />
              </div>
            ) : (() => {
              const syd = weather?.cities.find(c => c.city === 'Sydney');
              if (!syd) return <p className="text-gray-600 text-sm">No data</p>;
              return (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <span className="text-7xl leading-none">{weatherEmoji(syd.current.weatherCode)}</span>
                    <div>
                      <span className="text-5xl font-bold text-white">{syd.current.temp}°C</span>
                      <p className="text-gray-400 text-sm mt-1">{weatherLabel(syd.current.weatherCode)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500">Wind</p>
                      <p className="text-sm font-semibold text-white">{syd.current.windSpeed} km/h</p>
                    </div>
                    <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500">Today Hi/Lo</p>
                      <p className="text-sm font-semibold text-white">
                        {syd.daily[0]?.tempMax ?? '—'}° / {syd.daily[0]?.tempMin ?? '—'}°
                      </p>
                    </div>
                  </div>
                  {syd.alerts.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {syd.alerts.map(a => (
                        <span key={a} className="text-xs bg-red-900/50 text-red-300 border border-red-700/50 px-2 py-0.5 rounded-full">
                          ⚠️ {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Weather row — all states */}
        {!loadingWeather && weather && (
          <WeatherRow cities={weather.cities} />
        )}
        {loadingWeather && (
          <div className="grid grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-800 mt-auto">
          <p>SHBR Insights — Internal Use Only</p>
          <p>Auto-refreshes every hour</p>
        </div>
      </div>



      {/* Kiosk exit button — bottom-left, subtle */}
      {isKiosk && (
        <a
          href="/command-centre"
          className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900/80 hover:bg-gray-800 border border-gray-700 text-xs text-gray-500 hover:text-white transition-all backdrop-blur-sm"
          title="Exit Kiosk Mode"
        >
          <Minimize2 size={12} />
          Exit Kiosk
        </a>
      )}
    </div>
  );
}
