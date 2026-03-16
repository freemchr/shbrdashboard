'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const DEBOUNCE_MS = 30_000; // 30 seconds

export function AuditTracker() {
  const pathname = usePathname();
  const lastLoggedPage = useRef<string | null>(null);
  const lastLoggedTime = useRef<number>(0);
  const userEmailRef = useRef<string | null>(null);
  const userNameRef = useRef<string | null>(null);
  const fetchedSession = useRef(false);

  // Fetch session once and cache it
  useEffect(() => {
    if (fetchedSession.current) return;
    fetchedSession.current = true;

    fetch('/api/auth/session')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.userEmail) {
          userEmailRef.current = data.userEmail;
          userNameRef.current = data.userName || null;
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    // Skip login page and api routes
    if (!pathname || pathname === '/login' || pathname.startsWith('/api/')) return;

    const now = Date.now();
    const samePageRecently =
      lastLoggedPage.current === pathname &&
      now - lastLoggedTime.current < DEBOUNCE_MS;

    if (samePageRecently) return;

    // Fire and forget
    const doLog = async () => {
      // Ensure session is fetched before logging
      if (!fetchedSession.current || !userEmailRef.current) {
        // Try once more
        try {
          const res = await fetch('/api/auth/session');
          if (res.ok) {
            const data = await res.json();
            userEmailRef.current = data?.userEmail || null;
            userNameRef.current = data?.userName || null;
          }
        } catch {
          return;
        }
      }

      if (!userEmailRef.current) return;

      lastLoggedPage.current = pathname;
      lastLoggedTime.current = now;

      fetch('/api/audit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmailRef.current,
          name: userNameRef.current,
          action: 'page_view',
          page: pathname,
          details: `Viewed ${pathname}`,
        }),
      }).catch(() => null);
    };

    doLog();
  }, [pathname]);

  return null;
}
