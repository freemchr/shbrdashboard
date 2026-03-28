'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import {
  Clipboard,
  Check,
  Pencil,
  Trash2,
  Plus,
  X,
  Linkedin,
} from 'lucide-react';
import type { SocialPost, SocialsData } from '@/app/api/socials/posts/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Monday of the week containing `date` */
function weekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseLocalDate(ymd: string): Date {
  const [y, m, day] = ymd.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function formatDayHeading(ymd: string): string {
  return parseLocalDate(ymd).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(ymd: string): string {
  return parseLocalDate(ymd).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedCounter({ value, enabled }: { value: number; enabled: boolean }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!enabled || value === 0) { setDisplay(value); return; }
    let start: number | null = null;
    const duration = 700;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(ease * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, enabled]);
  return <>{display}</>;
}

// ─── Spotlight hook (div variant) ────────────────────────────────────────────

function useSpotlight() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);
  const onMouseLeave = useCallback(() => setPos(null), []);
  const overlayStyle: React.CSSProperties = pos
    ? { background: `radial-gradient(500px circle at ${pos.x}px ${pos.y}px, rgba(255,255,255,0.05), transparent 40%)`, pointerEvents: 'none' }
    : { pointerEvents: 'none' };
  return { ref, onMouseMove, onMouseLeave, overlayStyle };
}

// ─── Brand helpers ────────────────────────────────────────────────────────────

function brandBadge(brand: SocialPost['brand']) {
  return brand === 'SHBR'
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">SHBR</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">APP</span>;
}

// ─── Pulse-dot status badge ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: SocialPost['status'] }) {
  if (status === 'posted') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
        <Check size={10} />
        Posted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-700/50 text-gray-400 border border-gray-600/40">
      {/* Pulse dot — signals awaiting action */}
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
      </span>
      Draft
    </span>
  );
}

// ─── Copy button with icon-swap animation ────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-all"
    >
      <span
        className="relative flex items-center"
        style={{
          width: 14,
          height: 14,
        }}
      >
        {/* Clipboard icon — fades/scales out when copied */}
        <Clipboard
          size={14}
          className="absolute transition-all duration-200"
          style={{
            opacity: copied ? 0 : 1,
            transform: copied ? 'scale(0.5)' : 'scale(1)',
          }}
        />
        {/* Check icon — scales in when copied */}
        <Check
          size={14}
          className="absolute text-emerald-400 transition-all duration-200"
          style={{
            opacity: copied ? 1 : 0,
            transform: copied ? 'scale(1)' : 'scale(0.5)',
          }}
        />
      </span>
      <span
        className="transition-all duration-200"
        style={{
          transform: copied ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        {copied ? 'Copied!' : 'Copy Post'}
      </span>
    </button>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onUpdate,
  onDelete,
}: {
  post: SocialPost;
  onUpdate: (id: string, updates: Partial<SocialPost>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState({
    title: post.title,
    body: post.body,
    hashtags: post.hashtags,
    imagePrompt: post.imagePrompt ?? '',
  });

  const { ref, onMouseMove, onMouseLeave, overlayStyle } = useSpotlight();

  // Brand-based accent colours
  const borderClass = post.brand === 'SHBR'
    ? 'border-l-4 border-l-red-800/40 border border-gray-800'
    : 'border-l-4 border-l-blue-800/40 border border-gray-800';
  const bgClass = post.brand === 'SHBR'
    ? 'bg-red-950/10'
    : 'bg-blue-950/10';

  const copyText = `${post.title}\n\n${post.body}\n\n${post.hashtags}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(post.id, { ...draft, imagePrompt: draft.imagePrompt || undefined });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePosted = async () => {
    const now = new Date().toISOString();
    if (post.status === 'posted') {
      await onUpdate(post.id, { status: 'draft', postedAt: undefined });
    } else {
      await onUpdate(post.id, { status: 'posted', postedAt: now });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return;
    setDeleting(true);
    try {
      await onDelete(post.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`relative overflow-hidden rounded-xl ${bgClass} ${borderClass} transition-all`}
    >
      {/* Spotlight overlay */}
      <div className="absolute inset-0 rounded-xl pointer-events-none" style={overlayStyle} />

      <div className="relative z-10 p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center flex-wrap gap-2">
            {brandBadge(post.brand)}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Linkedin size={10} />
              LinkedIn
            </span>
            <StatusBadge status={post.status} />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => { setEditing(e => !e); setDraft({ title: post.title, body: post.body, hashtags: post.hashtags, imagePrompt: post.imagePrompt ?? '' }); }}
              className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-700 transition-all"
              title="Edit post"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-all disabled:opacity-50"
              title="Delete post"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {editing ? (
          /* ── Edit mode ─────────────────────────────────────────────────── */
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Body</label>
              <textarea
                value={draft.body}
                onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
                rows={12}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-y font-mono leading-relaxed"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Hashtags</label>
              <input
                type="text"
                value={draft.hashtags}
                onChange={e => setDraft(d => ({ ...d, hashtags: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-blue-300 placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Image prompt <span className="text-gray-600">(optional)</span></label>
              <input
                type="text"
                value={draft.imagePrompt}
                onChange={e => setDraft(d => ({ ...d, imagePrompt: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400 placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── Read mode ─────────────────────────────────────────────────── */
          <>
            <h3 className="text-white font-semibold text-base mb-3">{post.title}</h3>
            <div className="border-t border-gray-800/60 pt-3 mb-3">
              <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{post.body}</p>
            </div>
            <div className="border-t border-gray-800/60 pt-3 space-y-2">
              <p className="text-blue-400 text-sm">{post.hashtags}</p>
              {post.imagePrompt && (
                <p className="text-gray-500 text-xs italic">
                  📸 Suggested image: {post.imagePrompt}
                </p>
              )}
            </div>
            <div className="border-t border-gray-800/60 mt-3 pt-3 flex items-center gap-2 flex-wrap">
              <CopyButton text={copyText} />
              <button
                onClick={handleTogglePosted}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  post.status === 'posted'
                    ? 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                {post.status === 'posted' ? (
                  <><X size={12} /> Unmark as Posted</>
                ) : (
                  <><Check size={12} /> Mark as Posted</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Add Post form ────────────────────────────────────────────────────────────

function AddPostForm({
  selectedDate,
  onAdd,
  onClose,
}: {
  selectedDate: string;
  onAdd: (post: Partial<SocialPost>) => Promise<void>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    brand: 'SHBR' as SocialPost['brand'],
    date: selectedDate,
    title: '',
    body: '',
    hashtags: '',
    imagePrompt: '',
  });

  // Compute weekOf from date
  const weekOf = (() => {
    try { return toYMD(weekMonday(parseLocalDate(form.date))); } catch { return form.date; }
  })();

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      await onAdd({ ...form, weekOf, imagePrompt: form.imagePrompt || undefined });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">New Post</h3>
        <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Brand</label>
          <select
            value={form.brand}
            onChange={e => setForm(f => ({ ...f, brand: e.target.value as SocialPost['brand'] }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
          >
            <option value="SHBR">SHBR</option>
            <option value="APP">APP</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Title</label>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Post title…"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Body</label>
        <textarea
          value={form.body}
          onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          placeholder="Post body text…"
          rows={8}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-y font-mono leading-relaxed"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Hashtags</label>
        <input
          type="text"
          value={form.hashtags}
          onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))}
          placeholder="#Hashtag1 #Hashtag2"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-blue-300 placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Image prompt <span className="text-gray-600">(optional)</span></label>
        <input
          type="text"
          value={form.imagePrompt}
          onChange={e => setForm(f => ({ ...f, imagePrompt: e.target.value }))}
          placeholder="Describe the ideal image…"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400 placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !form.title.trim() || !form.body.trim()}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? 'Saving…' : 'Add Post'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

/** Returns [Mon, Tue, Wed, Thu, Fri, Sat, Sun] starting from weekMonday */
function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function CalendarGrid({
  posts,
  brandFilter,
  selectedDay,
  onSelectDay,
}: {
  posts: SocialPost[];
  brandFilter: 'all' | 'SHBR' | 'APP';
  selectedDay: string;
  onSelectDay: (ymd: string) => void;
}) {
  const today = toYMD(new Date());
  const todayMonday = weekMonday(new Date());

  // 2 weeks back, current, 1 ahead = 4 rows
  const weeks: Date[] = [-2, -1, 0, 1].map(offset => {
    const d = new Date(todayMonday);
    d.setDate(d.getDate() + offset * 7);
    return d;
  });

  // Index posts by date
  const byDate = posts.reduce<Record<string, SocialPost[]>>((acc, p) => {
    if (brandFilter !== 'all' && p.brand !== brandFilter) return acc;
    if (!acc[p.date]) acc[p.date] = [];
    acc[p.date].push(p);
    return acc;
  }, {});

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 overflow-x-auto">
      {/* Day column headers */}
      <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-2">
        <div /> {/* week label cell */}
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-600 uppercase tracking-wide py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="space-y-1">
        {weeks.map(monday => {
          const days = weekDays(monday);
          const label = `${monday.getDate()} ${monday.toLocaleString('en-AU', { month: 'short' })}`;
          return (
            <div key={toYMD(monday)} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 items-start">
              {/* Week label */}
              <div className="flex items-start pt-2 pr-2">
                <span className="text-xs text-gray-600 whitespace-nowrap">
                  {label}
                </span>
              </div>
              {/* Day cells */}
              {days.map(day => {
                const ymd = toYMD(day);
                const isToday = ymd === today;
                const isSelected = ymd === selectedDay;
                const dayPosts = byDate[ymd] ?? [];

                // Spotlight glow on selected — computed inline
                const selectedBase = 'bg-gray-700/60 ring-1 ring-gray-500';
                const hoverBase = 'hover:bg-gray-800/60';

                return (
                  <button
                    key={ymd}
                    onClick={() => onSelectDay(ymd)}
                    className={`
                      relative min-h-[52px] rounded-lg p-1.5 text-left transition-all duration-150
                      ${isSelected ? selectedBase : `bg-gray-900/40 ${hoverBase}`}
                      ${isToday ? 'ring-1 ring-offset-0 ring-white/20' : ''}
                    `}
                    style={isSelected ? {
                      boxShadow: '0 0 0 1px rgba(239,68,68,0.4), 0 0 16px 2px rgba(239,68,68,0.12)',
                    } : undefined}
                  >
                    {/* Day number */}
                    <span className={`text-[10px] font-semibold block mb-1 ${
                      isToday ? 'text-white' : 'text-gray-500'
                    }`}>
                      {day.getDate()}
                      {isToday && <span className="ml-0.5 text-red-400">•</span>}
                    </span>

                    {/* Post dots */}
                    <div className="flex flex-wrap gap-0.5">
                      {dayPosts.map(p => (
                        <span
                          key={p.id}
                          title={`${p.brand}: ${p.title}`}
                          className={`
                            inline-block rounded-full transition-transform hover:scale-125
                            ${p.brand === 'SHBR'
                              ? p.status === 'posted'
                                ? 'w-2 h-2 bg-red-500'
                                : 'w-2 h-2 border border-red-500 bg-transparent'
                              : p.status === 'posted'
                                ? 'w-2 h-2 bg-blue-500'
                                : 'w-2 h-2 border border-blue-500 bg-transparent'
                            }
                          `}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Dot legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-800/50">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          SHBR posted
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full border border-red-500 inline-block" />
          SHBR draft
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          APP posted
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full border border-blue-500 inline-block" />
          APP draft
        </div>
      </div>
    </div>
  );
}

// ─── Summary stat card ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  enabled,
  accent,
}: {
  label: string;
  value: number;
  enabled: boolean;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ?? 'text-white'}`}>
        <AnimatedCounter value={value} enabled={enabled} />
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SocialsPage() {
  const [data, setData]             = useState<SocialsData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [brandFilter, setBrandFilter] = useState<'all' | 'SHBR' | 'APP'>('all');
  const [selectedDay, setSelectedDay] = useState(toYMD(new Date()));
  const [showAddForm, setShowAddForm] = useState(false);

  // Load posts
  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/socials/posts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: SocialsData = await res.json();
      setData(d);
      setDataLoaded(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Update a post
  const handleUpdate = useCallback(async (id: string, updates: Partial<SocialPost>) => {
    const res = await fetch(`/api/socials/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update post');
    const updated: SocialPost = await res.json();
    setData(prev => prev ? {
      ...prev,
      posts: prev.posts.map(p => p.id === id ? updated : p),
    } : prev);
  }, []);

  // Delete a post
  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/socials/posts/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete post');
    setData(prev => prev ? {
      ...prev,
      posts: prev.posts.filter(p => p.id !== id),
    } : prev);
  }, []);

  // Add a post
  const handleAdd = useCallback(async (post: Partial<SocialPost>) => {
    const res = await fetch('/api/socials/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post),
    });
    if (!res.ok) throw new Error('Failed to add post');
    const created: SocialPost = await res.json();
    setData(prev => prev ? {
      ...prev,
      posts: [...prev.posts, created],
    } : prev);
    // Jump to the new post's date
    if (created.date) setSelectedDay(created.date);
  }, []);

  if (loading) return <LoadingSpinner message="Loading Socials Dashboard…" />;
  if (error)   return <ErrorMessage message={error} />;
  if (!data)   return null;

  const allPosts = data.posts;

  // Stats for this calendar week (Mon–Sun containing today)
  const thisMonday = weekMonday(new Date());
  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisSunday.getDate() + 6);
  const thisWeekMondayYMD = toYMD(thisMonday);
  const thisWeekSundayYMD = toYMD(thisSunday);

  const thisWeekPosts = allPosts.filter(p => p.date >= thisWeekMondayYMD && p.date <= thisWeekSundayYMD);
  const postedCount   = allPosts.filter(p => p.status === 'posted').length;
  const draftCount    = allPosts.filter(p => p.status === 'draft').length;
  const thisWeekSHBR  = thisWeekPosts.filter(p => p.brand === 'SHBR').length;
  const thisWeekAPP   = thisWeekPosts.filter(p => p.brand === 'APP').length;

  // Filtered posts for the selected day
  const dayPosts = allPosts.filter(p =>
    p.date === selectedDay &&
    (brandFilter === 'all' || p.brand === brandFilter)
  );

  return (
    <div>
      <PageHeader
        title="Socials Dashboard"
        subtitle="LinkedIn content calendar — SHBR Group and Australian Plumbing Products"
      />

      {/* ── Summary stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="This week" value={thisWeekPosts.length} enabled={dataLoaded} />
        <StatCard label="SHBR this week" value={thisWeekSHBR} enabled={dataLoaded} accent="text-red-400" />
        <StatCard label="APP this week" value={thisWeekAPP} enabled={dataLoaded} accent="text-blue-400" />
        <StatCard label="Posted total" value={postedCount} enabled={dataLoaded} accent="text-emerald-400" />
      </div>

      {/* ── Controls row ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Brand legend */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">SHBR</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">APP</span>
          <span className="text-gray-700 text-sm mx-1">·</span>
          {/* Filter buttons */}
          {(['all', 'SHBR', 'APP'] as const).map(f => (
            <button
              key={f}
              onClick={() => setBrandFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                brandFilter === f
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
          {draftCount > 0 && (
            <span className="text-xs text-amber-400 ml-1">{draftCount} draft{draftCount !== 1 ? 's' : ''} awaiting action</span>
          )}
        </div>

        {/* Add Post button */}
        <button
          onClick={() => setShowAddForm(f => !f)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-all"
        >
          <Plus size={14} />
          Add Post
        </button>
      </div>

      {/* ── Add Post form (slide-down) ────────────────────────────────────── */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: showAddForm ? '800px' : '0px', opacity: showAddForm ? 1 : 0 }}
      >
        <div className="mb-4">
          <AddPostForm
            selectedDate={selectedDay}
            onAdd={handleAdd}
            onClose={() => setShowAddForm(false)}
          />
        </div>
      </div>

      {/* ── Calendar ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <CalendarGrid
          posts={allPosts}
          brandFilter={brandFilter}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      </div>

      {/* ── Selected day posts ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">
          {dayPosts.length > 0
            ? `Posts for ${formatDayHeading(selectedDay)}`
            : <span className="text-gray-600">No posts scheduled for {formatShortDate(selectedDay)}</span>
          }
        </h2>

        {dayPosts.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center">
            <p className="text-gray-600 text-sm">Nothing here yet.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-all"
            >
              <Plus size={12} />
              Add a post for this day
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {dayPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
