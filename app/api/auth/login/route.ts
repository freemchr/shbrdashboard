import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { appendAuditLog } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // ── #3 FIX: Brute-force protection ──────────────────────────────────────────
  // 10 attempts per 15 minutes per IP
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const rateCheck = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!rateCheck.allowed) {
    // Add a small delay to frustrate automated tooling
    await new Promise(r => setTimeout(r, 1500));
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const primeBaseUrl = process.env.PRIME_BASE_URL;
    if (!primeBaseUrl) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Authenticate with Prime OAuth
    const tokenParams = new URLSearchParams({
      grant_type: 'password',
      username: email,
      password: password,
      client_id: process.env.PRIME_CLIENT_ID || '',
      client_secret: process.env.PRIME_CLIENT_SECRET || '',
    });

    const tokenResponse = await fetch(`${primeBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/vnd.api.v2+json',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      // ── #7 FIX: Log internally, return generic message to client ─────────────
      const errorText = await tokenResponse.text();
      console.error('Prime OAuth error:', tokenResponse.status, errorText);
      // Add delay on failure to slow down credential stuffing
      await new Promise(r => setTimeout(r, 1000));
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Normalise email — always lowercase + trimmed so admin checks are reliable
    const normalisedEmail = email.trim().toLowerCase();
    const userName = normalisedEmail;

    // Store session
    const session = await getSession();
    session.accessToken = access_token;
    session.refreshToken = refresh_token || '';
    session.expiresAt = Date.now() + (expires_in || 28800) * 1000;
    session.userName = userName;
    session.userEmail = normalisedEmail;
    await session.save();

    // Log login event
    await appendAuditLog({
      email: email.trim().toLowerCase(),
      name: userName,
      action: 'login',
    });

    return NextResponse.json({ success: true, userName });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
