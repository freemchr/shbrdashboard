'use client';

/**
 * Admin → Audit Log tab.
 *
 * Extracted from app/admin/page.tsx in Phase 03 Plan 03-05 (D-20). This file
 * owns the audit-entries table, its filters, the 60s auto-refresh interval,
 * and the CSV export. Identity rendering uses the D-15 three-step cascade
 * (live Prime fullName → entry.name cookie-snapshot → bare email) via
 * `resolveDisplayName` from `lib/identity-display.ts` (Plan 03-01) so each
 * row's actor reflects what the admin sees in the directory today, with a
 * graceful fall-through when a user has left Prime or the picker fetch fails.
 *
 * Notable contracts:
 * - D-14: Parallel fetch of /api/admin/prime-users on mount feeds the cascade
 *   without adding any per-row latency or new server-side join.
 * - D-15: One call site for resolveDisplayName drives both the visible row
 *   AND the CSV export — the CSV always reflects what the admin saw on screen.
 * - D-16: prime_user_miss rows expose entry.detail as a native `title`
 *   tooltip on the actor cell (kept native per Claude's Discretion in CONTEXT).
 * - D-17: CSV header "Name" was renamed to "Display Name"; the inline CSV
 *   writer was retired in favour of the shared `lib/export-csv.ts:downloadCSV`
 *   helper used elsewhere in the dashboard.
 * - D-22: lib/audit.ts schema is unchanged — this is a render-side change.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Download, Loader2 } from 'lucide-react';
import type { AuditEntry } from '@/lib/audit';
import type { PrimeUser } from '@/lib/prime-users';
import { resolveDisplayName } from '@/lib/identity-display';
import { downloadCSV } from '@/lib/export-csv';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionFilter = 'all' | 'login' | 'logout';
type RangeFilter = 'all' | 'today' | 'week';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format ISO timestamp as AEDT 24h "DD/MM/YYYY, HH:MM:SS" via en-AU locale. */
function formatAEDT(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

/** Coloured pill: Login (green) / Miss (amber) / Logout (gray). */
function ActionBadge({ action }: { action: string }) {
  if (action === 'login') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-400 border border-green-800">Login</span>;
  }
  if (action === 'prime_user_miss') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/50 text-amber-400 border border-amber-800">Miss</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">Logout</span>;
}

/**
 * D-17 — Display Name column rename + downloadCSV consolidation.
 *
 * Cascade matches the on-screen render: live Prime fullName → entry.name
 * (cookie-snapshot) → bare email. Exported so the co-located Vitest can
 * exercise the cascade integration without a DOM environment.
 */
export function exportAuditCSV(entries: AuditEntry[], primeUsers: PrimeUser[]) {
  const headers = ['Timestamp (AEDT)', 'Email', 'Display Name', 'Action'];
  const rows = entries.map(e => [
    formatAEDT(e.timestamp),
    e.email,
    resolveDisplayName(e.email, primeUsers, e.name ?? null),
    e.action,
  ]);
  downloadCSV(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AuditTab() {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [primeUsers, setPrimeUsers] = useState<PrimeUser[]>([]);
  const [loading, setLoading] = useState(false);
  // D-14 + Pitfall 6 — gate the first render so we don't flash bare emails
  // for ~100ms before the picker list resolves.
  const [primeUsersLoading, setPrimeUsersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('all');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audit-entries fetch — preserved verbatim from the previous in-page AuditTab.
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (rangeFilter !== 'all') params.set('range', rangeFilter);
      const res = await fetch(`/api/audit/entries?${params}`);
      if (res.status === 401) { router.replace('/login'); return; }
      if (res.status === 404) { router.replace('/'); return; }
      if (!res.ok) throw new Error('Failed to fetch entries');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, rangeFilter, router]);

  // D-14 — parallel fetch for the picker list on mount. The cascade falls
  // through to entry.name + email if this fetch fails, so we don't propagate
  // the error visibly; we just unblock the table render.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/prime-users')
      .then(r => r.ok ? r.json() : { users: [] })
      .then((d: { users?: PrimeUser[] }) => {
        if (!cancelled) setPrimeUsers(d.users || []);
      })
      .catch(() => { if (!cancelled) setPrimeUsers([]); })
      .finally(() => { if (!cancelled) setPrimeUsersLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => {
    intervalRef.current = setInterval(fetchEntries, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchEntries]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">Login and logout activity · Last 200 events · Auto-refreshes every 60s</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchEntries}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => exportAuditCSV(entries, primeUsers)}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-all disabled:opacity-50"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Action:</label>
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
          <label className="text-xs text-gray-500">Date range:</label>
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
          <span className="text-xs text-gray-500">{loading ? 'Loading...' : `${entries.length} entries`}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400 text-sm">Error: {error}</div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Timestamp (AEDT)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {(primeUsersLoading || loading) && entries.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-600">
                    <Loader2 size={20} className="animate-spin inline-block mr-2 align-middle" />
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && !primeUsersLoading && entries.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-600">No entries found</td></tr>
              )}
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">{formatAEDT(entry.timestamp)}</td>
                  <td
                    className="px-4 py-3"
                    title={entry.action === 'prime_user_miss' ? (entry.detail || 'No detail') : undefined}
                  >
                    <div className="text-sm text-gray-300">
                      {resolveDisplayName(entry.email, primeUsers, entry.name ?? null)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {entry.email}
                    </div>
                  </td>
                  <td className="px-4 py-3"><ActionBadge action={entry.action} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
