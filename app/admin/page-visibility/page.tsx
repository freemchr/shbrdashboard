'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Plus, Trash2, Save, Users, Eye, EyeOff,
  CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { ALL_PAGES, VisibilityConfig, VisibilityGroup } from '@/lib/page-visibility';

// ── Defaults ──────────────────────────────────────────────────────────────────

const EMPTY_CONFIG: VisibilityConfig = { groups: [], pages: [] };

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Group pages by their nav group label
const pageGroups = ALL_PAGES.reduce<Record<string, typeof ALL_PAGES>>((acc, p) => {
  const key = p.group || 'Standalone';
  if (!acc[key]) acc[key] = [];
  acc[key].push(p);
  return acc;
}, {});

// ── Component ─────────────────────────────────────────────────────────────────

export default function PageVisibilityAdmin() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<VisibilityConfig>(EMPTY_CONFIG);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set<string>());

  // New group form
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newGroupEmails, setNewGroupEmails] = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Check admin
      const sessionRes = await fetch('/api/auth/session');
      if (!sessionRes.ok) { router.replace('/login'); return; }
      const session = await sessionRes.json();
      if (!session.isAdmin) { router.replace('/'); return; }

      const res = await fetch('/api/admin/page-visibility');
      if (!res.ok) throw new Error('Failed to load config');
      const data: VisibilityConfig = await res.json();
      setConfig(data);
    } catch {
      showToast('err', 'Failed to load visibility config');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/page-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Save failed');
      showToast('ok', 'Visibility config saved');
    } catch {
      showToast('err', 'Failed to save config');
    } finally {
      setSaving(false);
    }
  }

  // ── Group management ──────────────────────────────────────────────────────

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

    setConfig((c) => ({
      ...c,
      groups: [...c.groups, { id, label, members }],
    }));
    setNewGroupLabel('');
    setNewGroupEmails('');
  }

  function removeGroup(id: string) {
    setConfig((c) => ({
      ...c,
      groups: c.groups.filter((g) => g.id !== id),
      // Also remove this group from all page restrictions
      pages: c.pages.map((p) => ({
        ...p,
        hiddenFrom: p.hiddenFrom.filter((gid) => gid !== id),
      })),
    }));
  }

  function updateGroupMembers(id: string, raw: string) {
    const members = raw
      .split(/[\n,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));
    setConfig((c) => ({
      ...c,
      groups: c.groups.map((g) => g.id === id ? { ...g, members } : g),
    }));
  }

  // ── Page restriction management ───────────────────────────────────────────

  function toggleGroupForPage(pagePath: string, pageLabel: string, groupId: string, hidden: boolean) {
    setConfig((c) => {
      const existing = c.pages.find((p) => p.path === pagePath);
      if (!existing) {
        // Create a new restriction for this page
        if (!hidden) return c; // nothing to do
        return {
          ...c,
          pages: [...c.pages, { path: pagePath, label: pageLabel, hiddenFrom: [groupId] }],
        };
      }

      const updatedPages = c.pages.map((p) => {
        if (p.path !== pagePath) return p;
        const hiddenFrom = hidden
          ? Array.from(new Set([...p.hiddenFrom, groupId]))
          : p.hiddenFrom.filter((id) => id !== groupId);
        return { ...p, hiddenFrom };
      }).filter((p) => p.hiddenFrom.length > 0); // remove empty restrictions

      return { ...c, pages: updatedPages };
    });
  }

  const isHiddenFrom = (pagePath: string, groupId: string): boolean => {
    const r = config.pages.find((p) => p.path === pagePath);
    return r ? r.hiddenFrom.includes(groupId) : false;
  };

  // ── Expand/collapse page group sections ───────────────────────────────────

  function toggleSection(key: string) {
    setExpandedGroups((s) => {
      const next = new Set<string>(Array.from(s));
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 size={24} className="animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={22} className="text-red-500" />
          <div>
            <h1 className="text-xl font-semibold text-white">Page Visibility</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Control which pages are hidden from specific groups of users.
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm
          ${toast.type === 'ok'
            ? 'bg-green-950/60 border border-green-800 text-green-400'
            : 'bg-red-950/60 border border-red-800 text-red-400'
          }`}
        >
          {toast.type === 'ok'
            ? <CheckCircle size={15} />
            : <AlertCircle size={15} />
          }
          {toast.msg}
        </div>
      )}

      {/* ── Groups ───────────────────────────────────────────────────────────── */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
          <Users size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-white">Groups</h2>
          <span className="text-xs text-gray-600 ml-1">
            {config.groups.length} defined
          </span>
        </div>

        <div className="p-5 space-y-4">
          {config.groups.length === 0 && (
            <p className="text-sm text-gray-600">No groups yet. Add one below.</p>
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
                  placeholder="e.g. Assessors"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Member Emails (comma or line separated)</label>
                <textarea
                  value={newGroupEmails}
                  onChange={(e) => setNewGroupEmails(e.target.value)}
                  placeholder="user@shbr.com.au, another@shbr.com.au"
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

      {/* ── Page Restrictions ─────────────────────────────────────────────────── */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
          <Eye size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-white">Page Access</h2>
          <span className="text-xs text-gray-600 ml-1">
            Toggle which pages each group can see
          </span>
        </div>

        {config.groups.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-600">
            Add a group above before configuring page access.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {Object.entries(pageGroups).map(([groupKey, pages]) => (
              <div key={groupKey}>
                <button
                  onClick={() => toggleSection(groupKey)}
                  className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-gray-800/50 transition-colors"
                >
                  {expandedGroups.has(groupKey)
                    ? <ChevronDown size={14} className="text-gray-500" />
                    : <ChevronRight size={14} className="text-gray-500" />
                  }
                  <span className="text-sm font-medium text-gray-300">{groupKey}</span>
                  <span className="text-xs text-gray-600">({pages.length} pages)</span>
                </button>

                {expandedGroups.has(groupKey) && (
                  <div className="px-5 pb-3 space-y-1">
                    {/* Header row */}
                    <div className="grid text-xs text-gray-600 font-medium pb-1"
                      style={{ gridTemplateColumns: `1fr repeat(${config.groups.length}, 100px)` }}
                    >
                      <span>Page</span>
                      {config.groups.map((g) => (
                        <span key={g.id} className="text-center truncate px-1">{g.label}</span>
                      ))}
                    </div>

                    {pages.map((page) => (
                      <div
                        key={page.path}
                        className="grid items-center py-1.5 rounded px-2 hover:bg-gray-800/40 transition-colors"
                        style={{ gridTemplateColumns: `1fr repeat(${config.groups.length}, 100px)` }}
                      >
                        <span className="text-sm text-gray-300">{page.label}</span>
                        {config.groups.map((g) => {
                          const hidden = isHiddenFrom(page.path, g.id);
                          return (
                            <div key={g.id} className="flex justify-center">
                              <button
                                onClick={() => toggleGroupForPage(page.path, page.label, g.id, !hidden)}
                                title={hidden ? `${g.label} cannot see this page — click to allow` : `${g.label} can see this page — click to hide`}
                                className={`p-1.5 rounded transition-colors ${
                                  hidden
                                    ? 'text-red-500 bg-red-950/40 hover:bg-red-950/60'
                                    : 'text-green-500 bg-green-950/40 hover:bg-green-950/60'
                                }`}
                              >
                                {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
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

      {/* Footer note */}
      <p className="text-xs text-gray-700 text-center pb-4">
        Changes take effect immediately after saving. You (admin) always see all pages.
        {config.updatedAt && (
          <> · Last saved {new Date(config.updatedAt).toLocaleString('en-AU')}
          {config.updatedBy && ` by ${config.updatedBy}`}</>
        )}
      </p>
    </div>
  );
}

// ── GroupCard ─────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onRemove,
  onUpdateMembers,
}: {
  group: VisibilityGroup;
  onRemove: () => void;
  onUpdateMembers: (raw: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/50">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded
            ? <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
            : <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />
          }
          <span className="text-sm font-medium text-white">{group.label}</span>
          <span className="text-xs text-gray-500">{group.members.length} member{group.members.length !== 1 ? 's' : ''}</span>
        </button>
        <button
          onClick={onRemove}
          className="p-1 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
          title="Remove group"
        >
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
