'use client';

/**
 * VisibilityTab — extracted from app/admin/page.tsx per Phase 3 D-20.
 *
 * Hosts the Phase 3 admin surfaces:
 *   - Top-of-tab Refresh Prime Users button + metadata strip (D-13)
 *   - Dashboard Admins picker (ADMIN-01) — replaces former email textarea
 *   - Group member editor (ADMIN-02) — chip-row + inline picker, replaces textarea
 *   - New Group form (ADMIN-03) — picker for initial members
 *   - Page Access matrix (unchanged from pre-Phase-3 admin page)
 *   - Existing Save bar + toast (verbatim from old page.tsx VisibilityTab)
 *
 * Identity rendering uses the D-15 cascade (resolveDisplayName / isUnresolvedEmail
 * / findPrimeUser) and surfaces ` · {division}` as the secondary suffix per
 * UI-SPEC §"Picker dropdown row" / §"Group member row". The VisibilityConfig blob
 * shape is unchanged (D-21): admins is string[], groups[].members is string[].
 *
 * On Prime outage (GET /api/admin/prime-users errors or returns empty users), each
 * picker instance receives `error={primeUsersError}` and displays the manual-email
 * fallback per D-12 — this is delivered by the picker; this file just wires the
 * error prop through.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Shield, Eye, Users,
  RefreshCw, Save, Plus, Trash2,
  CheckCircle, AlertCircle, Loader2,
  ChevronDown, ChevronRight, EyeOff, X,
} from 'lucide-react';
import { ALL_PAGES, type VisibilityConfig, type VisibilityGroup } from '@/lib/page-visibility';
import type { PrimeUser } from '@/lib/prime-users';
import { PrimeUserPicker } from '@/components/ui/PrimeUserPicker';
import { resolveDisplayName, isUnresolvedEmail, findPrimeUser } from '@/lib/identity-display';
import { formatRelative } from '@/lib/format-relative';

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

// ─── MemberRow (two-line chip) ─────────────────────────────────────────────────
//
// Used by both the Dashboard Admins list AND inside GroupCard for member rows.
// D-06 + D-08 + D-09 row pattern: line 1 primary identity (cascade), line 2 email
// + optional ` · {division}`. Unresolved emails suppress line 2 entirely and add
// the native title="No Prime record found" tooltip.

function MemberRow({
  email,
  primeUsers,
  onRemove,
}: {
  email: string;
  primeUsers: PrimeUser[];
  onRemove: () => void;
}) {
  const unresolved = isUnresolvedEmail(email, primeUsers);
  const displayName = resolveDisplayName(email, primeUsers, null);
  const user = findPrimeUser(email, primeUsers);
  return (
    <div
      className="flex items-start gap-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md"
      title={unresolved ? 'No Prime record found' : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-300 truncate">
          {displayName}
          {user && user.status !== 'active' && <span className="text-gray-500"> (inactive)</span>}
        </div>
        {!unresolved && (
          <div className="text-xs text-gray-500 truncate">
            {email}
            {user?.division && <span> · {user.division}</span>}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${email}`}
        className="text-gray-500 hover:text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500/40 rounded shrink-0 mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── RefreshButton + metadata strip (D-13) ─────────────────────────────────────

type RefreshState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; userCount: number; durationMs: number; cachedAt: string }
  | { kind: 'err'; error: string; lastSuccessAt: string | null };

function RefreshButton({
  onSuccess,
  lastSuccessAt,
}: {
  onSuccess: (users: PrimeUser[], meta: { lastSuccessAt: string | null; lastError: string | null }) => void;
  lastSuccessAt: string | null;
}) {
  const [status, setStatus] = useState<RefreshState>({ kind: 'idle' });

  async function handleClick() {
    setStatus({ kind: 'busy' });
    try {
      const res = await fetch('/api/admin/prime-users/refresh', { method: 'POST' });
      const body = await res.json();
      if (res.ok && body.ok) {
        setStatus({
          kind: 'ok',
          userCount: body.userCount,
          durationMs: body.durationMs,
          cachedAt: body.cachedAt,
        });
        // Re-fetch the picker list so the UI sees the new users immediately.
        try {
          const r2 = await fetch('/api/admin/prime-users');
          if (r2.ok) {
            const d = await r2.json();
            onSuccess(d.users || [], { lastSuccessAt: d.lastSuccessAt ?? null, lastError: d.lastError ?? null });
          }
        } catch {
          /* swallow secondary errors — primary refresh succeeded */
        }
      } else {
        setStatus({
          kind: 'err',
          error: body.error || 'Unknown error',
          lastSuccessAt: body.lastSuccessAt ?? null,
        });
      }
    } catch (e) {
      setStatus({
        kind: 'err',
        error: e instanceof Error ? e.message : 'Network error',
        lastSuccessAt: null,
      });
    }
  }

  const busy = status.kind === 'busy';

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 hover:text-white text-sm font-medium rounded-lg border border-gray-700 transition-colors"
        >
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
          {busy ? 'Refreshing…' : 'Refresh Prime Users'}
        </button>
      </div>
      {status.kind === 'ok' && (
        <p className="text-xs text-gray-500">
          Refreshed {status.userCount} users in {(status.durationMs / 1000).toFixed(1)}s · cached {formatRelative(status.cachedAt)}
        </p>
      )}
      {status.kind === 'idle' && lastSuccessAt && (
        <p className="text-xs text-gray-500">
          Cache last refreshed {formatRelative(lastSuccessAt)}
        </p>
      )}
      {status.kind === 'idle' && !lastSuccessAt && (
        <p className="text-xs text-gray-500">
          No Prime user cache yet — click Refresh to load.
        </p>
      )}
      {status.kind === 'err' && (
        <p className="text-xs text-amber-400">
          Prime unreachable — {status.lastSuccessAt
            ? `using cache from ${formatRelative(status.lastSuccessAt)}`
            : 'no cache available'}
        </p>
      )}
    </div>
  );
}

// ─── GroupCard (refactored: chip-row + inline picker) ──────────────────────────

function GroupCard({
  group,
  primeUsers,
  primeUsersError,
  primeUsersLoading,
  onRemove,
  onChangeMembers,
}: {
  group: VisibilityGroup;
  primeUsers: PrimeUser[];
  primeUsersError: string | null;
  primeUsersLoading: boolean;
  onRemove: () => void;
  onChangeMembers: (members: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/50">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded
            ? <ChevronDown size={13} className="text-gray-500 flex-shrink-0" />
            : <ChevronRight size={13} className="text-gray-500 flex-shrink-0" />}
          <span className="text-sm font-medium text-white">{group.label}</span>
          <span className="text-xs text-gray-500">
            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
          title="Remove group"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {expanded && (
        <div className="px-4 py-3 border-t border-gray-700 space-y-3">
          {group.members.length === 0 && !primeUsersError && (
            <p className="text-sm text-gray-600">No members. Use the picker below to add Prime users.</p>
          )}
          {group.members.length > 0 && (
            <div className="space-y-2">
              {group.members.map(email => (
                <MemberRow
                  key={email}
                  email={email}
                  primeUsers={primeUsers}
                  onRemove={() => onChangeMembers(group.members.filter(e => e !== email))}
                />
              ))}
            </div>
          )}
          <PrimeUserPicker
            selectedEmails={group.members}
            availableUsers={primeUsers}
            onChange={onChangeMembers}
            multi={true}
            error={primeUsersError}
            loading={primeUsersLoading}
            placeholder="Search Prime users by name, email, or division…"
            ariaLabel={`Add member to ${group.label}`}
          />
          <p className="text-xs text-gray-600">Group ID: <code className="text-gray-500">{group.id}</code></p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VisibilityTab (extracted main component)
// ══════════════════════════════════════════════════════════════════════════════

export function VisibilityTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<VisibilityConfig>(EMPTY_CONFIG);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [expandedPageGroups, setExpandedPageGroups] = useState<Set<string>>(() => new Set<string>());

  // New group form (members are picker-driven now: string[] not raw textarea string)
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);

  // Prime user directory (fetched in parallel with the visibility config)
  const [primeUsers, setPrimeUsers] = useState<PrimeUser[]>([]);
  const [primeUsersError, setPrimeUsersError] = useState<string | null>(null);
  const [primeUsersLoading, setPrimeUsersLoading] = useState(true);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/page-visibility');
      if (!res.ok) throw new Error('Failed to load');
      const data: VisibilityConfig = await res.json();
      setConfig(data);
    } catch {
      showToast('err', 'Failed to load visibility config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch the Prime user list on mount in parallel with the config load.
  useEffect(() => {
    let cancelled = false;
    setPrimeUsersLoading(true);
    fetch('/api/admin/prime-users')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`)))
      .then((d: { users: PrimeUser[]; lastSuccessAt: string | null; lastError: string | null }) => {
        if (cancelled) return;
        setPrimeUsers(d.users || []);
        setLastSuccessAt(d.lastSuccessAt);
        setPrimeUsersError(d.lastError);
      })
      .catch(() => {
        if (cancelled) return;
        setPrimeUsers([]);
        setPrimeUsersError('Prime directory unavailable');
      })
      .finally(() => { if (!cancelled) setPrimeUsersLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Defensive normalization — picker already emits lowercase emails, but
      // manual-fallback entries are normalized again here so blob writes stay
      // consistent with the project-wide email invariant (.trim().toLowerCase()).
      const admins = (config.admins || [])
        .map(e => e.trim().toLowerCase())
        .filter(e => e.includes('@'));

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
    const members = newGroupMembers
      .map(e => e.trim().toLowerCase())
      .filter(e => e.includes('@'));
    setConfig((c) => ({ ...c, groups: [...c.groups, { id, label, members }] }));
    setNewGroupLabel('');
    setNewGroupMembers([]);
  }

  function removeGroup(id: string) {
    setConfig((c) => ({
      ...c,
      groups: c.groups.filter((g) => g.id !== id),
      pages: c.pages.map((p) => ({ ...p, hiddenFrom: p.hiddenFrom.filter((gid) => gid !== id) })),
    }));
  }

  function updateGroupMembers(id: string, members: string[]) {
    const normalized = members.map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
    setConfig((c) => ({ ...c, groups: c.groups.map((g) => g.id === id ? { ...g, members: normalized } : g) }));
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
      {/* Refresh Prime Users — top-of-tab strip per D-13 */}
      <RefreshButton
        lastSuccessAt={lastSuccessAt}
        onSuccess={(users, meta) => {
          setPrimeUsers(users);
          setLastSuccessAt(meta.lastSuccessAt);
          setPrimeUsersError(meta.lastError);
        }}
      />

      {/* Save bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Control which pages each group can see. Admins always see everything.
        </p>
        <button
          type="button"
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
        <div className="p-5 space-y-3">
          {(config.admins?.length ?? 0) === 0 && !primeUsersError && (
            <p className="text-sm text-gray-600">No additional admins. The hardcoded admin fallback applies until you add one.</p>
          )}
          {(config.admins?.length ?? 0) > 0 && (
            <div className="space-y-2">
              {config.admins.map(email => (
                <MemberRow
                  key={email}
                  email={email}
                  primeUsers={primeUsers}
                  onRemove={() => setConfig(c => ({ ...c, admins: (c.admins || []).filter(a => a !== email) }))}
                />
              ))}
            </div>
          )}
          <PrimeUserPicker
            selectedEmails={config.admins || []}
            availableUsers={primeUsers}
            onChange={(emails) => setConfig(c => ({ ...c, admins: emails }))}
            multi={true}
            error={primeUsersError}
            loading={primeUsersLoading}
            placeholder="Search Prime users by name, email, or division…"
            ariaLabel="Add Dashboard Admin"
          />
          <p className="text-xs text-gray-600">
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
              primeUsers={primeUsers}
              primeUsersError={primeUsersError}
              primeUsersLoading={primeUsersLoading}
              onRemove={() => removeGroup(group.id)}
              onChangeMembers={(members) => updateGroupMembers(group.id, members)}
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
                <PrimeUserPicker
                  selectedEmails={newGroupMembers}
                  availableUsers={primeUsers}
                  onChange={setNewGroupMembers}
                  multi={true}
                  error={primeUsersError}
                  loading={primeUsersLoading}
                  placeholder="Search Prime users…"
                  ariaLabel="Add member to new group"
                />
              </div>
            </div>
            <button
              type="button"
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
                  type="button"
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
                                type="button"
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
