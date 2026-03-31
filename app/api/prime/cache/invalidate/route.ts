import { NextResponse } from 'next/server';
import { invalidateCache } from '@/lib/blob-cache';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';

// ── #6 FIX: Require authenticated session in-handler (not just middleware) ────
// Only the admin email can flush the cache to prevent any authenticated user
// from disrupting the cache for everyone else.
const ADMIN_EMAIL = 'chris.freeman@techgurus.com.au';

export async function POST() {
  try {
    const session = await getSession();

    if (!session.accessToken || !session.userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Invalidate all known Prime data cache keys
    const keys = [
      'open-jobs-flat-v3',
      'ops-data-v3',
      'kpis-v3',
      'counts-by-status-v5',
      'pipeline-v4',
      'trends-v3',
      'aging-v3',
      'appointments-v1',
      'financial-v2',
      'invoices-ap',
      'invoices-ar',
      'statuses',
      'peril-names-v1',
    ];
    await Promise.all(keys.map(k => invalidateCache(k)));
    return NextResponse.json({ ok: true, message: 'Cache cleared. Fresh data will be fetched on next load.' });
  } catch (err: unknown) {
    console.error('[cache/invalidate] Error:', err);
    // ── #7 FIX: Don't leak internal error details to client ───────────────────
    return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 });
  }
}
