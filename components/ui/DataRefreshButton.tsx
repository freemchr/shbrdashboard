'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

const AUTO_REFRESH_MS = 60 * 60 * 1000; // 1 hour

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} mins ago`;
  const diffHrs = Math.floor(diffMins / 60);
  return diffHrs === 1 ? '1 hr ago' : `${diffHrs} hrs ago`;
}

export function DataRefreshButton() {
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [relativeTime, setRelativeTime] = useState('just now');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doRefresh = useCallback(async (isAuto = false) => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // Invalidate the blob cache so all pages fetch fresh data
      await fetch('/api/prime/cache/invalidate', { method: 'POST' });
      setLastRefreshed(new Date());
      // Hard reload to re-fetch all server components with fresh data
      window.location.reload();
    } catch {
      // silently fail — not critical
      setRefreshing(false);
    }
    if (isAuto) {
      console.log('[DataRefresh] Auto-refreshed at', new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney' }));
    }
  }, [refreshing]);

  // Auto-refresh every hour
  useEffect(() => {
    timerRef.current = setTimeout(() => doRefresh(true), AUTO_REFRESH_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [doRefresh, lastRefreshed]);

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
