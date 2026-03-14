import { NextRequest, NextResponse } from 'next/server';

const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET || 'shbr2026';

export async function POST(req: NextRequest) {
  const { secret, redirect } = await req.json();

  if (secret !== DASHBOARD_SECRET) {
    return NextResponse.json({ error: 'Invalid access code' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, redirect: redirect || '/' });
  response.cookies.set('shbr_secret', DASHBOARD_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  return response;
}
