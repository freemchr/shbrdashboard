import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS = ['login', 'logout'] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, action } = body;

    if (!email || typeof email !== 'string' || email.length > 255) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await appendAuditLog({
      email: email.trim().toLowerCase(),
      name: name ? String(name).slice(0, 255) : undefined,
      action,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[audit/log] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
