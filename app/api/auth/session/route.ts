import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, getHiddenPaths, isAdminEmail } from '@/lib/page-visibility';

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

    return NextResponse.json({
      userName: session.userName,
      userEmail: session.userEmail,
      expiresAt: session.expiresAt,
      isAdmin,
      hiddenPaths: Array.from(hiddenPaths),
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
}
