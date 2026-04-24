'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Shield, Eye, GitCommit, Users,
  RefreshCw, Download, Save, Plus, Trash2,
  CheckCircle, AlertCircle, Loader2,
  ChevronDown, ChevronRight,
  Sparkles, Wrench, ShieldCheck, Zap,
  ChevronUp, EyeOff,
} from 'lucide-react';
import type { AuditEntry } from '@/lib/audit';
import type { ChangelogDay, ChangelogEntry } from '@/app/api/changelog/route';
import { ALL_PAGES, VisibilityConfig, VisibilityGroup } from '@/lib/page-visibility';
import { useAuth } from '@/lib/auth-context';

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'visibility' | 'audit' | 'changelog';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'visibility', label: 'Page Visibility', icon: Eye },
  { id: 'audit',      label: 'Audit Log',       icon: Shield },
  { id: 'changelog',  label: 'Changelog',        icon: GitCommit },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const pageGroups = ALL_PAGES.reduce<Record<string, typeof ALL_PAGES>>((acc, p) => {
  const key = p.group || 'Standalone';
  if (!acc[key]) acc[key] = [];
  acc[key].push(p);
  return acc;
}, {});

const EMPTY_CONFIG: VisibilityConfig = { admins: [], groups: [], pages: [] };

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin } = useAuth();

  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    return (t === 'audit' || t === 'changelog' || t === 'visibility') ? t : 'visibility';
  });
  const [authChecked, setAuthChecked] = useState(false);

  // Auth gate — redirect non-admins
  useEffect(() => {
    if (!isAdmin && authChecked) {
      router.replace('/');
    }
  }, [isAdmin, authChecked, router]);

  useEffect(() => {
    // Wait for auth context to settle (AuthGuard sets it asynchronously)
    const timeout = setTimeout(() => setAuthChecked(true), 500);
    return () => clearTimeout(timeout);
  }, []);

  // Also do a server-side check as belt-and-suspenders
  useEffect(() => {
    fetch('/api/auth/session').then(res => {
      if (!res.ok) { router.replace('/login'); return; }
      return res.json();
    }).then(data => {
      if (data && !data.isAdmin) router.replace('/');
    }).catch(() => router.replace('/login'));
  }, [router]);

  function changeTab(t: Tab) {
    setTab(t);
    router.replace(`/admin?tab=${t}`, { scroll: false });
  }

  if (!isAdmin && authChecked) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield size={22} className="text-red-500" />
        <div>
          <h1 className="text-xl font-semibold text-white">Admin</h1>
          <p className="text-sm text-gray-500 mt-0.5">Dashboard administration — visible to admins only</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => changeTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === id
                ? 'text-white border-red-500'
                : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'visibility' && <VisibilityTab />}
        {tab === 'audit'      && <AuditTab />}
        {tab === 'changelog'  && <ChangelogTab />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VISIBILITY TAB
// ══════════════════════════════════════════════════════════════════════════════

function VisibilityTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<VisibilityConfig>(EMPTY_CONFIG);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [expandedPageGroups, setExpandedPageGroups] = useState<Set<string>>(() => new Set<string>());

  // New group form
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newGroupEmails, setNewGroupEmails] = useState('');

  // Admin emails textarea (comma/line separated)
  const [adminEmailsRaw, setAdminEmailsRaw] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/page-visibility');
      if (!res.ok) throw new Error('Failed to load');
      const data: VisibilityConfig = await res.json();
      setConfig(data);
      setAdminEmailsRaw((data.admins || []).join('\n'));
    } catch {
      showToast('err', 'Failed to load visibility config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Merge admin emails back in
      const admins = adminEmailsRaw
        .split(/[\n,]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes('@'));

      const payload: VisibilityConfig = { ...config, admins };

      const res = await fetch('/api/admin/page-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      setConfig(payload);
      showToast('ok', 'Saved — changes take effect within 1 minute');
    } catch {
      showToast('err', 'Failed to save config');
    } finally {
      setSaving(false);
    }
  }

  function addGroup() {
    const label = newGroupLabel.trim();
    if (!label) return;
    const id = slugify(label);
    if (config.groups.find((g) => g.id === id)) {
      showToast('err', 'A group with that name already exists');
      return;
    }
    const members = newGroupEmails
      .split(/[\n,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));
    setConfig((c) => ({ ...c, groups: [...c.groups, { id, label, members }] }));
    setNewGroupLabel('');
    setNewGroupEmails('');
  }

  function removeGroup(id: string) {
    setConfig((c) => ({
      ...c,
      groups: c.groups.filter((g) => g.id !== id),
      pages: c.pages.map((p) => ({ ...p, hiddenFrom: p.hiddenFrom.filter((gid) => gid !== id) })),
    }));
  }

  function updateGroupMembers(id: string, raw: string) {
    const members = raw.split(/[\n,]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'));
    setConfig((c) => ({ ...c, groups: c.groups.map((g) => g.id === id ? { ...g, members } : g) }));
  }

  function toggleGroupForPage(pagePath: string, pageLabel: string, groupId: string, hidden: boolean) {
    setConfig((c) => {
      const existing = c.pages.find((p) => p.path === pagePath);
      if (!existing) {
        if (!hidden) return c;
        return { ...c, pages: [...c.pages, { path: pagePath, label: pageLabel, hiddenFrom: [groupId] }] };
      }
      const updatedPages = c.pages.map((p) => {
        if (p.path !== pagePath) return p;
        const hiddenFrom = hidden
          ? Array.from(new Set([...p.hiddenFrom, groupId]))
          : p.hiddenFrom.filter((id) => id !== groupId);
        return { ...p, hiddenFrom };
      }).filter((p) => p.hiddenFrom.length > 0);
      return { ...c, pages: updatedPages };
    });
  }

  const isHiddenFrom = (pagePath: string, groupId: string): boolean => {
    const r = config.pages.find((p) => p.path === pagePath);
    return r ? r.hiddenFrom.includes(groupId) : false;
  };

  function togglePageSection(key: string) {
    setExpandedPageGroups((s) => {
      const next = new Set<string>(Array.from(s));
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Save bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Control which pages each group can see. Admins always see everything.
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          toast.type === 'ok'
            ? 'bg-green-950/60 border border-green-800 text-green-400'
            : 'bg-red-950/60 border border-red-800 text-red-400'
        }`}>
          {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* ── Dashboard Admins ──────────────────────────────────────────────────── */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
          <Shield size={15} className="text-red-400" />
          <h2 className="text-sm font-semibold text-white">Dashboard Admins</h2>
          <span className="text-xs text-gray-600 ml-1">Additional users who can see this admin area and all pages</span>
        </div>
        <div className="p-5">
          <label className="block text-xs text-gray-500 mb-1.5">
            Admin emails (one per line or comma separated). You are always an admin.
          </label>
          <textarea
            value={adminEmailsRaw}
            onChange={(e) => setAdminEmailsRaw(e.target.value)}
            rows={4}
            placeholder="admin@shbr.com.au&#10;manager@shbr.com.au"
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 resize-none font-mono"
          />
          <p className="text-xs text-gray-600 mt-1.5">
            Admins bypass all page restrictions and can access this admin panel.
            Changes take effect on next page load.
          </p>
        </div>
      </section>

      {/* ── Groups ─────────────────────────────────────────────────────────────── */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
          <Users size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-white">Groups</h2>
          <span className="text-xs text-gray-600 ml-1">{config.groups.length} defined</span>
        </div>
        <div className="p-5 space-y-3">
          {config.groups.length === 0 && (
            <p className="text-sm text-gray-600">No groups yet.</p>
          )}
          {config.groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onRemove={() => removeGroup(group.id)}
              onUpdateMembers={(raw) => updateGroupMembers(group.id, raw)}
            />
          ))}
          {/* Add group form */}
          <div className="border border-dashed border-gray-700 rounded-lg p-4 space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">New Group</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Group Name</label>
                <input
                  type="text"
                  value={newGroupLabel}
                  onChange={(e) => setNewGroupLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGroup()}
                  placeholder="e.g. Assessors"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Member Emails (optional)</label>
                <textarea
                  value={newGroupEmails}
                  onChange={(e) => setNewGroupEmails(e.target.value)}
                  placeholder="user@shbr.com.au"
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 resize-none"
                />
              </div>
            </div>
            <button
              onClick={addGroup}
              disabled={!newGroupLabel.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm rounded-md transition-colors"
            >
              <Plus size={14} />
              Add Group
            </button>
          </div>
        </div>
      </section>

      {/* ── Page Access ─────────────────────────────────────────────────────────── */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
          <Eye size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-white">Page Access</h2>
          <span className="text-xs text-gray-600 ml-1">
            {config.groups.length === 0 ? 'Add a group first' : 'Toggle which groups can see each page'}
          </span>
        </div>

        {config.groups.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-600">
            Add a group above to configure page access.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {Object.entries(pageGroups).map(([groupKey, pages]) => (
              <div key={groupKey}>
                <button
                  onClick={() => togglePageSection(groupKey)}
                  className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-gray-800/50 transition-colors"
                >
                  {expandedPageGroups.has(groupKey)
                    ? <ChevronDown size={13} className="text-gray-500" />
                    : <ChevronRight size={13} className="text-gray-500" />
                  }
                  <span className="text-sm font-medium text-gray-300">{groupKey}</span>
                  <span className="text-xs text-gray-600">({pages.length} pages)</span>
                </button>

                {expandedPageGroups.has(groupKey) && (
                  <div className="px-5 pb-3">
                    <div
                      className="grid text-xs text-gray-600 font-medium pb-2 border-b border-gray-800/60 mb-1"
                      style={{ gridTemplateColumns: `1fr repeat(${config.groups.length}, 90px)` }}
                    >
                      <span>Page</span>
                      {config.groups.map((g) => (
                        <span key={g.id} className="text-center truncate px-1">{g.label}</span>
                      ))}
                    </div>
                    {pages.map((page) => (
                      <div
                        key={page.path}
                        className="grid items-center py-1.5 rounded px-1 hover:bg-gray-800/30"
                        style={{ gridTemplateColumns: `1fr repeat(${config.groups.length}, 90px)` }}
                      >
                        <span className="text-sm text-gray-300">{page.label}</span>
                        {config.groups.map((g) => {
                          const hidden = isHiddenFrom(page.path, g.id);
                          return (
                            <div key={g.id} className="flex justify-center">
                              <button
                                onClick={() => toggleGroupForPage(page.path, page.label, g.id, !hidden)}
                                title={hidden
                                  ? `${g.label} cannot see this page — click to allow`
                                  : `${g.label} can see this page — click to hide`
                                }
                                className={`p-1.5 rounded transition-colors ${
                                  hidden
                                    ? 'text-red-500 bg-red-950/40 hover:bg-red-950/60'
                                    : 'text-green-500 bg-green-950/40 hover:bg-green-950/60'
                                }`}
                              >
                                {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {config.updatedAt && (
        <p className="text-xs text-gray-700 text-center pb-2">
          Last saved {new Date(config.updatedAt).toLocaleString('en-AU')}
          {config.updatedBy && ` by ${config.updatedBy}`}
        </p>
      )}
    </div>
  );
}

// ─── GroupCard ─────────────────────────────────────────────────────────────────

function GroupCard({ group, onRemove, onUpdateMembers }: {
  group: VisibilityGroup;
  onRemove: () => void;
  onUpdateMembers: (raw: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/50">
        <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {expanded ? <ChevronDown size={13} className="text-gray-500 flex-shrink-0" /> : <ChevronRight size={13} className="text-gray-500 flex-shrink-0" />}
          <span className="text-sm font-medium text-white">{group.label}</span>
          <span className="text-xs text-gray-500">{group.members.length} member{group.members.length !== 1 ? 's' : ''}</span>
        </button>
        <button onClick={onRemove} className="p-1 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0" title="Remove group">
          <Trash2 size={14} />
        </button>
      </div>
      {expanded && (
        <div className="px-4 py-3 border-t border-gray-700">
          <label className="block text-xs text-gray-500 mb-1.5">Member emails (one per line or comma separated)</label>
          <textarea
            value={group.members.join('\n')}
            onChange={(e) => onUpdateMembers(e.target.value)}
            rows={Math.max(3, Math.min(group.members.length + 1, 8))}
            className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 resize-none font-mono"
            placeholder="user@shbr.com.au"
          />
          <p className="text-xs text-gray-600 mt-1">Group ID: <code className="text-gray-500">{group.id}</code></p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT TAB
// ══════════════════════════════════════════════════════════════════════════════

type ActionFilter = 'all' | 'login' | 'logout';
type RangeFilter = 'all' | 'today' | 'week';

function formatAEDT(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

function ActionBadge({ action }: { action: string }) {
  if (action === 'login') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-400 border border-green-800">Login</span>;
  }
  if (action === 'prime_user_miss') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/50 text-amber-400 border border-amber-800">Miss</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">Logout</span>;
}

function exportCSV(entries: AuditEntry[]) {
  const headers = ['Timestamp (AEDT)', 'Email', 'Name', 'Action'];
  const rows = entries.map(e => [formatAEDT(e.timestamp), e.email, e.name || '', e.action]);
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

function AuditTab() {
  const router = useRouter();
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
          <button onClick={fetchEntries} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-all disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => exportCSV(entries)} disabled={entries.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-all disabled:opacity-50">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Action:</label>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value as ActionFilter)}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-600">
            <option value="all">All</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Date range:</label>
          <select value={rangeFilter} onChange={e => setRangeFilter(e.target.value as RangeFilter)}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-600">
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
              {entries.length === 0 && !loading && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-600">No entries found</td></tr>
              )}
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">{formatAEDT(entry.timestamp)}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-300 text-sm">{entry.name || entry.email}</div>
                    {entry.name && <div className="text-gray-600 text-xs">{entry.email}</div>}
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

// ══════════════════════════════════════════════════════════════════════════════
// CHANGELOG TAB
// ══════════════════════════════════════════════════════════════════════════════

const GITHUB_REPO = 'freemchr/shbrdashboard';

const TYPE_CONFIG: Record<ChangelogEntry['type'], { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
  feat:        { label: 'New Feature', icon: <Sparkles size={11} />,   bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20' },
  fix:         { label: 'Bug Fix',     icon: <Wrench size={11} />,     bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/20' },
  security:    { label: 'Security',    icon: <ShieldCheck size={11} />, bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/20' },
  improvement: { label: 'Improvement', icon: <Zap size={11} />,        bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  other:       { label: 'Update',      icon: <GitCommit size={11} />,  bg: 'bg-gray-500/10',   text: 'text-gray-400',   border: 'border-gray-500/20' },
};

function TypeBadge({ type }: { type: ChangelogEntry['type'] }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function DaySection({ day }: { day: ChangelogDay }) {
  const [open, setOpen] = useState(true);
  const featCount = day.entries.filter(e => e.type === 'feat').length;
  const fixCount  = day.entries.filter(e => e.type === 'fix').length;
  const secCount  = day.entries.filter(e => e.type === 'security').length;

  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-900 hover:bg-gray-800/80 transition-colors text-left">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">{day.label}</span>
          <div className="flex items-center gap-2">
            {featCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{featCount} new</span>}
            {fixCount > 0  && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{fixCount} fix{fixCount !== 1 ? 'es' : ''}</span>}
            {secCount > 0  && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{secCount} security</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <span className="text-xs">{day.entries.length} change{day.entries.length !== 1 ? 's' : ''}</span>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>
      {open && (
        <div className="divide-y divide-gray-800/60">
          {day.entries.map(entry => (
            <div key={entry.sha} className="flex items-start gap-3 px-5 py-3 bg-gray-950/40 hover:bg-gray-900/40 transition-colors">
              <div className={`mt-1 w-0.5 h-4 flex-shrink-0 rounded-full ${
                entry.type === 'feat' ? 'bg-blue-500' : entry.type === 'fix' ? 'bg-amber-500' :
                entry.type === 'security' ? 'bg-red-500' : entry.type === 'improvement' ? 'bg-purple-500' : 'bg-gray-600'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <TypeBadge type={entry.type} />
                  <span className="font-mono text-xs text-gray-600">{entry.sha}</span>
                </div>
                <p className="text-sm text-gray-200 leading-snug">{entry.title}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChangelogTab() {
  const router = useRouter();
  const [days, setDays] = useState<ChangelogDay[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ChangelogEntry['type'] | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/changelog');
      if (res.status === 401) { router.replace('/login'); return; }
      if (res.status === 404) { router.replace('/'); return; }
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      setDays(data.days || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all'
    ? days
    : days.map(d => ({ ...d, entries: d.entries.filter(e => e.type === filter) })).filter(d => d.entries.length > 0);

  const totalFeats = days.flatMap(d => d.entries).filter(e => e.type === 'feat').length;
  const totalFixes = days.flatMap(d => d.entries).filter(e => e.type === 'fix').length;
  const totalSec   = days.flatMap(d => d.entries).filter(e => e.type === 'security').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Every update pulled live from GitHub</p>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {!loading && !error && (
        <div className="flex flex-wrap gap-2">
          {([['all', `All · ${total}`, ''], ['feat', `✨ Features · ${totalFeats}`, 'blue'], ['fix', `🔧 Fixes · ${totalFixes}`, 'amber'], ...(totalSec > 0 ? [['security', `🔒 Security · ${totalSec}`, 'red']] : [])] as [string, string, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id as ChangelogEntry['type'] | 'all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filter === id ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
              }`}>{label}</button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-600">
          <RefreshCw size={18} className="animate-spin mr-2" />
          <span className="text-sm">Loading from GitHub...</span>
        </div>
      )}
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-600 text-sm">No entries match this filter.</div>
      )}
      {!loading && !error && (
        <div className="space-y-3">
          {filtered.map(day => <DaySection key={day.date} day={day} />)}
        </div>
      )}
      {!loading && !error && (
        <p className="text-xs text-gray-700 text-center">
          Sourced from{' '}
          <a href={`https://github.com/${GITHUB_REPO}/commits/main`} target="_blank" rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-400 underline underline-offset-2">
            github.com/{GITHUB_REPO}
          </a>
        </p>
      )}
    </div>
  );
}
