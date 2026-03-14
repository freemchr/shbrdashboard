import { NextRequest, NextResponse } from 'next/server';

// Minimal middleware — just pass everything through
// Auth is handled client-side via localStorage
export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
