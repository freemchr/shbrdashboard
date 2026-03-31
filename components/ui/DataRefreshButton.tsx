'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

// Auto-refresh intervals by page type:
// - 'operational' (1h)  — Job Board, Command Centre, SLA Tracker: jobs move status throughout the day
// - 'analytical'  (6h)  — SLA Predictor, Reports: data changes slowly, cache is 12h
// - 'weekly'      (off) — CAT Forecast, Weather: data is weekly/BOM-driven, auto-refresh is pointless
// - number              — custom ms value
export type RefreshMode = 'operational' | 'analytical' | 'weekly' | number;

const REFRESH_INTERVALS: Record<string, number> = {
  operational: 60 * 60 * 1000,       // 1 hour
  analytical:  6 * 60 * 60 * 1000,   // 6 hours
  weekly:      0,                     // disabled
};

function getIntervalMs(mode: RefreshMode): number {
  if (typeof mode === 'number') return mode;
  return REFRESH_INTERVALS[mode] ?? REFRESH_INTERVALS.operational;
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} mins ago`;
  const diffHrs = Math.floor(diffMins / 60);
  return diffHrs === 1 ? '1 hr ago' : `${diffHrs} hrs ago`;
}

interface DataRefreshButtonProps {
  mode?: RefreshMode;
  endpoint?: string; // optional specific cache endpoint to bust (defaults to full invalidate)
}

export function DataRefreshButton({ mode = 'operational', endpoint }: DataRefreshButtonProps = {}) {
  const [cacheDate, setCacheDate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [relativeTime, setRelativeTime] = useState<string>('loading…');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalMs = getIntervalMs(mode);

  // Fetch the real cache age from the server on mount
  const fetchCacheAge = useCallback(() => {
    fetch('/api/prime/cache/age')
      .then(r => r.ok ? r.json() : null)
      .then((d: { cachedAt?: number | null; rebuilding?: boolean } | null) => {
        if (d?.rebuilding) {
          // Cache is rebuilding — poll every 5s until it's ready
          setTimeout(fetchCacheAge, 5000);
        } else if (d?.cachedAt) {
          setCacheDate(new Date(d.cachedAt));
        } else {
          setCacheDate(new Date());
        }
      })
      .catch(() => setCacheDate(new Date()));
  }, []);

  useEffect(() => { fetchCacheAge(); }, [fetchCacheAge]);

  const doRefresh = useCallback(async (isAuto = false) => {
    if (refreshing) return;
    setRefreshing(true);
    setCacheDate(null);
    setRelativeTime('Fetching live data…');
    try {
      // 1. Invalidate blob + in-memory caches
      await fetch('/api/prime/cache/invalidate', { method: 'POST' });
      // 2. Trigger silent re-fetch on the page (passes ?bust=1 to skip in-memory)
      window.dispatchEvent(new CustomEvent('prime-cache-busted'));
      // 3. Poll cache/age until it returns a fresh timestamp — keep spinner going
      const started = Date.now();
      const poll = () => {
        fetch('/api/prime/cache/age')
          .then(r => r.ok ? r.json() : null)
          .then((d: { cachedAt?: number | null; rebuilding?: boolean } | null) => {
            const fresh = d?.cachedAt && d.cachedAt > started;
            if (fresh) {
              setCacheDate(new Date(d!.cachedAt!));
              setRefreshing(false);
            } else if (Date.now() - started < 90_000) {
              // Keep polling for up to 90s
              setTimeout(poll, 3000);
            } else {
              // Timeout — give up gracefully
              setRefreshing(false);
              fetchCacheAge();
            }
          })
          .catch(() => {
            setRefreshing(false);
            fetchCacheAge();
          });
      };
      setTimeout(poll, 3000); // first poll after 3s — give Prime time to respond
    } catch {
      setRefreshing(false);
    }
    if (isAuto) {
      console.log('[DataRefresh] Auto-refreshed at', new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney' }));
    }
  }, [refreshing, fetchCacheAge]);

  // Auto-refresh — disabled if intervalMs is 0 (weekly mode)
  // Only schedule if the cache will actually expire in the future — never fire immediately
  // for already-stale caches (avoids reload loop on page load)
  useEffect(() => {
    if (!intervalMs || !cacheDate) return;
    const elapsed = Date.now() - cacheDate.getTime();
    const remaining = intervalMs - elapsed;
    if (remaining <= 0) return; // already stale — don't auto-reload, let user decide
    timerRef.current = setTimeout(() => doRefresh(true), remaining);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [doRefresh, cacheDate, intervalMs]);

  // Update relative time label every minute
  useEffect(() => {
    if (!cacheDate) return;
    setRelativeTime(formatRelative(cacheDate));
    const t = setInterval(() => setRelativeTime(formatRelative(cacheDate)), 60_000);
    return () => clearInterval(t);
  }, [cacheDate]);

  const isStale = cacheDate ? (Date.now() - cacheDate.getTime()) > 8 * 60 * 60 * 1000 : false;

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs hidden sm:inline ${isStale ? 'text-amber-500' : 'text-gray-600'}`}
        title={cacheDate ? `Prime data cached at ${cacheDate.toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit' })}` : ''}>
        Data: {relativeTime}{isStale ? ' ⚠' : ''}
      </span>
      <button
        onClick={() => doRefresh(false)}
        disabled={refreshing}
        title={cacheDate ? `Prime data last refreshed ${formatRelative(cacheDate)} — click to refresh now` : 'Refresh data'}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
      </button>
    </div>
  );
}
