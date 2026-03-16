import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { readAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = 'chris.freeman@techgurus.com.au';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session.accessToken || !session.userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.userEmail.toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000);
    const emailFilter = searchParams.get('email')?.toLowerCase();
    const actionFilter = searchParams.get('action');
    const range = searchParams.get('range'); // 'today' | 'week' | 'all'

    let entries = await readAuditLog();

    // Filter by email
    if (emailFilter) {
      entries = entries.filter(e => e.email.toLowerCase() === emailFilter);
    }

    // Filter by action
    if (actionFilter && ['login', 'logout', 'page_view'].includes(actionFilter)) {
      entries = entries.filter(e => e.action === actionFilter);
    }

    // Filter by date range
    if (range === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      entries = entries.filter(e => new Date(e.timestamp) >= today);
    } else if (range === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      entries = entries.filter(e => new Date(e.timestamp) >= weekAgo);
    }

    // Already sorted newest first from appendAuditLog, but ensure it
    entries = entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    entries = entries.slice(0, limit);

    return NextResponse.json({ entries, total: entries.length });
  } catch (error) {
    console.error('[audit/entries] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
