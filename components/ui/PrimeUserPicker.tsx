'use client';

/**
 * PrimeUserPicker — shared inline combobox for all three Phase 3 admin call sites
 * (Dashboard Admins, group member editor, new-group form).
 *
 * Plain-React + Tailwind + ARIA. No combobox library, no portal, no popover.
 * The full visual + keyboard + ARIA contract is locked in
 * .planning/phases/03-admin-picker-identity-rich-display/03-UI-SPEC.md —
 * this component is the implementation of that contract.
 *
 * Decisions baked in (see UI-SPEC §"Keyboard Interaction Model"):
 *   - `onMouseDown` + `e.preventDefault()` on dropdown rows so the row commits
 *     BEFORE the input loses focus (avoids the "click swallowed by blur-close"
 *     footgun). The 100ms blur delay is a belt-and-braces that also covers
 *     touch/keyboard activation paths.
 *   - Inactive users (`status !== 'active'`) are INCLUDED in results with a
 *     ` (inactive)` marker (UI-SPEC §"Inactive User Treatment"), not filtered.
 *   - `useId()` (React 18+) gives each picker instance a unique listbox id so
 *     three pickers on one page don't clash.
 *   - Manual-email fallback (D-12) is a separate render path that activates
 *     when `availableUsers.length === 0 && error` — the regular combobox is
 *     NOT rendered in that branch.
 *
 * Two named pure helpers (filterPrimeUsers, normalizeManualEmail) are exported
 * for unit testing per Plan 03-03 D-19.
 */

import { useState, useRef, useEffect, useId, useCallback } from 'react';
import { User, X, Plus, Loader2 } from 'lucide-react';
import type { PrimeUser } from '@/lib/prime-users';
import { resolveDisplayName, isUnresolvedEmail } from '@/lib/identity-display';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PLACEHOLDER = 'Search Prime users by name, email, or division…'; // U+2026 ellipsis
const LOADING_PLACEHOLDER = 'Loading Prime users…';

export interface PrimeUserPickerProps {
  selectedEmails: string[];
  availableUsers: PrimeUser[];
  onChange: (emails: string[]) => void;
  multi?: boolean;
  placeholder?: string;
  loading?: boolean;
  error?: string | null;
  ariaLabel?: string;
}

/**
 * Pure: case-insensitive substring filter across fullName + email + division.
 * Null-safe on division. Empty/whitespace query → returns users unchanged.
 */
export function filterPrimeUsers(query: string, users: PrimeUser[]): PrimeUser[] {
  const q = query.trim().toLowerCase();
  if (!q) return users;
  return users.filter(u =>
    u.fullName.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.division ?? '').toLowerCase().includes(q),
  );
}

/**
 * Pure: trim + lowercase manual-email fallback input, validate as email shape.
 * D-12 + Phase 1 D-09 normalization invariant.
 */
export function normalizeManualEmail(
  raw: string,
): { ok: true; email: string } | { ok: false; reason: 'empty' | 'invalid' } {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (!EMAIL_REGEX.test(trimmed)) return { ok: false, reason: 'invalid' };
  return { ok: true, email: trimmed };
}

export function PrimeUserPicker({
  selectedEmails,
  availableUsers,
  onChange,
  multi = true,
  placeholder,
  loading = false,
  error = null,
  ariaLabel,
}: PrimeUserPickerProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Manual-email fallback state (only used when availableUsers empty + error set)
  const [manualEmailRaw, setManualEmailRaw] = useState('');
  const [manualEmailError, setManualEmailError] = useState<string | null>(null);

  const filtered = filterPrimeUsers(query, availableUsers).filter(
    u => !selectedEmails.includes(u.email),
  );

  // Reset activeIndex when the filter list shrinks (UI-SPEC keyboard model)
  useEffect(() => { setActiveIndex(0); }, [query]);

  const add = useCallback((email: string) => {
    const normalized = email.trim().toLowerCase();
    onChange(multi ? [...selectedEmails, normalized] : [normalized]);
    setQuery('');
    setActiveIndex(0);
    inputRef.current?.focus();
  }, [multi, onChange, selectedEmails]);

  const remove = useCallback((email: string) => {
    onChange(selectedEmails.filter(e => e !== email));
  }, [onChange, selectedEmails]);

  function tryManualAddFromQuery() {
    const result = normalizeManualEmail(query);
    if (result.ok) add(result.email);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIndex]) {
        add(filtered[activeIndex].email);
      } else if (filtered.length === 0 && EMAIL_REGEX.test(query.trim().toLowerCase())) {
        tryManualAddFromQuery();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && query === '' && selectedEmails.length > 0) {
      remove(selectedEmails[selectedEmails.length - 1]);
    }
  }

  function handleManualAdd() {
    const result = normalizeManualEmail(manualEmailRaw);
    if (!result.ok) {
      setManualEmailError(result.reason === 'empty' ? null : 'Invalid email format.');
      return;
    }
    setManualEmailError(null);
    onChange(multi ? [...selectedEmails, result.email] : [result.email]);
    setManualEmailRaw('');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Manual-email fallback render path (D-12: empty list + error)
  // ────────────────────────────────────────────────────────────────────────────
  if (!loading && availableUsers.length === 0 && error) {
    return (
      <div className="relative w-full">
        {/* chip row stays available so admins can still see/remove existing entries during outage */}
        {selectedEmails.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedEmails.map(email => (
              <span
                key={email}
                title={isUnresolvedEmail(email, availableUsers) ? 'No Prime record found' : undefined}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 max-w-[200px]"
              >
                <span className="truncate">{resolveDisplayName(email, availableUsers, null)}</span>
                <button
                  type="button"
                  onClick={() => remove(email)}
                  aria-label={`Remove ${resolveDisplayName(email, availableUsers, null)}`}
                  className="text-gray-500 hover:text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500/40 rounded shrink-0"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-red-400 text-xs mb-1">Prime directory unavailable. Add an email manually:</p>
        <div className="flex items-stretch gap-2">
          <input
            type="email"
            value={manualEmailRaw}
            onChange={e => setManualEmailRaw(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleManualAdd(); } }}
            placeholder="user@shbr.com.au"
            aria-label="Enter raw email when Prime is unavailable"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40"
          />
          <button
            type="button"
            onClick={handleManualAdd}
            disabled={!manualEmailRaw.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm rounded-md transition-colors"
          >
            <Plus size={14} />
            Add Email
          </button>
        </div>
        {manualEmailError && <p className="text-red-400 text-xs mt-1">{manualEmailError}</p>}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Standard combobox render path
  // ────────────────────────────────────────────────────────────────────────────
  const activeId = open && filtered[activeIndex]
    ? `primeuser-row-${filtered[activeIndex].email}`
    : undefined;

  return (
    <div className="relative w-full">
      {/* chip row */}
      {selectedEmails.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedEmails.map(email => (
            <span
              key={email}
              title={isUnresolvedEmail(email, availableUsers) ? 'No Prime record found' : undefined}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 max-w-[200px]"
            >
              <span className="truncate">{resolveDisplayName(email, availableUsers, null)}</span>
              <button
                type="button"
                onClick={() => remove(email)}
                aria-label={`Remove ${resolveDisplayName(email, availableUsers, null)}`}
                className="text-gray-500 hover:text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500/40 rounded shrink-0"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* input + (optional) loading spinner */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-label={ariaLabel ?? 'Search Prime users'}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 100)}
          onKeyDown={onKeyDown}
          placeholder={loading ? LOADING_PLACEHOLDER : (placeholder ?? DEFAULT_PLACEHOLDER)}
          disabled={loading}
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
            <Loader2 size={14} className="animate-spin" />
          </span>
        )}
      </div>

      {/* dropdown */}
      {open && !loading && (
        <ul
          ref={dropdownRef}
          role="listbox"
          id={listId}
          aria-label="Prime user search results"
          className="absolute top-full left-0 right-0 mt-1 z-30 max-h-72 overflow-auto bg-gray-900 border border-gray-700 rounded-md shadow-lg shadow-black/40"
        >
          {filtered.length === 0 ? (
            <li role="status" className="text-sm text-gray-500 px-3 py-2">
              {EMAIL_REGEX.test(query.trim().toLowerCase())
                ? 'No matches found. Press Enter to add as raw email.'
                : 'No matches found.'}
            </li>
          ) : (
            filtered.map((u, i) => {
              const primary = u.fullName?.trim() || u.email;
              const isActive = i === activeIndex;
              return (
                <li
                  key={u.email}
                  role="option"
                  id={`primeuser-row-${u.email}`}
                  aria-selected={isActive}
                  onMouseDown={e => { e.preventDefault(); add(u.email); }}
                  className={`px-3 py-2 cursor-pointer ${isActive ? 'bg-gray-800' : 'hover:bg-gray-800/60'}`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <User size={14} className="text-gray-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-300 truncate">
                        {primary}
                        {u.status !== 'active' && <span className="text-gray-500"> (inactive)</span>}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {u.email}
                        {u.division && <span> · {u.division}</span>}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
