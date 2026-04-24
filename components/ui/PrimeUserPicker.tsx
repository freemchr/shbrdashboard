'use client';

import { useId, useMemo, useState, useCallback } from 'react';
import { X, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { usePrimeDirectory } from '@/lib/prime-directory-context';
import type { PrimeUser } from '@/lib/prime-users';

interface PrimeUserPickerProps {
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  multiSelect?: boolean;
  allowHistorical?: boolean;
}

// Inline relative-time helper — UI-SPEC §Copywriting "Relative-time formatting (locked)".
// Uses browser-native Intl.RelativeTimeFormat (no date library — see RESEARCH "Don't Hand-Roll").
// RESEARCH Open Question 4: kept inline (single call site; ~15 LOC; no other consumer in Phase 3).
function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = (then - now) / 1000; // negative for past times
  const rtf = new Intl.RelativeTimeFormat('en', { style: 'long', numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diffSec) >= secs) {
      return rtf.format(Math.round(diffSec / secs), unit);
    }
  }
  return rtf.format(Math.round(diffSec), 'second');
}

// Shared × button class — chrome only (chip body classes differentiate live/historical/neutral).
const X_BTN_CLASS =
  'flex-shrink-0 ml-0.5 -mr-0.5 p-0.5 rounded text-gray-500 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-red-600 transition-colors';

// Live chip — UI-SPEC Surface 3 (verbatim classes).
function Chip({ email, user, onRemove }: { email: string; user: PrimeUser; onRemove: (email: string) => void }) {
  const tooltipText = user.division ? `${user.division} · ${email}` : email;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-sm text-white max-w-[200px]"
      title={tooltipText}
    >
      <span className="truncate">{user.fullName}</span>
      <button type="button" aria-label={`Remove ${user.fullName}`} onClick={() => onRemove(email)} className={X_BTN_CLASS}>
        <X size={12} />
      </button>
    </span>
  );
}

// Historical chip — UI-SPEC Surface 4 (verbatim). Italic + gray + locked tooltip.
function ChipHistorical({ email, onRemove }: { email: string; onRemove: (email: string) => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800/60 border border-gray-700 text-sm text-gray-500 italic max-w-[200px]"
      title="Not in current directory snapshot — refresh to recheck"
    >
      <span className="truncate">{email}</span>
      <button type="button" aria-label={`Remove ${email}`} onClick={() => onRemove(email)} className={`${X_BTN_CLASS} not-italic`}>
        <X size={12} />
      </button>
    </span>
  );
}

// Loading-state neutral chip — UI-SPEC Surface 10. text-gray-500 UPRIGHT (NOT italic) so the
// italic-only-for-historical rule survives the load window (Pitfall 1 mitigation).
function ChipNeutral({ email, onRemove }: { email: string; onRemove: (email: string) => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-500 max-w-[200px]">
      <span className="truncate">{email}</span>
      <button type="button" aria-label={`Remove ${email}`} onClick={() => onRemove(email)} className={X_BTN_CLASS}>
        <X size={12} />
      </button>
    </span>
  );
}

export function PrimeUserPicker({
  selected,
  onChange,
  placeholder,
  multiSelect = true,
  allowHistorical: _allowHistorical = true,
}: PrimeUserPickerProps) {
  const inputId = useId();
  const listboxId = useId();
  const { status, users, byEmail, lastSuccessAt, lastError, refresh, refreshing } =
    usePrimeDirectory();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Sorted chips — RESEARCH Code Examples (D-05/D-09): live by fullName, historical by email.
  const sortedChips = useMemo(() => {
    return selected
      .map(email => {
        const u = byEmail.get(email.toLowerCase());
        return u
          ? { kind: 'live' as const, email, sortKey: u.fullName.toLowerCase(), user: u }
          : { kind: 'historical' as const, email, sortKey: email.toLowerCase() };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [selected, byEmail]);

  // Pitfall 1 mitigation (D-22): NEVER classify entries as historical until status === 'ready'.
  const historicalCount =
    status === 'ready' ? sortedChips.filter(c => c.kind === 'historical').length : 0;

  // Substring filter across fullName / email / division — D-18 / RESEARCH Code Examples.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      u =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.division?.toLowerCase().includes(q) ?? false),
    );
  }, [users, query]);

  const addEmail = useCallback(
    (email: string) => {
      const next = multiSelect ? Array.from(new Set([...selected, email])) : [email];
      onChange(next);
    },
    [selected, onChange, multiSelect],
  );

  const removeEmail = useCallback(
    (email: string) => {
      onChange(selected.filter(e => e !== email));
    },
    [selected, onChange],
  );

  // Keyboard handler — RESEARCH Pattern 3 (verbatim). Note Pitfall 2: option click handled
  // separately via onMouseDown preventDefault on each <li>.
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0 && filtered[activeIndex]) {
      e.preventDefault();
      const candidate = filtered[activeIndex];
      if (!selected.includes(candidate.email)) {
        addEmail(candidate.email);
        setQuery('');
        setActiveIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Backspace' && query === '' && sortedChips.length > 0) {
      e.preventDefault();
      removeEmail(sortedChips[sortedChips.length - 1].email);
    }
  }

  // Loading branch — UI-SPEC Surface 10. Render neutral chips (no italic) + spinner; skip input.
  if (status === 'loading') {
    return (
      <div className="space-y-2">
        {sortedChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sortedChips.map(chip => (
              <ChipNeutral key={chip.email} email={chip.email} onRemove={removeEmail} />
            ))}
          </div>
        )}
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-gray-500" />
        </div>
      </div>
    );
  }

  // Ready / error branch — full picker.
  return (
    <div className="space-y-2">
      {/* Surface 2 — Chip cluster (only renders when there are selections) */}
      {sortedChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sortedChips.map(chip =>
            chip.kind === 'live' ? (
              <Chip
                key={chip.email}
                email={chip.email}
                user={chip.user}
                onRemove={removeEmail}
              />
            ) : (
              <ChipHistorical key={chip.email} email={chip.email} onRemove={removeEmail} />
            ),
          )}
        </div>
      )}

      {/* Surface 11 — Inline refresh hint (only when status=ready AND historicals present) */}
      {status === 'ready' && historicalCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-800/60 bg-yellow-950/30 px-3 py-2">
          <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-xs text-gray-300 leading-snug">
            <span className="text-yellow-500 font-medium">{historicalCount}</span>{' '}
            {historicalCount === 1 ? 'entry' : 'entries'} not found in current directory snapshot.{' '}
            Last refresh:{' '}
            <span className="text-yellow-500">{formatRelative(lastSuccessAt)}</span>.
            {lastError && <span className="text-red-400"> (refresh failed)</span>}
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-xs text-gray-300 transition-colors"
          >
            {refreshing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {refreshing ? 'Refreshing…' : 'Refresh Prime directory'}
          </button>
        </div>
      )}

      {/* Surface 5 — Search input (combobox role with full ARIA wiring) */}
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        aria-label="Search Prime users"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600"
      />

      {/* Surface 6 — Dropdown listbox (only when open) */}
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="mt-1 max-h-64 overflow-y-auto bg-gray-800 border border-gray-700 rounded-md py-1 shadow-lg"
        >
          {/* Surface 9 — Empty-cache state */}
          {users.length === 0 && (
            <li
              role="option"
              aria-disabled="true"
              aria-selected={false}
              className="px-3 py-3 flex flex-col gap-2"
            >
              <div className="text-sm text-gray-300">Prime directory unavailable.</div>
              <div className="text-xs text-gray-500">Try refreshing.</div>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="self-start flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs text-gray-300 transition-colors"
              >
                {refreshing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                {refreshing ? 'Refreshing…' : 'Refresh Prime directory'}
              </button>
            </li>
          )}

          {/* Surface 8 — "No matches" (filter narrowed to nothing) */}
          {filtered.length === 0 && users.length > 0 && (
            <li
              role="option"
              aria-disabled="true"
              aria-selected={false}
              className="px-3 py-2 text-sm text-gray-500"
            >
              No matches
            </li>
          )}

          {/* Surface 7 — Dropdown rows */}
          {filtered.map((user, i) => {
            const isAlreadySelected = selected.includes(user.email);
            return (
              <li
                key={user.id}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                aria-disabled={isAlreadySelected || undefined}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  if (!isAlreadySelected) {
                    addEmail(user.email);
                    setQuery('');
                  }
                }}
                className={`px-3 py-2 cursor-pointer ${
                  i === activeIndex ? 'bg-gray-700' : ''
                } ${
                  isAlreadySelected
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-gray-700'
                }`}
              >
                <div className="text-sm text-white truncate">
                  {user.fullName}
                  {user.division && (
                    <span className="text-gray-400"> · {user.division}</span>
                  )}
                  {isAlreadySelected && (
                    <span className="text-gray-400"> (already added)</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">{user.email}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
