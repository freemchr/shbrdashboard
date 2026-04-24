'use client';

import { useEffect, useState } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, User } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface Weather {
  temp: number;
  description: string;
  code: number;
}

function WeatherIcon({ code, size = 16 }: { code: number; size?: number }) {
  // WMO weather codes: https://open-meteo.com/en/docs
  if (code === 0) return <Sun size={size} className="text-yellow-400" />;
  if (code <= 2) return <Cloud size={size} className="text-gray-400" />;
  if (code <= 3) return <Cloud size={size} className="text-gray-500" />;
  if (code <= 48) return <Cloud size={size} className="text-gray-400" />; // fog
  if (code <= 57) return <CloudRain size={size} className="text-blue-400" />; // drizzle
  if (code <= 67) return <CloudRain size={size} className="text-blue-400" />; // rain
  if (code <= 77) return <CloudSnow size={size} className="text-blue-200" />; // snow
  if (code <= 82) return <CloudRain size={size} className="text-blue-500" />; // showers
  if (code <= 86) return <CloudSnow size={size} className="text-blue-200" />; // snow showers
  if (code <= 99) return <CloudLightning size={size} className="text-yellow-400" />; // thunderstorm
  return <Wind size={size} className="text-gray-400" />;
}

function weatherDesc(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code <= 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Windy';
}

export function TopBar() {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<Weather | null>(null);
  const { primeUser, userEmail } = useAuth();
  // D-10: whitespace-defensive cascade. Treat empty / whitespace-only Prime
  // fullName as missing (Pitfall 5). One-liner per CONTEXT.md — no helper.
  const displayName = primeUser?.fullName?.trim() || userEmail;

  // Clock — tick every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Weather — fetch once on mount, refresh every 30 min
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Sydney coords: -33.8688, 151.2093
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=-33.8688&longitude=151.2093&current=temperature_2m,weather_code&timezone=Australia%2FSydney',
          { next: { revalidate: 1800 } }
        );
        const d = await res.json();
        const code = d.current.weather_code;
        setWeather({
          temp: Math.round(d.current.temperature_2m),
          description: weatherDesc(code),
          code,
        });
      } catch {
        // silently fail — weather is non-critical
      }
    };
    fetchWeather();
    const t = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Format in Sydney time (AEDT UTC+11 / AEST UTC+10)
  const sydneyTime = now.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const sydneyDate = now.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="flex items-center justify-between w-full gap-4 text-sm overflow-hidden">
      {/* Identity label — far-left slot, relocated post-Phase 2 with user icon prefix */}
      {/* UI-SPEC binding: text-gray-300 name (NOT brand red), max-w-[200px] truncate, gray icon */}
      {displayName && (
        <div className="flex items-center gap-1.5 max-w-[200px] text-gray-300">
          <User size={14} className="text-gray-500 flex-shrink-0" />
          <span className="truncate">{displayName}</span>
        </div>
      )}

      {/* Right cluster — weather, date, clock */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Weather */}
        {weather && (
          <div className="flex items-center gap-1.5 text-gray-400">
            <WeatherIcon code={weather.code} size={15} />
            <span className="font-mono text-white">{weather.temp}°C</span>
            <span className="hidden sm:inline text-gray-500">{weather.description}</span>
            <span className="text-gray-600 hidden sm:inline">· Sydney</span>
          </div>
        )}

        {/* Divider */}
        {weather && <div className="w-px h-4 bg-gray-700 hidden sm:block" />}

        {/* Date + Clock */}
        <div className="flex items-center gap-2 text-gray-400">
          <span className="hidden md:inline">{sydneyDate}</span>
          <span className="font-mono text-white tabular-nums">{sydneyTime}</span>
        </div>
      </div>
    </div>
  );
}
