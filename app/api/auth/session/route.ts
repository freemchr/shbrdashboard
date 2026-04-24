import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, getHiddenPaths, isAdminEmail } from '@/lib/page-visibility';
import { resolveByEmail } from '@/lib/prime-users';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();

    if (!session.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if session has expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
      session.destroy();
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const config = await getVisibilityConfig();
    const isAdmin = isAdminEmail(session.userEmail || '', config);
    const hiddenPaths = getHiddenPaths(session.userEmail || '', config, isAdmin);

    // D-01 + D-07: live-read Prime identity per request.
    // resolveByEmail NEVER throws (Phase 1 D-16) — no try/catch needed (Pattern 2).
    // D-18: cache failures inside resolveByEmail are logged by [prime-users]; do not double-log here.
    const primeUser = await resolveByEmail(session.userEmail || '');

    return NextResponse.json({
      userName: session.userName,
      userEmail: session.userEmail,
      expiresAt: session.expiresAt,
      isAdmin,
      hiddenPaths: Array.from(hiddenPaths),
      primeUser,  // PrimeUser | null — D-07
    });
  } catch (error) {
    // D-17: [session] log prefix for Phase-2-specific runtime errors.
    console.error('[session] check error:', error);
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
}
