import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached, invalidateCache } from '@/lib/blob-cache';

export const runtime = 'nodejs';

interface LocationConfig {
  city: string;
  state: string;
  lat: number;
  lon: number;
  timezone: string;
}

const LOCATIONS: LocationConfig[] = [
  { city: 'Sydney', state: 'NSW', lat: -33.8688, lon: 151.2093, timezone: 'Australia/Sydney' },
  { city: 'Melbourne', state: 'VIC', lat: -37.8136, lon: 144.9631, timezone: 'Australia/Melbourne' },
  { city: 'Brisbane', state: 'QLD', lat: -27.4698, lon: 153.0251, timezone: 'Australia/Brisbane' },
  { city: 'Perth', state: 'WA', lat: -31.9505, lon: 115.8605, timezone: 'Australia/Perth' },
  { city: 'Adelaide', state: 'SA', lat: -34.9285, lon: 138.6007, timezone: 'Australia/Adelaide' },
  { city: 'Hobart', state: 'TAS', lat: -42.8821, lon: 147.3272, timezone: 'Australia/Hobart' },
  { city: 'Darwin', state: 'NT', lat: -12.4634, lon: 130.8456, timezone: 'Australia/Darwin' },
  { city: 'Canberra', state: 'ACT', lat: -35.2809, lon: 149.1300, timezone: 'Australia/Sydney' },
];

const CACHE_KEY = 'weather-forecast-v1';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export interface DailyForecast {
  date: string;
  dayLabel: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  precipitationProbability: number;
  windMax: number;
}

export interface CityForecast {
  city: string;
  state: string;
  timezone: string;
  current: {
    temp: number;
    weatherCode: number;
    windSpeed: number;
    precipitation: number;
  };
  daily: DailyForecast[];
  alerts: string[];
  severity: 'normal' | 'watch' | 'warning';
}

export interface WeatherForecastResponse {
  cities: CityForecast[];
  fetchedAt: string;
  statesWithSevereWeather: number;
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-AU', { weekday: 'short' });
}

function computeAlerts(daily: DailyForecast[]): { alerts: string[]; severity: 'normal' | 'watch' | 'warning' } {
  const alerts: string[] = [];
  let severity: 'normal' | 'watch' | 'warning' = 'normal';

  const hasThunderstorm = daily.some(d => d.weatherCode >= 95);
  const hasShowers = daily.some(d => d.weatherCode >= 80 && d.weatherCode < 95);
  const hasHeavyRain = daily.some(d => d.precipitationProbability >= 70);

  if (hasThunderstorm) {
    alerts.push('Thunderstorm');
    severity = 'warning';
  }
  if (hasShowers) {
    alerts.push('Showers/Storms');
    if (severity === 'normal') severity = 'watch';
  }
  if (hasHeavyRain) {
    alerts.push('Heavy Rain Risk');
    if (severity === 'normal') severity = 'watch';
  }

  // Count alert days for "High Activity Expected"
  const alertDays = daily.filter(d =>
    d.weatherCode >= 80 || d.precipitationProbability >= 70
  ).length;
  if (alertDays >= 3) {
    alerts.push('High Activity Expected');
  }

  return { alerts, severity };
}

async function fetchCityForecast(loc: LocationConfig): Promise<CityForecast> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,precipitation_probability_max&current=temperature_2m,weather_code,wind_speed_10m,precipitation&timezone=${loc.timezone}&forecast_days=7`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Open-Meteo API error for ${loc.city}: ${res.status}`);

  const data = await res.json();

  const daily: DailyForecast[] = data.daily.time.map((date: string, i: number) => ({
    date,
    dayLabel: getDayLabel(date),
    weatherCode: data.daily.weather_code[i],
    tempMax: Math.round(data.daily.temperature_2m_max[i]),
    tempMin: Math.round(data.daily.temperature_2m_min[i]),
    precipitationSum: data.daily.precipitation_sum[i] ?? 0,
    precipitationProbability: data.daily.precipitation_probability_max[i] ?? 0,
    windMax: Math.round(data.daily.wind_speed_10m_max[i] ?? 0),
  }));

  const { alerts, severity } = computeAlerts(daily);

  return {
    city: loc.city,
    state: loc.state,
    timezone: loc.timezone,
    current: {
      temp: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weather_code,
      windSpeed: Math.round(data.current.wind_speed_10m),
      precipitation: data.current.precipitation ?? 0,
    },
    daily,
    alerts,
    severity,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bust = searchParams.get('bust') === '1';

  if (bust) {
    await invalidateCache(CACHE_KEY);
  } else {
    const cached = await getCached<WeatherForecastResponse>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT' },
      });
    }
  }

  try {
    const cities = await Promise.all(LOCATIONS.map(fetchCityForecast));

    const statesWithSevereWeather = cities.filter(
      c => c.severity === 'warning' || c.alerts.includes('Thunderstorm')
    ).length;

    const result: WeatherForecastResponse = {
      cities,
      fetchedAt: new Date().toISOString(),
      statesWithSevereWeather,
    };

    await setCached(CACHE_KEY, result, CACHE_TTL);

    return NextResponse.json(result, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (err) {
    console.error('[weather/forecast] Error fetching weather data:', err);
    return NextResponse.json(
      { error: 'Failed to fetch weather data', detail: String(err) },
      { status: 500 }
    );
  }
}
