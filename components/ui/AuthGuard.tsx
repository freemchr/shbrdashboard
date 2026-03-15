'use client';

// AuthGuard is now a passthrough — authentication is handled by:
// 1. middleware.ts (cookie presence check)
// 2. API routes (iron-session full validation)
// The login page is at /login and handles the auth flow.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
