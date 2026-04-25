/**
 * GET /api/admin/prime-users
 *
 * Admin-only read-through endpoint for the cached Prime user directory.
 * Defined by Phase 3 (Admin Picker & Identity-Rich Display), D-11.
 *
 * Auth: two-gate session check (mirrors /api/admin/prime-users/refresh)
 *   - 401 if no session cookie / no userEmail
 *   - 403 if session exists but user is not an admin
 * Response:
 *   - 200 { users: PrimeUser[], lastSuccessAt: string | null, lastError: string | null }
 *     with Cache-Control: no-store (the blob does its own caching one layer down).
 *   - 500 { users: [], lastSuccessAt: null, lastError: 'Internal error' } on uncaught error.
 *
 * This endpoint NEVER triggers a Prime API call of its own — it reads only from
 * the blob cache via getAllPrimeUsers/getDirectoryMetadata. First-miss bootstrap
 * behaviour is Phase 1's concern (see Phase 1 D-03 and Phase 3 RESEARCH Pitfall 8).
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, isAdminEmail } from '@/lib/page-visibility';
import { getAllPrimeUsers, getDirectoryMetadata } from '@/lib/prime-users';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET() {
  // Gate 1: authenticated session? (matches refresh/route.ts — do NOT use the 404 stealth variant from audit/entries)
  const session = await getSession();
  if (!session.userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Gate 2: admin? (uses lib/page-visibility.ts:isAdminEmail — env ADMIN_EMAIL + config.admins + hardcoded fallback)
  const config = await getVisibilityConfig();
  if (!isAdminEmail(session.userEmail, config)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [users, metadata] = await Promise.all([
      getAllPrimeUsers(),
      getDirectoryMetadata(),
    ]);
    return NextResponse.json(
      {
        users,
        lastSuccessAt: metadata.lastSuccessAt,
        lastError: metadata.lastError,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    console.error('[admin-prime-users]', e);
    return NextResponse.json(
      { users: [], lastSuccessAt: null, lastError: 'Internal error' },
      { status: 500 },
    );
  }
}
