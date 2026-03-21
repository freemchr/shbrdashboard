'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Wrench, ShieldCheck, Zap, GitCommit,
  ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import type { ChangelogDay, ChangelogEntry } from '@/app/api/changelog/route';

// ─── Type badge config ────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<
  ChangelogEntry['type'],
  { label: string; icon: React.ReactNode; bg: string; text: string; border: string }
> = {
  feat: {
    label: 'New Feature',
    icon: <Sparkles size={12} />,
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  fix: {
    label: 'Bug Fix',
    icon: <Wrench size={12} />,
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  security: {
    label: 'Security',
    icon: <ShieldCheck size={12} />,
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
  },
  improvement: {
    label: 'Improvement',
    icon: <Zap size={12} />,
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
  },
  other: {
    label: 'Update',
    icon: <GitCommit size={12} />,
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    border: 'border-gray-500/20',
  },
};

function TypeBadge({ type }: { type: ChangelogEntry['type'] }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.icon}
      {cfg.label}
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
      {/* Day header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-900 hover:bg-gray-800/80 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">{day.label}</span>
          <div className="flex items-center gap-2">
            {featCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {featCount} new
              </span>
            )}
            {fixCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {fixCount} fix{fixCount !== 1 ? 'es' : ''}
              </span>
            )}
            {secCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                {secCount} security
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <span className="text-xs">{day.entries.length} change{day.entries.length !== 1 ? 's' : ''}</span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Entries */}
      {open && (
        <div className="divide-y divide-gray-800/60">
          {day.entries.map(entry => (
            <div key={entry.sha} className="flex items-start gap-3 px-5 py-3 bg-gray-950/40 hover:bg-gray-900/40 transition-colors">
              {/* Left accent line by type */}
              <div className={`mt-1 w-0.5 h-4 flex-shrink-0 rounded-full ${
                entry.type === 'feat'     ? 'bg-blue-500' :
                entry.type === 'fix'      ? 'bg-amber-500' :
                entry.type === 'security' ? 'bg-red-500' :
                entry.type === 'improvement' ? 'bg-purple-500' :
                'bg-gray-600'
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

export default function ChangelogPage() {
  const router = useRouter();
  const [days, setDays] = useState<ChangelogDay[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ChangelogEntry['type'] | 'all'>('all');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/changelog');
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (res.status === 404) {
        // Non-admin — go home silently
        router.replace('/');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${res.status})`);
      }
      const data = await res.json();
      setDays(data.days || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // Filter days/entries based on active type filter
  const filtered = filter === 'all'
    ? days
    : days
        .map(d => ({ ...d, entries: d.entries.filter(e => e.type === filter) }))
        .filter(d => d.entries.length > 0);

  const totalFeats  = days.flatMap(d => d.entries).filter(e => e.type === 'feat').length;
  const totalFixes  = days.flatMap(d => d.entries).filter(e => e.type === 'fix').length;
  const totalSec    = days.flatMap(d => d.entries).filter(e => e.type === 'security').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold text-white">Changelog</h1>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Every update, improvement, and fix to SHBR Insights — pulled live from GitHub.
          </p>
        </div>

        {/* Summary chips */}
        {!loading && !error && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filter === 'all'
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              All  ·  {total}
            </button>
            <button
              onClick={() => setFilter('feat')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filter === 'feat'
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                  : 'bg-transparent border-gray-700 text-gray-500 hover:text-blue-400 hover:border-blue-500/30'
              }`}
            >
              ✨ New Features  ·  {totalFeats}
            </button>
            <button
              onClick={() => setFilter('fix')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filter === 'fix'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-transparent border-gray-700 text-gray-500 hover:text-amber-400 hover:border-amber-500/30'
              }`}
            >
              🔧 Bug Fixes  ·  {totalFixes}
            </button>
            {totalSec > 0 && (
              <button
                onClick={() => setFilter('security')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filter === 'security'
                    ? 'bg-red-500/20 border-red-500/40 text-red-300'
                    : 'bg-transparent border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-500/30'
                }`}
              >
                🔒 Security  ·  {totalSec}
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-600">
            <RefreshCw size={20} className="animate-spin mr-2" />
            <span className="text-sm">Loading changelog from GitHub...</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-600 text-sm">
            No entries match this filter.
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            {filtered.map(day => (
              <DaySection key={day.date} day={day} />
            ))}
          </div>
        )}

        {/* Footer note */}
        {!loading && !error && (
          <p className="mt-8 text-xs text-gray-700 text-center">
            Sourced from{' '}
            <a
              href={`https://github.com/${GITHUB_REPO}/commits/main`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-400 underline underline-offset-2"
            >
              github.com/freemchr/shbrdashboard
            </a>
            {' '}· Admin only
          </p>
        )}
      </div>
    </div>
  );
}

// Make the GitHub repo available to the client for the footer link
const GITHUB_REPO = 'freemchr/shbrdashboard';
