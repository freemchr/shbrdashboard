/**
 * GET /api/admin/prime-users — admin-gated read of the cached Prime user directory.
 *
 * Response (200):
 *   { users: PrimeUser[], lastSuccessAt: string | null, lastError: string | null }
 *
 * Response (401): { error: 'Unauthorized' }   when session has no userEmail
 * Response (403): { error: 'Forbidden' }      when caller is not an admin
 *
 * D-15: served by this endpoint; consumed by `lib/prime-directory-context.tsx`
 *       once per admin-page mount.
 * D-20: cache-empty case returns { users: [], lastSuccessAt: null, lastError: null }
 *       so the picker's empty-cache state (UI-SPEC Surface 9) renders correctly.
 * Pitfall 5: this endpoint MUST NOT use the public `getAll…` helper from
 *            lib/prime-users — that helper has a first-miss bootstrap branch
 *            that fires a Prime API call (Phase 1 D-03). Cold deploys would
 *            silently spike Prime usage. Use `getCached()` directly for a pure
 *            cache read. (The grep audit in this plan's acceptance criteria
 *            asserts neither the public read helper name nor the refresh
 *            helper name appears anywhere in this file.)
 *
 * Auth pattern is the verbatim twin of `app/api/admin/prime-users/refresh/route.ts`
 * (PATTERNS Pattern 1 — the immediate sibling).
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';
import { getCached } from '@/lib/blob-cache';
import type { PrimeUserDirectoryBlob } from '@/lib/prime-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';   // session-touching; matches sibling
// No maxDuration — pure cache read, no Prime call, default Edge timeout is plenty.

// Inlined literal — see lib/prime-users.ts:29 BLOB_KEY constant.
// Re-exporting BLOB_KEY would touch lib/prime-users.ts; a single-call-site inline
// is the smaller change. PATTERNS option (b).
const BLOB_KEY = 'shbr-admin/prime-users.json';

export async function GET() {
  // Gate 1: authenticated session?
  const session = await getSession();
  if (!session.userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Gate 2: admin?  (uses lib/page-visibility.ts:isAdminEmail which handles
  // env ADMIN_EMAIL + config.admins + the existing hardcoded fallback per CLAUDE.md.)
  const config = await getVisibilityConfig();
  if (!isAdminEmail(session.userEmail, config)) {
    // Open Question 1 → 403 to match the immediate sibling (refresh route).
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Pure cache read. getCached() swallows blob errors and returns null
  // (lib/blob-cache.ts:91-93), so missing/broken blob lands in the
  // `blob?.users ?? []` fallback below. No try/catch needed.
  const blob = await getCached<PrimeUserDirectoryBlob>(BLOB_KEY);

  return NextResponse.json({
    users: blob?.users ?? [],
    lastSuccessAt: blob?.lastSuccessAt ?? null,
    lastError: blob?.lastError ?? null,
  });
}
