# Phase 3: Admin Picker & Identity-Rich Display - Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 8 (5 new, 3 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Status | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `app/api/admin/prime-users/route.ts` | NEW | route (GET) | request-response | `app/api/admin/prime-users/refresh/route.ts` | exact (sibling, mandated by D-11) |
| `app/api/admin/prime-users/route.test.ts` | NEW | test (route) | request-response | `app/api/auth/session/route.test.ts` + `app/api/auth/login/route.test.ts` | exact pattern (Vitest + module-boundary mocks) |
| `components/ui/PrimeUserPicker.tsx` | NEW | component (combobox) | event-driven (keystrokes), prop-callback | `app/search/page.tsx` (filter logic) + `components/ui/TopBar.tsx` (display tokens) | role-match (no existing combobox; flagged below) |
| `components/ui/PrimeUserPicker.test.ts` | NEW | test (pure-function) | transform | `lib/prime-users.test.ts` | role-match (pure-function vitest) |
| `lib/identity-display.ts` | NEW | utility (pure) | transform | `components/ui/TopBar.tsx:48` (cascade one-liner) + `lib/page-visibility.ts:isAdminEmail` (lookup pattern) | partial (extends Phase 2 cascade) |
| `lib/identity-display.test.ts` | NEW | test (pure-function) | transform | `lib/audit.test.ts` | exact pattern |
| `lib/format-relative.ts` | NEW | utility (pure) | transform | `components/ui/DataRefreshButton.tsx:24-32` | exact (lift-and-extend) |
| `app/admin/visibility-tab.tsx` | NEW (extracted) | client page section | request-response (fetch+save) | `app/admin/page.tsx:129-453` (existing `VisibilityTab`) | exact (extraction, not rewrite) |
| `app/admin/audit-tab.tsx` | NEW (extracted) | client page section | request-response (poll) | `app/admin/page.tsx:533-642` (existing `AuditTab`) | exact (extraction + cascade overlay) |
| `app/admin/page.tsx` | MODIFIED (shrink) | page router | request-response | self (existing tab router lines 45-123) | exact (preserve, remove extracted bodies) |
| `lib/prime-users.ts` | MODIFIED (additive) | utility (data access) | CRUD (read) | self — add `getDirectoryMetadata()` next to `getAllPrimeUsers()` lines 193-210 | exact |

## Pattern Assignments

### `app/api/admin/prime-users/route.ts` (route, request-response)

**Analog:** `app/api/admin/prime-users/refresh/route.ts` (sibling — mandated by D-11)

**Module-level exports pattern** (lines 19-26):
```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';
import { refreshPrimeUsers } from '@/lib/prime-users';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
```

For the new GET route, swap `refreshPrimeUsers` for `getAllPrimeUsers` + `getDirectoryMetadata`.

**Two-gate auth pattern** (lines 28-40 — copy verbatim):
```typescript
export async function POST() {
  // Gate 1: authenticated session?
  const session = await getSession();
  if (!session.userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Gate 2: admin?
  const config = await getVisibilityConfig();
  if (!isAdminEmail(session.userEmail, config)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
```

For Phase 3 GET, change `POST()` → `GET()`. Status codes 401/403 are mandated by D-11 (do NOT use the 404 stealth from `app/api/audit/entries/route.ts`).

**Error logging + return-shape pattern** (lines 44-58):
```typescript
if (!result.ok) {
  return NextResponse.json(
    {
      ok: false,
      error: result.blob.lastError ?? 'Unknown error',
      lastSuccessAt: result.blob.lastSuccessAt || null,
    },
    { status: 502 }
  );
}
```

For the new GET, log prefix becomes `[admin-prime-users]` (per CONVENTIONS.md `[namespace]` pattern). Response shape `{ users, lastSuccessAt, lastError }` per D-11. Add `Cache-Control: no-store` header.

---

### `app/api/admin/prime-users/route.test.ts` (test, request-response)

**Analog:** `app/api/auth/session/route.test.ts`

**Module-boundary mocks pattern** (lines 1-32):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrimeUser } from '@/lib/prime-users';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/page-visibility', () => ({
  getVisibilityConfig: vi.fn(),
  isAdminEmail: vi.fn(() => false),
}));
vi.mock('@/lib/prime-users', () => ({
  getAllPrimeUsers: vi.fn(),
  getDirectoryMetadata: vi.fn(),
}));

import { GET } from './route';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';
import { getAllPrimeUsers } from '@/lib/prime-users';

beforeEach(() => {
  vi.resetAllMocks();
});
```

**Session-fixture helper pattern** (lines 34-66):
```typescript
function makeSession(overrides = {}) {
  return {
    accessToken: 'tok-x',
    refreshToken: 'r-x',
    userEmail: 'jane@shbr.com',
    userName: 'jane@shbr.com',
    expiresAt: Date.now() + 3600_000,
    save: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };
}

function makePrimeUser(overrides: Partial<PrimeUser> = {}): PrimeUser {
  return {
    id: 'u1', email: 'jane@shbr.com', fullName: 'Jane Doe',
    firstName: 'Jane', lastName: 'Doe',
    division: null, region: null, roleOrTrade: null,
    status: 'active',
    ...overrides,
  };
}
```

**Status-code assertion pattern** (lines 134-156):
```typescript
it('returns 401 when no userEmail in session', async () => {
  mockedGetSession.mockResolvedValue(makeSession({ userEmail: '' }) as never);
  const res = await GET();
  expect(res.status).toBe(401);
  // assert getAllPrimeUsers was NOT called
});
```

**Required test cases (per D-18):**
- 401 when no session userEmail
- 403 when authenticated non-admin
- 200 with `{ users, lastSuccessAt, lastError }` body when admin
- 200 even when `getAllPrimeUsers()` returns `[]` (graceful degrade per D-12)

---

### `components/ui/PrimeUserPicker.tsx` (component, event-driven)

**Analog:** No existing combobox in codebase. Hand-roll using:
1. `app/search/page.tsx:86-114` for filter pattern
2. `app/admin/page.tsx:295-301` for input chrome
3. `components/ui/TopBar.tsx:98-107` for two-line display tokens

**Imports pattern** (mirror `'use client'` files in `components/ui/`):
```typescript
'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { User, X, AlertCircle, Plus, Loader2 } from 'lucide-react';
import type { PrimeUser } from '@/lib/prime-users';
import { resolveDisplayName, isUnresolvedEmail } from '@/lib/identity-display';
```

Named export per CONVENTIONS.md (no default).

**Filter pattern** (from `app/search/page.tsx:88-96`):
```typescript
if (query) {
  const q = query.toLowerCase();
  result = result.filter((j) =>
    j.jobNumber.toLowerCase().includes(q) ||
    j.address.toLowerCase().includes(q) ||
    j.clientReference.toLowerCase().includes(q) ||
    j.description.toLowerCase().includes(q)
  );
}
```

For Phase 3, transform to pure exported function (per RESEARCH §Pattern 1):
```typescript
export function filterPrimeUsers(query: string, users: PrimeUser[]): PrimeUser[] {
  const q = query.trim().toLowerCase();
  if (!q) return users;
  return users.filter(u =>
    u.fullName.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.division ?? '').toLowerCase().includes(q)
  );
}
```

Null-safety on `division` field is critical (probe-confirmed always-null in tenant).

**Input chrome pattern** (from `app/admin/page.tsx:295-301`):
```typescript
<textarea
  value={adminEmailsRaw}
  onChange={(e) => setAdminEmailsRaw(e.target.value)}
  rows={4}
  placeholder="admin@shbr.com.au&#10;manager@shbr.com.au"
  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 resize-none font-mono"
/>
```

For picker `<input>`, drop the `font-mono`/`resize-none`, keep the rest (UI-SPEC §"Picker input" locks `bg-gray-800 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40`).

**Search-input "X clear" pattern** (from `app/search/page.tsx:135-142`):
```typescript
{query && (
  <button
    onClick={() => setQuery('')}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
  >
    <X size={14} />
  </button>
)}
```

For chip remove buttons, use the same `text-gray-500 hover:text-red-400` from UI-SPEC.

**Two-line row pattern** (from `app/admin/page.tsx:629-631` — existing audit row):
```typescript
<div className="text-gray-300 text-sm">{entry.name || entry.email}</div>
{entry.name && <div className="text-gray-600 text-xs">{entry.email}</div>}
```

UI-SPEC §"Picker dropdown row" locks the exact JSX skeleton; follow lines 263-283 of `03-UI-SPEC.md` verbatim.

**Email-shape regex pattern** (from `app/api/admin/page-visibility/route.ts:49`):
```typescript
body.admins = (body.admins || []).map((e: string) => e.toLowerCase().trim()).filter(Boolean);
```

For manual-email fallback (D-12), normalize the same way + apply UI-SPEC §"Email-shape check" regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.

**Keyboard handler pattern** (Pure React, no existing analog; follow UI-SPEC §"Keyboard Interaction Model"):
```typescript
function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActiveIndex(i => Math.max(i - 1, 0));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (filtered[activeIndex]) add(filtered[activeIndex].email);
  } else if (e.key === 'Escape') {
    setOpen(false);
  } else if (e.key === 'Backspace' && query === '' && selectedEmails.length > 0) {
    remove(selectedEmails[selectedEmails.length - 1]);
  }
}
```

`useId()` hook generates the `listId` for ARIA `aria-controls` (UI-SPEC §"ARIA Contract").

---

### `lib/identity-display.ts` (utility, pure transform)

**Analog (cascade philosophy):** `components/ui/TopBar.tsx:48`

**Phase 2 cascade pattern** (1 line — to extend):
```typescript
const displayName = primeUser?.fullName?.trim() || userEmail;
```

Phase 3 D-15 extends to 3 layers; the `.trim()` whitespace-defensive check propagates.

**Lookup pattern** (from `lib/page-visibility.ts:121-129`):
```typescript
export function isAdminEmail(
  email: string,
  config: VisibilityConfig
): boolean {
  const normalised = email.toLowerCase().trim();
  const envAdmin = (process.env.ADMIN_EMAIL || 'chris.freeman@techgurus.com.au').toLowerCase();
  if (normalised === envAdmin) return true;
  return config.admins.map((a) => a.toLowerCase()).includes(normalised);
}
```

For `lib/identity-display.ts`, use the same `.trim().toLowerCase()` normalization on input email before matching against the lowercase-stored `PrimeUser.email`:
```typescript
const normalised = email.trim().toLowerCase();
const live = primeUsers.find(u => u.email === normalised);
```

**Three-step cascade implementation** (from RESEARCH §Pattern 3 — copy verbatim):
```typescript
import type { PrimeUser } from '@/lib/prime-users';

export function resolveDisplayName(
  email: string,
  primeUsers: PrimeUser[],
  fallbackName?: string | null
): string {
  const normalised = email.trim().toLowerCase();
  const live = primeUsers.find(u => u.email === normalised);
  if (live?.fullName?.trim()) return live.fullName.trim();
  if (fallbackName?.trim()) return fallbackName.trim();
  return email;
}

export function isUnresolvedEmail(email: string, primeUsers: PrimeUser[]): boolean {
  const normalised = email.trim().toLowerCase();
  return !primeUsers.find(u => u.email === normalised);
}

export function findPrimeUser(email: string, primeUsers: PrimeUser[]): PrimeUser | null {
  const normalised = email.trim().toLowerCase();
  return primeUsers.find(u => u.email === normalised) ?? null;
}
```

Named exports (no default).

---

### `lib/identity-display.test.ts` (test, pure-function)

**Analog:** `lib/audit.test.ts` (pure-module Vitest pattern)

**Imports + describe block pattern** (lines 1-28):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vercel/blob', () => ({ /* ... */ }));

import { put, list } from '@vercel/blob';
import { appendAuditLog, readAuditLog, type AuditEntry } from './audit';
```

For `identity-display.test.ts`, no module-boundary mocks needed — pure function. Just:
```typescript
import { describe, it, expect } from 'vitest';
import { resolveDisplayName, isUnresolvedEmail, findPrimeUser } from './identity-display';
import type { PrimeUser } from './prime-users';
```

**Required test cases (per D-18):**
- live name hit → returns `primeUser.fullName.trim()`
- live name empty/whitespace-only → falls through to `fallbackName`
- live name absent + `entry.name` present → returns `entry.name.trim()`
- live name absent + `entry.name` absent → returns email verbatim
- mixed-case email input matches lowercase Prime emails (`.trim().toLowerCase()` invariant)
- whitespace-only fallbackName → falls through to email
- `isUnresolvedEmail` returns true for unknown email, false for known

---

### `lib/format-relative.ts` (utility, pure transform)

**Analog:** `components/ui/DataRefreshButton.tsx:24-32` (lift-and-extend)

**Existing helper to extract** (verbatim):
```typescript
function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} mins ago`;
  const diffHrs = Math.floor(diffMins / 60);
  return diffHrs === 1 ? '1 hr ago' : `${diffHrs} hrs ago`;
}
```

**Extension required (UI-SPEC §"Refresh Button" locks unit thresholds):**

| Elapsed | Output |
|---------|--------|
| < 60 seconds | `just now` |
| < 60 minutes | `{n}m ago` |
| < 24 hours | `{n}h ago` |
| < 7 days | `{n} day[s] ago` |
| < 30 days | `{n} week[s] ago` |
| ≥ 30 days | `{n} month[s] ago` |

Pluralization rule: `1 day ago` for n=1, `2 days ago` for n=2+. Same for `week`/`weeks`, `month`/`months`.

Function should accept `string | Date | number` to be ergonomic for ISO timestamps from blob metadata. Name + signature locked: `export function formatRelative(input: string | Date | number): string`.

After extraction, update `components/ui/DataRefreshButton.tsx:24-32` to import from `lib/format-relative.ts` (the existing inline copy must stay byte-equivalent for short elapsed times, OR planner accepts the slight wording change `'1 min ago'` → `'1m ago'` — flag in the plan).

---

### `app/admin/visibility-tab.tsx` (extracted component, request-response)

**Analog:** `app/admin/page.tsx:129-453` (existing `VisibilityTab` body — extracted verbatim, then modified)

**Helpers that move with it** (per RESEARCH Pitfall 7 cut-line audit):
- `slugify` (line 30-32) — moves into `visibility-tab.tsx`
- `pageGroups` (line 34-39) — moves
- `EMPTY_CONFIG` (line 41) — moves
- `GroupCard` (lines 457-490) — moves AND modifies (textarea → chip-row + picker)

**Existing fetch + state pattern** (lines 143-189):
```typescript
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
```

**Save pattern** (lines 165-189) — preserve exactly per D-05:
```typescript
async function handleSave() {
  setSaving(true);
  try {
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
```

**MODIFICATION:** Replace `adminEmailsRaw` textarea state with picker-driven `admins: string[]`. The save-side normalization stays. New email-list source for save is `config.admins` directly.

**Toast pattern** (lines 273-282) — preserve verbatim:
```typescript
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
```

**Section card pattern** (lines 285-307 — preserved chrome, replaced content):
```typescript
<section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
  <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
    <Shield size={15} className="text-red-400" />
    <h2 className="text-sm font-semibold text-white">Dashboard Admins</h2>
    <span className="text-xs text-gray-600 ml-1">Additional users who can see this admin area and all pages</span>
  </div>
  <div className="p-5">
    {/* REPLACE textarea with <PrimeUserPicker> */}
  </div>
</section>
```

**New: refresh button + metadata strip** — UI-SPEC §"Refresh Button + Metadata Strip" locks the JSX skeleton (lines 410-447).

**Loading-spinner pattern** (line 252-254):
```typescript
if (loading) {
  return <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-500" /></div>;
}
```

**Reuse for picker:** Wrap initial `/api/admin/prime-users` fetch in the same loading guard so the page renders the picker only once `availableUsers` is populated.

**Named export per CONVENTIONS.md:** `export function VisibilityTab() { ... }` (not default — admin/page.tsx is the only default-export Next.js page file in this slice).

---

### `app/admin/audit-tab.tsx` (extracted component, request-response)

**Analog:** `app/admin/page.tsx:533-642` (existing `AuditTab` body)

**Helpers that move with it** (per cut-line audit):
- `formatAEDT` (lines 499-506)
- `ActionBadge` (lines 508-516)
- `exportCSV` (lines 518-531) — REWRITE per D-17 + RESEARCH §Pattern 5 to use `downloadCSV` from `lib/export-csv.ts`
- `ActionFilter`, `RangeFilter` types (lines 496-497)

**Existing fetch + interval pattern** (lines 542-566) — preserve verbatim:
```typescript
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
```

**ADDITIVE:** Add a parallel fetch for `/api/admin/prime-users` on mount; gate audit-table render on both fetches resolving (per RESEARCH Pitfall 6 — avoid bare-email flicker):
```typescript
const [primeUsers, setPrimeUsers] = useState<PrimeUser[]>([]);
useEffect(() => {
  fetch('/api/admin/prime-users')
    .then(r => r.ok ? r.json() : { users: [] })
    .then((d: { users: PrimeUser[] }) => setPrimeUsers(d.users || []))
    .catch(() => setPrimeUsers([]));
}, []);
```

**Existing audit row pattern** (lines 626-635) — modified per D-15/D-16:
```typescript
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
```

**Replace with cascade-driven cell** (UI-SPEC §"Audit Tab Actor Cell" lines 481-493):
```typescript
<td
  className="px-4 py-3"
  title={entry.action === 'prime_user_miss' ? (entry.detail || 'No detail') : undefined}
>
  <div className="text-sm text-gray-300">
    {resolveDisplayName(entry.email, primeUsers, entry.name)}
  </div>
  <div className="text-xs text-gray-500">
    {entry.email}
  </div>
</td>
```

Note token upgrade: existing `text-gray-600` for line 2 → `text-gray-500` per Phase 2 standardization (UI-SPEC §"Color").

**Existing CSV export pattern** (lines 518-531 — to be replaced):
```typescript
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
```

**Replace with `downloadCSV` from `lib/export-csv.ts:5-20` + cascade column (D-17):**
```typescript
import { downloadCSV } from '@/lib/export-csv';

function exportAuditCSV(entries: AuditEntry[], primeUsers: PrimeUser[]) {
  const headers = ['Timestamp (AEDT)', 'Email', 'Display Name', 'Action'];
  const rows = entries.map(e => [
    formatAEDT(e.timestamp),
    e.email,
    resolveDisplayName(e.email, primeUsers, e.name),
    e.action,
  ]);
  downloadCSV(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}
```

**Named export per CONVENTIONS.md:** `export function AuditTab() { ... }`.

---

### `app/admin/page.tsx` (modified, page router)

**Analog:** self — preserve lines 1-123 (router shell), lines 644-796 (ChangelogTab and helpers — out of scope per Pitfall 3).

**Imports modification** (lines 1-16):
- ADD: `import { VisibilityTab } from './visibility-tab';`
- ADD: `import { AuditTab } from './audit-tab';`
- REMOVE: `Trash2`, `Save`, `Plus`, `CheckCircle`, `AlertCircle`, `Loader2`, `Download`, `RefreshCw`, `EyeOff`, `Users` from `lucide-react` (only needed by extracted tabs)
- REMOVE: `useRef`, `useCallback` from `react` (only needed by extracted tabs)
- REMOVE: `import type { AuditEntry } from '@/lib/audit'` (only audit-tab needs it)
- REMOVE: `VisibilityConfig`, `VisibilityGroup` from `@/lib/page-visibility` import (only visibility-tab needs them); KEEP `ALL_PAGES` removal too (moves to visibility-tab)

**Body to delete:**
- Lines 125-453 (`VisibilityTab` body)
- Lines 455-490 (`GroupCard`)
- Lines 492-642 (`AuditTab` + helpers `formatAEDT`, `ActionBadge`, `exportCSV` + types)
- Lines 30-41 (`slugify`, `pageGroups`, `EMPTY_CONFIG` move to visibility-tab)

**Body to keep verbatim:**
- Lines 1-29 (top imports + Tab type + TABS const — but trim unused icon imports)
- Lines 45-123 (`AdminPage` default export — auth gate + tab router)
- Lines 644-796 (ChangelogTab + TYPE_CONFIG + TypeBadge + DaySection + GITHUB_REPO — out of scope)

**Result:** ~125-200 line file after split (RESEARCH §"Recommended Project Structure"). Default export pattern for Next.js page is preserved.

---

### `lib/prime-users.ts` (modified, additive)

**Analog:** self — append a new exported reader next to `getAllPrimeUsers` and `resolveByEmail`.

**Existing read API pattern** (lines 193-222):
```typescript
export async function getAllPrimeUsers(): Promise<PrimeUser[]> {
  const blob = await getCached<PrimeUserDirectoryBlob>(BLOB_KEY);
  // ... three branches: first-miss, stale-30d, fresh
  return blob.users;
}

export async function resolveByEmail(email: string): Promise<PrimeUser | null> {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;
  const users = await getAllPrimeUsers();
  return users.find(u => u.email === needle) ?? null;
}
```

**ADD: `getDirectoryMetadata()`** (per RESEARCH §Pattern 4 Recommendation Option 1):
```typescript
/**
 * Read-only access to the directory blob's metadata fields.
 *
 * Phase 3 D-11 — surfaced by `GET /api/admin/prime-users` so the picker UI
 * can render "Last refreshed: 5 days ago" without recomputing it.
 *
 * Does NOT trigger refresh. Returns nulls when blob is missing (first-miss
 * not yet bootstrapped) per D-16 graceful-degradation.
 */
export async function getDirectoryMetadata(): Promise<{
  lastSuccessAt: string | null;
  lastError: string | null;
}> {
  const blob = await getCached<PrimeUserDirectoryBlob>(BLOB_KEY);
  return {
    lastSuccessAt: blob?.lastSuccessAt || null,
    lastError: blob?.lastError ?? null,
  };
}
```

**No changes to existing functions** — purely additive (D-22 carve-out documented in RESEARCH §Pattern 4).

---

## Shared Patterns

### Two-gate admin auth
**Source:** `app/api/admin/prime-users/refresh/route.ts:28-40`
**Apply to:** `app/api/admin/prime-users/route.ts` (the new GET)
**Status codes:** 401 unauthenticated, 403 not-admin (NOT 404 — that's the audit-entries stealth pattern, do not replicate per RESEARCH Pitfall 4)

```typescript
const session = await getSession();
if (!session.userEmail) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const config = await getVisibilityConfig();
if (!isAdminEmail(session.userEmail, config)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Email normalization
**Source:** `app/api/admin/page-visibility/route.ts:49`, `lib/prime-users.ts:218`, `lib/page-visibility.ts:125`
**Apply to:** ALL email writes from picker, manual-fallback, cascade lookup
**Pattern:** `.trim().toLowerCase()` — applied on STORE (RESEARCH Pitfall 2) and on COMPARE.

```typescript
const normalised = email.trim().toLowerCase();
```

### Logging namespace
**Source:** `lib/prime-users.ts:155` (`[prime-users]`), `lib/page-visibility.ts` (none — silent), `app/api/audit/entries/route.ts:58` (`[audit/entries]`)
**Apply to:** New GET endpoint uses `[admin-prime-users]`. CONVENTIONS.md `[namespace]` prefix.
**Pattern:**
```typescript
console.error('[admin-prime-users]', err);
```

### Tailwind dark-theme tokens (UI-SPEC §"Color" locks all)
**Source:** `components/ui/TopBar.tsx:103` (`text-gray-300`), `app/admin/page.tsx:288` (section card `bg-gray-900 rounded-xl border border-gray-800`)
**Apply to:** All new admin surfaces
**Identity tokens:**
- Primary line: `text-sm text-gray-300`
- Secondary line: `text-xs text-gray-500`
- Section card: `bg-gray-900 rounded-xl border border-gray-800 overflow-hidden`
- Section header: `flex items-center gap-2 px-5 py-4 border-b border-gray-800`
- Section title: `text-sm font-semibold text-white`
- Input chrome: `bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500`
- Save CTA: `bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg`
- Secondary button: `bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg`

### Vitest module-boundary mocking
**Source:** `app/api/auth/session/route.test.ts:5-12`, `app/api/auth/login/route.test.ts:6-13`, `lib/prime-users.test.ts:39-47`
**Apply to:** `app/api/admin/prime-users/route.test.ts`, `lib/identity-display.test.ts`, picker filter test
**Pattern:**
```typescript
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/page-visibility', () => ({
  getVisibilityConfig: vi.fn(),
  isAdminEmail: vi.fn(() => false),
}));

// AFTER mocks: import the SUT
import { GET } from './route';

beforeEach(() => { vi.resetAllMocks(); });
```

### Toast feedback
**Source:** `app/admin/page.tsx:160-163, 273-282`
**Apply to:** Extracted `VisibilityTab` (preserve verbatim) — refresh-button error path also feeds the same toast surface per UI-SPEC §"Loading / Empty / Error States".
**Pattern (state):**
```typescript
function showToast(type: 'ok' | 'err', msg: string) {
  setToast({ type, msg });
  setTimeout(() => setToast(null), 3500);
}
```

### Loading spinner
**Source:** `app/admin/page.tsx:253` (Loader2 in spinner) + `components/ui/DataRefreshButton.tsx:140` (animate-spin in button)
**Apply to:** Picker initial-fetch loading state, Refresh button busy state
**Pattern:**
```typescript
{loading
  ? <Loader2 size={22} className="animate-spin text-gray-500" />
  : null
}
```

In-button busy state:
```typescript
<RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
```

### Cross-tab routing (preserve)
**Source:** `app/admin/page.tsx:50-82`
**Apply to:** None — `app/admin/page.tsx` keeps the tab router intact. Extracted children get `tab` param via React state, not URL parsing.

### Two-line row render (DISPLAY-01, DISPLAY-02, DISPLAY-03)
**Source:** `app/admin/page.tsx:626-631` (existing audit row pattern), `components/ui/TopBar.tsx:103-106` (TopBar identity), Phase 2 UI-SPEC tokens
**Apply to:** Picker dropdown rows, picker chips, group member rows, dashboard admin rows, audit actor cells
**Pattern (D-06 + UI-SPEC §"Picker dropdown row"):**
```typescript
<div className="flex items-start gap-2 min-w-0">
  <User size={14} className="text-gray-500 mt-0.5 shrink-0" />
  <div className="min-w-0 flex-1">
    <div className="text-sm text-gray-300 truncate">
      {primary /* fullName?.trim() || email */}
    </div>
    <div className="text-xs text-gray-500 truncate">
      {email}{division && <span> · {division}</span>}
    </div>
  </div>
</div>
```

For unresolved emails (D-08 + D-09): omit Line 2 entirely, add `title="No Prime record found"` on the wrapper.

---

## No Analog Found

Files without a strong codebase analog (planner should follow RESEARCH.md and UI-SPEC.md prescriptively):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `components/ui/PrimeUserPicker.tsx` (combobox shell) | component | event-driven | No existing combobox / typeahead component in this codebase. Built from primitives: `app/search/page.tsx` filter pattern + `app/admin/page.tsx:295-301` input chrome + UI-SPEC §"Anatomy & Interaction Contract" prescriptive JSX. Plain React + ARIA roles per RESEARCH "Don't Hand-Roll" verdict. No `@headlessui/react`, `cmdk`, `react-select`, or `react-aria` in `package.json`. |

For this single file, the planner MUST use the UI-SPEC document (lines 212-405) as the visual source of truth and RESEARCH.md §Pattern 1 (lines 297-376) as the architectural source of truth. Both are exhaustive and align by design.

## Metadata

**Analog search scope:**
- `app/admin/` (existing admin page, primary modification target)
- `app/api/admin/` (sibling routes — exact two-gate match)
- `app/api/audit/entries/` (alternate auth pattern — REJECTED per Pitfall 4)
- `app/api/auth/session/` and `app/api/auth/login/` (test patterns)
- `app/search/` (filter idiom — verified by RESEARCH)
- `components/ui/` (existing component conventions — TopBar, DataRefreshButton, AuthGuard)
- `lib/` (utility conventions — prime-users, page-visibility, audit, session, export-csv, auth-context)

**Files scanned:** 18

**Key cross-cutting findings:**
1. Codebase has 3 slightly-different two-gate admin-auth patterns; D-11 mandates mirroring the `refresh/route.ts` 401/403 variant exactly. Do NOT introduce a fourth pattern.
2. Email normalization is a project-wide invariant (`.trim().toLowerCase()`); applies to picker writes, manual-fallback, and cascade lookups.
3. The existing `formatRelative()` in `DataRefreshButton.tsx` is a partial implementation; D-13 requires extending unit thresholds (days/weeks/months) — extract to shared `lib/format-relative.ts`.
4. The existing `exportCSV()` in `app/admin/page.tsx` re-implements escaping that already exists in `lib/export-csv.ts:downloadCSV` (used by 9 other pages). D-17 column rename is the right moment to consolidate.
5. The existing audit-row two-line render (`app/admin/page.tsx:629-631`) uses `text-gray-600` for the secondary email; UI-SPEC standardizes to `text-gray-500` per Phase 2 — minor visual change, intentional.
6. No combobox library exists; ARIA `combobox`/`listbox`/`option` roles + `useId()` + 4-key keyboard handler are sufficient (RESEARCH "Don't Hand-Roll" verdict).
7. Test pattern (Vitest + module-boundary mocks) is consistent across Phase 1 and Phase 2 tests; Phase 3 follows directly.

**Pattern extraction date:** 2026-04-25
