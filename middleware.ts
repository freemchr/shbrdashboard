import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
]);

// Paths allowed when called with the Vercel cron authorization header
const CRON_PATHS = new Set([
  '/api/prime/jobs/timeline',
  '/api/prime/jobs/geocode-auto',
]);

const PUBLIC_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|css|js|map)$/i;

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (PUBLIC_EXTENSIONS.test(pathname)) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Allow Vercel cron jobs (they send Authorization: Bearer <CRON_SECRET>)
  if (CRON_PATHS.has(pathname)) {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return NextResponse.next();
    }
    // Also allow internal Vercel cron calls (x-vercel-cron header)
    if (req.headers.get('x-vercel-cron') === '1') {
      return NextResponse.next();
    }
  }

  const session = req.cookies.get('shbr_session');
  if (!session?.value) {
    // API requests → 401 JSON (don't redirect API calls to login page)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Page requests → redirect to login
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
