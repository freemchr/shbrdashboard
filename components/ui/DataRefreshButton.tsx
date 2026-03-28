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
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [relativeTime, setRelativeTime] = useState('just now');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalMs = getIntervalMs(mode);

  const doRefresh = useCallback(async (isAuto = false) => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const url = endpoint
        ? `${endpoint}?bust=1`
        : '/api/prime/cache/invalidate';
      await fetch(url, { method: endpoint ? 'GET' : 'POST' });
      setLastRefreshed(new Date());
      window.location.reload();
    } catch {
      setRefreshing(false);
    }
    if (isAuto) {
      console.log('[DataRefresh] Auto-refreshed at', new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney' }));
    }
  }, [refreshing, endpoint]);

  // Auto-refresh — disabled if intervalMs is 0 (weekly mode)
  useEffect(() => {
    if (!intervalMs) return;
    timerRef.current = setTimeout(() => doRefresh(true), intervalMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [doRefresh, lastRefreshed, intervalMs]);

  // Update relative time label every minute
  useEffect(() => {
    setRelativeTime(formatRelative(lastRefreshed));
    const t = setInterval(() => setRelativeTime(formatRelative(lastRefreshed)), 60_000);
    return () => clearInterval(t);
  }, [lastRefreshed]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 hidden sm:inline">
        Data: {relativeTime}
      </span>
      <button
        onClick={() => doRefresh(false)}
        disabled={refreshing}
        title="Force refresh data"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
      </button>
    </div>
  );
}
