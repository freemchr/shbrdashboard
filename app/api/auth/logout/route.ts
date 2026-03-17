import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { appendAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getSession();

    // Log logout event — must await before response or Vercel will kill the function
    if (session.userEmail) {
      await appendAuditLog({
        email: session.userEmail.toLowerCase(),
        name: session.userName,
        action: 'logout',
      });
    }

    session.destroy();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
