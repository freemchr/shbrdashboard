'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, RefreshCw, Download } from 'lucide-react';
import type { AuditEntry } from '@/lib/audit';

const ADMIN_EMAIL = 'chris.freeman@techgurus.com.au';

type ActionFilter = 'all' | 'login' | 'logout';
type RangeFilter = 'all' | 'today' | 'week';

function formatAEDT(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function ActionBadge({ action }: { action: string }) {
  if (action === 'login') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-400 border border-green-800">
        Login
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">
      Logout
    </span>
  );
}

function exportCSV(entries: AuditEntry[]) {
  const headers = ['Timestamp (AEDT)', 'Email', 'Name', 'Action'];
  const rows = entries.map(e => [
    formatAEDT(e.timestamp),
    e.email,
    e.name || '',
    e.action,
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('all');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (rangeFilter !== 'all') params.set('range', rangeFilter);

      const res = await fetch(`/api/audit/entries?${params}`);
      if (res.status === 404) {
        router.replace('/');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch entries');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, rangeFilter]);

  // Check session first — silently redirect non-admins
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.userEmail || data.userEmail.toLowerCase() !== ADMIN_EMAIL) {
          router.replace('/');
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        router.replace('/');
      });
  }, [router]);

  useEffect(() => {
    if (checking) return;
    fetchEntries();
  }, [checking, fetchEntries]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (checking) return;
    intervalRef.current = setInterval(fetchEntries, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checking, fetchEntries]);

  if (checking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-red-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Audit Log</h1>
            <p className="text-sm text-gray-500">Login and logout activity · Last 200 events</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchEntries}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => exportCSV(entries)}
            disabled={entries.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Action:</label>
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value as ActionFilter)}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-600"
          >
            <option value="all">All</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Date range:</label>
          <select
            value={rangeFilter}
            onChange={e => setRangeFilter(e.target.value as RangeFilter)}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-600"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
          </select>
        </div>
        <div className="ml-auto flex items-center">
          <span className="text-sm text-gray-500">
            {loading ? 'Loading...' : `${entries.length} entries`}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          Error: {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Timestamp (AEDT)
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-600">
                    No entries found
                  </td>
                </tr>
              )}
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">
                    {formatAEDT(entry.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-300 text-sm">{entry.name || entry.email}</div>
                    {entry.name && (
                      <div className="text-gray-600 text-xs">{entry.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={entry.action} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-700 text-center">
        Auto-refreshes every 60 seconds · Admin access only · Max 200 entries retained
      </p>
    </div>
  );
}
