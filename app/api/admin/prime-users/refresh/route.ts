/**
 * POST /api/admin/prime-users/refresh
 *
 * Admin-only force-refresh of the Prime user directory cache.
 * Defined by phase 01 (Prime User Directory), DIR-03.
 *
 * Auth: two-gate session check (D-12)
 *   - 401 if no session cookie / no userEmail
 *   - 403 if session exists but user is not an admin
 * Response (D-13 / D-14):
 *   - 200 { ok: true, userCount, durationMs, cachedAt }       on refresh success
 *   - 502 { ok: false, error, lastSuccessAt }                 on Prime failure (cache preserved)
 *
 * NOT a cron endpoint (D-01) — there is intentionally NO shared-secret header
 * gate and NO entry in vercel.json. Future cron may be added in milestone v2
 * by wrapping the same refreshPrimeUsers() in a different route.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';
import { refreshPrimeUsers } from '@/lib/prime-users';

export const runtime = 'nodejs';
export const maxDuration = 60;           // matches app/api/prime/team/route.ts (similar /users fetch)
export const dynamic = 'force-dynamic';  // matches app/api/auth/login/route.ts:6 (session-touching)

export async function POST() {
  // Gate 1: authenticated session?  (RESEARCH Pitfall 3 — distinct from Gate 2)
  const session = await getSession();
  if (!session.userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Gate 2: admin?  (uses lib/page-visibility.ts:isAdminEmail which handles
  // env ADMIN_EMAIL + config.admins + the existing hardcoded fallback).
  const config = await getVisibilityConfig();
  if (!isAdminEmail(session.userEmail, config)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delegate to the shared refresh path.
  const result = await refreshPrimeUsers({ reason: 'admin' });

  if (!result.ok) {
    // D-14 — preserve existing cache, surface error metadata to admin only.
    // CLAUDE.md "log internally, return generic": refreshPrimeUsers ALREADY
    // logged the full err via console.error('[prime-users] …'); here we
    // return only the sanitized err.message captured on the blob.
    return NextResponse.json(
      {
        ok: false,
        error: result.blob.lastError ?? 'Unknown error',
        lastSuccessAt: result.blob.lastSuccessAt || null,
      },
      { status: 502 }
    );
  }

  // D-13 — success body designed for Phase 3 admin UI consumption.
  return NextResponse.json({
    ok: true,
    userCount: result.blob.users.length,
    durationMs: result.durationMs,
    cachedAt: result.blob.lastSuccessAt,
  });
}
