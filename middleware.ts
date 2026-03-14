import { NextRequest, NextResponse } from 'next/server';

const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET || 'shbr2026';
const PUBLIC_PATHS = ['/api/health', '/api/auth/login'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow API routes (they're protected server-side)
  // But check cookie or query param for page routes
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Check for secret in cookie
  const cookieSecret = req.cookies.get('shbr_secret')?.value;
  if (cookieSecret === DASHBOARD_SECRET) {
    return NextResponse.next();
  }

  // Not authenticated — show login page
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('redirect', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
};
