/**
 * Admin API — Page Visibility Config
 * GET  /api/admin/page-visibility   → returns current config
 * POST /api/admin/page-visibility   → saves updated config
 *
 * Admin-only: only the ADMIN_EMAIL can call these endpoints.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getVisibilityConfig, saveVisibilityConfig, VisibilityConfig } from '@/lib/page-visibility';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'chris.freeman@techgurus.com.au';

async function assertAdmin(): Promise<{ error: NextResponse } | null> {
  const session = await getSession();
  if (!session.accessToken) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }
  if (session.userEmail?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return null;
}

export async function GET() {
  const guard = await assertAdmin();
  if (guard) return guard.error;

  const config = await getVisibilityConfig();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const guard = await assertAdmin();
  if (guard) return guard.error;

  const session = await getSession();

  try {
    const body: VisibilityConfig = await req.json();

    // Basic validation
    if (!Array.isArray(body.groups) || !Array.isArray(body.pages)) {
      return NextResponse.json({ error: 'Invalid config shape' }, { status: 400 });
    }

    // Normalise all emails to lowercase
    body.groups = body.groups.map((g) => ({
      ...g,
      members: g.members.map((m) => m.toLowerCase().trim()).filter(Boolean),
    }));

    body.updatedAt = new Date().toISOString();
    body.updatedBy = session.userEmail;

    await saveVisibilityConfig(body);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[page-visibility] Save error:', e);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
