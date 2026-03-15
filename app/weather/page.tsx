'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Cloud, RefreshCw, AlertTriangle, Wind, Droplets, Thermometer } from 'lucide-react';
import type { WeatherForecastResponse, CityForecast, DailyForecast } from '@/app/api/weather/forecast/route';

// ─── Weather icon helper ──────────────────────────────────────────────────────
function getWeatherEmoji(code: number): string {
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

function getWeatherLabel(code: number): string {
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

// ─── Rain bar ─────────────────────────────────────────────────────────────────
function RainBar({ probability }: { probability: number }) {
  const colour =
    probability < 30 ? 'bg-green-500' :
    probability < 60 ? 'bg-yellow-500' :
    probability < 80 ? 'bg-orange-500' :
    'bg-red-500';

  return (
    <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden mt-1">
      <div
        className={`h-full rounded-full ${colour} transition-all`}
        style={{ width: `${Math.min(probability, 100)}%` }}
      />
    </div>
  );
}

// ─── Alert badges ─────────────────────────────────────────────────────────────
function AlertBadge({ alert }: { alert: string }) {
  const styles: Record<string, string> = {
    'Thunderstorm': 'bg-red-900/70 text-red-300 border border-red-700',
    'Showers/Storms': 'bg-orange-900/70 text-orange-300 border border-orange-700',
    'Heavy Rain Risk': 'bg-blue-900/70 text-blue-300 border border-blue-700',
    'High Activity Expected': 'bg-red-900/70 text-red-200 border border-red-600',
  };
  const icons: Record<string, string> = {
    'Thunderstorm': '🔴',
    'Showers/Storms': '⚠️',
    'Heavy Rain Risk': '🌧️',
    'High Activity Expected': '📈',
  };
  const cls = styles[alert] || 'bg-gray-800 text-gray-300 border border-gray-700';
  const icon = icons[alert] || '⚠️';

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cls}`}>
      <span>{icon}</span>
      {alert}
    </span>
  );
}

// ─── Severity border ─────────────────────────────────────────────────────────
function severityBorder(severity: string) {
  if (severity === 'warning') return 'border-red-600';
  if (severity === 'watch') return 'border-orange-500';
  return 'border-gray-800';
}

// ─── Daily strip item ─────────────────────────────────────────────────────────
function DayStrip({ day }: { day: DailyForecast }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
      <span className="text-xs text-gray-500 uppercase">{day.dayLabel}</span>
      <span className="text-lg">{getWeatherEmoji(day.weatherCode)}</span>
      <span className="text-xs text-white font-semibold">{day.tempMax}°</span>
      <span className="text-xs text-gray-500">{day.tempMin}°</span>
      <div className="w-full px-0.5">
        <RainBar probability={day.precipitationProbability} />
      </div>
      <span className="text-xs text-gray-600">{day.precipitationProbability}%</span>
    </div>
  );
}

// ─── City card ────────────────────────────────────────────────────────────────
function CityCard({ city }: { city: CityForecast }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-gray-900 rounded-xl border-2 ${severityBorder(city.severity)} overflow-hidden cursor-pointer transition-all hover:border-gray-600`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-lg">{city.city}</h3>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-mono">
                {city.state}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
              <div className="flex items-center gap-1">
                <Thermometer size={13} className="text-gray-500" />
                <span className="text-white font-semibold text-xl">{city.current.temp}°C</span>
              </div>
              <span className="text-gray-600">|</span>
              <div className="flex items-center gap-1">
                <Wind size={13} />
                <span>{city.current.windSpeed} km/h</span>
              </div>
              {city.current.precipitation > 0 && (
                <>
                  <span className="text-gray-600">|</span>
                  <div className="flex items-center gap-1">
                    <Droplets size={13} />
                    <span>{city.current.precipitation}mm</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="text-4xl">{getWeatherEmoji(city.current.weatherCode)}</div>
        </div>

        {/* Condition label */}
        <p className="text-xs text-gray-500 mb-3">{getWeatherLabel(city.current.weatherCode)}</p>

        {/* Alert badges */}
        {city.alerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {city.alerts.map(a => <AlertBadge key={a} alert={a} />)}
          </div>
        )}

        {/* 7-day strip */}
        <div className="flex gap-1 mt-2">
          {city.daily.map(day => <DayStrip key={day.date} day={day} />)}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 bg-gray-950">
          <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">7-Day Detail</p>
          <div className="space-y-2">
            {city.daily.map(day => (
              <div key={day.date} className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 w-8 flex-shrink-0">{day.dayLabel}</span>
                <span className="text-lg w-7 flex-shrink-0">{getWeatherEmoji(day.weatherCode)}</span>
                <span className="text-gray-400 flex-1 text-xs">{getWeatherLabel(day.weatherCode)}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-white font-semibold">{day.tempMax}°</span>
                  <span className="text-gray-600">/</span>
                  <span className="text-gray-400">{day.tempMin}°</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 w-20 flex-shrink-0">
                  <Droplets size={11} className="text-blue-400" />
                  <span>{day.precipitationProbability}%</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 w-20 flex-shrink-0">
                  <Wind size={11} />
                  <span>{day.windMax} km/h</span>
                </div>
                <div className="w-16 flex-shrink-0">
                  <RainBar probability={day.precipitationProbability} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-700 mt-3">Click card to collapse</p>
        </div>
      )}
    </div>
  );
}

// ─── Current conditions strip ─────────────────────────────────────────────────
function CurrentConditionsStrip({ cities }: { cities: CityForecast[] }) {
  return (
    <div className="overflow-x-auto pb-1 mb-6">
      <div className="flex gap-3 min-w-max">
        {cities.map(city => (
          <div
            key={city.city}
            className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 flex items-center gap-3 min-w-[160px]"
          >
            <span className="text-2xl">{getWeatherEmoji(city.current.weatherCode)}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white text-sm font-semibold">{city.city}</span>
                <span className="text-xs text-gray-600 font-mono">{city.state}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="text-white font-bold">{city.current.temp}°C</span>
                <span className="flex items-center gap-0.5">
                  <Wind size={11} />
                  {city.current.windSpeed}
                </span>
              </div>
            </div>
            {city.severity !== 'normal' && (
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${city.severity === 'warning' ? 'bg-red-500' : 'bg-orange-500'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WeatherPage() {
  const [data, setData] = useState<WeatherForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (bust = false) => {
    try {
      const url = bust ? '/api/weather/forecast?bust=1' : '/api/weather/forecast';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: WeatherForecastResponse = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const stormStates = data?.statesWithSevereWeather ?? 0;
  const severeStates = data?.cities.filter(c => c.severity !== 'normal').length ?? 0;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Weather Forecast"
        subtitle="7-day outlook across Australian states — storm and severe weather watch"
        actions={
          <div className="flex items-center gap-3">
            {data?.fetchedAt && (
              <span className="text-xs text-gray-500">
                Updated {new Date(data.fetchedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        }
      />

      {/* SHBR alert banner */}
      {!loading && (stormStates > 0 || severeStates > 1) && (
        <div className="mb-6 flex items-center gap-3 bg-red-950 border border-red-800 rounded-xl px-5 py-4">
          <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
          <div>
            <p className="text-red-200 font-semibold text-sm">
              ⚠️ Storm activity detected in {stormStates > 0 ? stormStates : severeStates} state{(stormStates || severeStates) !== 1 ? 's' : ''} —
              increased claim volume expected this week
            </p>
            <p className="text-red-400 text-xs mt-0.5">
              Monitor forecasts closely. Alert teams in affected regions.
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Cloud className="text-gray-600 animate-pulse" size={40} />
            <p className="text-gray-500 text-sm">Fetching weather data across Australia…</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-400 font-semibold">Failed to load weather data</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={() => load()}
            className="mt-4 px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg text-sm transition-all"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Data loaded */}
      {data && !loading && (
        <>
          {/* Current conditions strip */}
          <CurrentConditionsStrip cities={data.cities} />

          {/* City cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {data.cities.map(city => (
              <CityCard key={city.city} city={city} />
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-700">
            <p>Data sourced from Open-Meteo (open-meteo.com) — free & open-source weather API</p>
            <p>Click any card to expand 7-day detail</p>
          </div>
        </>
      )}
    </div>
  );
}
