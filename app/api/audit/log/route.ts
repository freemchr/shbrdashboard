import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS = ['login', 'logout', 'page_view'] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, action, page, details } = body;

    // Strict input validation
    if (!email || typeof email !== 'string' || email.length > 255) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (page && (typeof page !== 'string' || page.length > 500)) {
      return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
    }
    if (details && (typeof details !== 'string' || details.length > 1000)) {
      return NextResponse.json({ error: 'Invalid details' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    await appendAuditLog({
      email: email.trim().toLowerCase(),
      name: name ? String(name).slice(0, 255) : undefined,
      action,
      page: page || undefined,
      details: details || undefined,
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[audit/log] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
