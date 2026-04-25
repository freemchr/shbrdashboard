/**
 * Cached Prime user directory.
 *
 * Server-only module composing `lib/prime-auth.ts` (OAuth + 429/401 retry +
 * pagination throttle) with `lib/blob-cache.ts` (persistent + in-memory layer).
 * Exposes a read-only view of Prime `/users` suitable for Phase 2 login
 * resolution and Phase 3 picker / admin-list display.
 *
 * Contract:
 * - Refresh is on-demand only (D-01). No cron. No TTL-driven auto-refresh.
 *   Two implicit refresh triggers:
 *     (a) first-miss bootstrap — blob doesn't exist yet (D-03)
 *     (b) 30-day safety net — `lastSuccessAt` older than 30 days (D-04)
 *   Admin endpoint (Plan 03) drives the explicit third trigger.
 * - `getAllPrimeUsers()` / `resolveByEmail()` NEVER throw — Prime/Blob failure
 *   degrades to `[]` / `null` per D-16.
 * - Refresh failure preserves previous cache (D-17). On first-miss failure,
 *   NO blob is written (RESEARCH Pitfall 1 — avoids silently empty directory
 *   for 30 days).
 *
 * Emits all internal errors under the `[prime-users]` log prefix (D-18).
 * No entries added to `lib/audit.ts` (audit is scoped to user auth events).
 */

import { primeGetAllPages } from '@/lib/prime-auth';
import { getCached, setCached } from '@/lib/blob-cache';

// ── File-level constants ─────────────────────────────────────────────────────
const BLOB_KEY = 'shbr-admin/prime-users.json';            // D-05 — shbr-admin/ namespace, co-located with page-visibility
const INDEFINITE_TTL_MS = 50 * 365 * 24 * 60 * 60 * 1000;  // D-01 — effectively never expires (50y)
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;       // D-04 — 30-day safety net

// ── Exported types (D-08 + D-19) ─────────────────────────────────────────────
export interface PrimeUser {
  id: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  division: string | null;
  region: string | null;
  roleOrTrade: string | null;
  status: string;
}

export interface PrimeUserDirectoryBlob {
  schemaVersion: 1;
  users: PrimeUser[];
  lastSuccessAt: string;
  lastAttemptAt: string;
  lastError: string | null;
  lastErrorAt: string | null;
}

interface RawPrimeUser {
  id: string;
  type?: string;
  attributes?: Record<string, unknown>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Defensive string coercion. Returns the trimmed string if non-empty, else null.
 */
function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * First non-empty trimmed string from an unknown-typed array, else null.
 * Used for Prime's `roles: string[]` attribute (probe-confirmed shape).
 */
function firstStr(v: unknown): string | null {
  if (!Array.isArray(v)) return null;
  for (const item of v) {
    const s = str(item);
    if (s !== null) return s;
  }
  return null;
}

/**
 * Map one Prime JSON:API `/users` record → PrimeUser.
 *
 * Probe findings (see `lib/prime-users.test.ts` PROBE FINDINGS block,
 * 2026-04-24 against live SHBR tenant, 5 records):
 *   - `division` and `region` keys ABSENT — mapper returns null.
 *   - `roles: string[]` present (not scalar `role` or `trade`) — mapper reads
 *     the first non-empty element. `str(a.role) ?? str(a.trade)` defensive
 *     fallbacks remain as safety belts per RESEARCH.md; they'll always be
 *     null in this tenant but protect against shape drift in future probes.
 *
 * Only the nine D-08 fields are read — `...raw.attributes` is NEVER spread
 * (T-05 mitigation: no PII leak if Prime returns phone/address/etc.).
 */
export function mapRawToPrimeUser(raw: RawPrimeUser): PrimeUser {
  const a = raw.attributes ?? {};
  const firstName = str(a.firstName) ?? '';
  const lastName = str(a.lastName) ?? '';
  return {
    id: raw.id,
    email: (str(a.email) ?? '').toLowerCase(),               // D-09 on STORE
    fullName: str(a.fullName) ?? `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    division: str(a.division),                               // probe: ABSENT → null
    region: str(a.region),                                   // probe: ABSENT → null
    // Probe-confirmed primary: attributes.roles is a string[].
    // Safety belts (role/trade) preserved per RESEARCH.md — protect against
    // shape drift without perturbing tested fallback semantics.
    roleOrTrade: firstStr(a.roles) ?? str(a.roleOrTrade) ?? str(a.role) ?? str(a.trade),
    status: str(a.status) ?? 'unknown',
  };
}

// ── Refresh (the single shared path — D-10) ──────────────────────────────────

/**
 * Fetch fresh Prime users, map, and persist to the blob.
 *
 * Preserve-on-failure semantics (D-17, D-19):
 * - If Prime throws AND an existing blob exists → persist a new blob that
 *   reuses `existing.users` + `existing.lastSuccessAt` but overwrites
 *   `lastAttemptAt`/`lastError`/`lastErrorAt`. Users array is NEVER wiped.
 * - If Prime throws AND no existing blob → NO `setCached` call
 *   (RESEARCH Pitfall 1: writing `{ users: [] }` would satisfy the 30-day
 *   safety net check and leave the directory empty for 30 days).
 *
 * `opts.reason` is passed through for log context (currently informational).
 */
export async function refreshPrimeUsers(
  opts: { reason: 'admin' | 'first-miss' | 'stale-30d' }
): Promise<{ ok: boolean; blob: PrimeUserDirectoryBlob; durationMs: number }> {
  const attemptAt = new Date().toISOString();
  const t0 = Date.now();
  const existing = await getCached<PrimeUserDirectoryBlob>(BLOB_KEY);

  try {
    const raw = (await primeGetAllPages('/users', 100)) as RawPrimeUser[];
    const users = raw.map(mapRawToPrimeUser);
    const blob: PrimeUserDirectoryBlob = {
      schemaVersion: 1,
      users,
      lastSuccessAt: new Date().toISOString(),
      lastAttemptAt: attemptAt,
      lastError: null,
      lastErrorAt: null,
    };
    await setCached(BLOB_KEY, blob, INDEFINITE_TTL_MS);
    return { ok: true, blob, durationMs: Date.now() - t0 };
  } catch (err) {
    console.error('[prime-users] refresh failed:', err);    // D-18 + CLAUDE.md "log internally"
    const blob: PrimeUserDirectoryBlob = {
      schemaVersion: 1,
      users: existing?.users ?? [],
      lastSuccessAt: existing?.lastSuccessAt ?? '',
      lastAttemptAt: attemptAt,
      lastError: err instanceof Error ? err.message : String(err),
      lastErrorAt: attemptAt,
    };
    // D-14 / D-17 + RESEARCH Pitfall 1:
    // Only persist error metadata when an existing blob is present.
    // First-miss + Prime-down MUST NOT write an empty-users blob.
    if (existing) {
      await setCached(BLOB_KEY, blob, INDEFINITE_TTL_MS);
    }
    // opts.reason: informational pass-through; kept on the signature for
    // Wave 2's admin endpoint log context.
    void opts.reason;
    return { ok: false, blob, durationMs: Date.now() - t0 };
  }
}

// ── Public read API (D-07) ───────────────────────────────────────────────────

/**
 * Return the cached PrimeUser list.
 *
 * DIR-02: NEVER calls Prime on the hot path except in the two bootstrap
 * branches below. Refactor warning — see RESEARCH.md Pitfall 4: well-meaning
 * "keep it fresh" additions here burn the Prime budget on every call.
 *
 * Branches:
 *   (a) blob missing → first-miss refresh (D-03). On success return users;
 *       on failure return [] (D-16). No blob persisted on first-miss failure.
 *   (b) blob older than 30 days → stale-30d refresh (D-04). On success return
 *       fresh users; on failure return existing users (D-17).
 *   (c) otherwise → return blob.users (no Prime call).
 */
export async function getAllPrimeUsers(): Promise<PrimeUser[]> {
  const blob = await getCached<PrimeUserDirectoryBlob>(BLOB_KEY);

  // D-03: first-miss bootstrap
  if (!blob) {
    const result = await refreshPrimeUsers({ reason: 'first-miss' });
    return result.ok ? result.blob.users : [];              // D-16: never throw
  }

  // D-04: 30-day safety net
  const lastSuccessMs = blob.lastSuccessAt ? new Date(blob.lastSuccessAt).getTime() : 0;
  if (Date.now() - lastSuccessMs > STALE_THRESHOLD_MS) {
    const result = await refreshPrimeUsers({ reason: 'stale-30d' });
    return result.ok ? result.blob.users : blob.users;      // D-17: serve stale on fail
  }

  return blob.users;
}

/**
 * Case-insensitive email lookup against the cached directory.
 * D-09 on COMPARE: `.trim().toLowerCase()` applied to input before matching.
 * Returns null for empty input without calling `getAllPrimeUsers` (DIR-02 hot-path).
 */
export async function resolveByEmail(email: string): Promise<PrimeUser | null> {
  const needle = email.trim().toLowerCase();                // D-09 on COMPARE
  if (!needle) return null;
  const users = await getAllPrimeUsers();
  return users.find(u => u.email === needle) ?? null;
}

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
