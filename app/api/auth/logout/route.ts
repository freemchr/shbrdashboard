import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { appendAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getSession();

    // Log logout event before destroying session
    if (session.userEmail) {
      appendAuditLog({
        email: session.userEmail.toLowerCase(),
        name: session.userName,
        action: 'logout',
        details: 'Logout successful',
      }).catch(() => null);
    }

    session.destroy();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
