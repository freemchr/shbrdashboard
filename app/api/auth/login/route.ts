import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { appendAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
      const errorText = await tokenResponse.text();
      console.error('Prime OAuth error:', tokenResponse.status, errorText);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Fetch user name from Prime
    let userName = email;
    try {
      const encodedEmail = encodeURIComponent(email);
      const userResponse = await fetch(`${primeBaseUrl}/users?filter[email]=${encodedEmail}`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/vnd.api.v2+json',
        },
      });
      if (userResponse.ok) {
        const userData = await userResponse.json();
        const user = userData?.data?.[0];
        if (user) {
          userName = user.attributes?.name || user.attributes?.fullName || email;
        }
      }
    } catch (err) {
      console.warn('Could not fetch user name:', err);
    }

    // Store session
    const session = await getSession();
    session.accessToken = access_token;
    session.refreshToken = refresh_token || '';
    session.expiresAt = Date.now() + (expires_in || 28800) * 1000;
    session.userName = userName;
    session.userEmail = email;
    await session.save();

    // Log login event — must await before response or Vercel will kill the function
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;
    await appendAuditLog({
      email: email.trim().toLowerCase(),
      name: userName,
      action: 'login',
      details: 'Login successful',
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, userName });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
