'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Briefcase,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
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
// Weather Alert Corner
// ─────────────────────────────────────────────────────────────────

function WeatherAlertCorner({ cities }: { cities: CityForecast[] }) {
  const severe = cities.filter(c => c.severity !== 'normal');
  if (severe.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-[260px]">
      {severe.map(city => (
        <div
          key={city.city}
          className={`rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-sm ${
            city.severity === 'warning'
              ? 'bg-red-950/90 border-red-600 shadow-red-900/40'
              : 'bg-orange-950/90 border-orange-600 shadow-orange-900/40'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle
              size={14}
              className={city.severity === 'warning' ? 'text-red-400' : 'text-orange-400'}
            />
            <span className={`text-xs font-bold uppercase tracking-wide ${
              city.severity === 'warning' ? 'text-red-300' : 'text-orange-300'
            }`}>
              {city.severity === 'warning' ? 'Weather Warning' : 'Weather Watch'}
            </span>
          </div>
          <p className="text-white text-sm font-semibold">
            {weatherEmoji(city.current.weatherCode)} {city.city} {city.state}
          </p>
          <p className={`text-xs mt-0.5 ${city.severity === 'warning' ? 'text-red-300' : 'text-orange-300'}`}>
            {city.alerts.join(' · ')}
          </p>
        </div>
      ))}
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
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent?: boolean;
  sub?: string;
  loading?: boolean;
}) {
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
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Status Bar (open jobs breakdown)
// ─────────────────────────────────────────────────────────────────

function StatusBreakdown({ counts, loading }: { counts: StatusCount[]; loading: boolean }) {
  const top = [...counts].sort((a, b) => b.count - a.count).slice(0, 8);
  const maxVal = top[0]?.count ?? 1;

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
      <p className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">Open Jobs by Status</p>
      <div className="space-y-2.5 flex-1">
        {top.map(s => (
          <div key={s.status} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-40 flex-shrink-0 truncate">{s.status}</span>
            <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-red-600 rounded transition-all"
                style={{ width: `${(s.count / maxVal) * 100}%` }}
              />
            </div>
            <span className="text-sm font-bold text-white w-8 text-right tabular-nums">{s.count}</span>
          </div>
        ))}
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
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [weather, setWeather] = useState<WeatherForecastResponse | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [kpiRes, countsRes, weatherRes] = await Promise.all([
        fetch('/api/prime/jobs/kpis'),
        fetch('/api/prime/jobs/counts-by-status'),
        fetch('/api/weather/forecast'),
      ]);

      if (kpiRes.ok) setKpis(await kpiRes.json());
      if (countsRes.ok) {
        const d: StatusCount[] = await countsRes.json();
        setCounts(Array.isArray(d) ? d.filter(s => s.statusType === 'Open') : []);
      }
      if (weatherRes.ok) setWeather(await weatherRes.json());
    } catch {
      // silently fail — will retry on next cycle
    } finally {
      setLoadingKpis(false);
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

  // Auto-refresh every 5 minutes
  useEffect(() => {
    intervalRef.current = setInterval(load, 5 * 60 * 1000);
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

        {/* Severe weather banner */}
        {severeWeather > 0 && weather && (
          <div className="flex items-center gap-3 bg-red-950/50 border border-red-700/50 rounded-xl px-5 py-3">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
            <p className="text-red-200 text-sm font-semibold">
              ⚠️ Severe weather in {severeWeather} state{severeWeather !== 1 ? 's' : ''} —
              increased claim volume expected. Monitor affected regions.
            </p>
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
          />
          <BigKpi
            label="Stuck >7 Days"
            value={kpis?.stuckOver7Days ?? '—'}
            icon={AlertTriangle}
            accent={(kpis?.stuckOver7Days ?? 0) > 0}
            loading={loadingKpis}
            sub="Open & not updated"
          />
          <BigKpi
            label="This Week"
            value={kpis?.createdThisWeek ?? '—'}
            icon={CheckCircle}
            loading={loadingKpis}
            sub="Jobs created"
          />
          <BigKpi
            label="This Month"
            value={kpis?.createdThisMonth ?? '—'}
            icon={Clock}
            loading={loadingKpis}
            sub="Jobs created"
          />
        </div>

        {/* Middle row: status breakdown + weather mini */}
        <div className="grid grid-cols-3 gap-4 flex-1">
          <div className="col-span-2">
            <StatusBreakdown counts={counts} loading={loadingCounts} />
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
          <p>Auto-refreshes every 5 minutes</p>
        </div>
      </div>

      {/* Floating weather alerts corner */}
      {weather && <WeatherAlertCorner cities={weather.cities} />}

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
