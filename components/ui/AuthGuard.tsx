'use client';

import { useLayoutEffect, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { Sidebar } from '@/components/ui/Sidebar';
import { TopBar } from '@/components/ui/TopBar';
import { AuditTracker } from '@/components/ui/AuditTracker';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  const isLoginPage = pathname === '/login';
  const [isKiosk, setIsKiosk] = useState(false);

  useEffect(() => {
    setIsKiosk(new URLSearchParams(window.location.search).get('kiosk') === '1');
  }, [pathname]);

  useLayoutEffect(() => {
    if (isLoginPage) {
      setChecking(false);
      return;
    }

    fetch('/api/auth/session')
      .then(res => {
        if (!res.ok) {
          router.replace('/login');
          // keep authed=false, checking=true — show splash until redirect completes
        } else {
          setAuthed(true);
          setChecking(false);
        }
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [isLoginPage, router]);

  // Login page — clean full-screen layout, no sidebar/topbar
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Checking auth — show splash screen, NO sidebar/topbar/content
  if (checking || !authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <Image src="/shbr-logo.png" alt="SHBR Group" width={160} height={62} unoptimized priority />
          <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Authenticated — kiosk mode (no sidebar/topbar, pure full-bleed)
  if (isKiosk) {
    return (
      <div className="flex h-screen overflow-hidden">
        <AuditTracker />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  // Authenticated — render full dashboard shell with sidebar + topbar
  return (
    <div className="flex h-screen overflow-hidden">
      <AuditTracker />
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Top bar */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm flex-shrink-0">
          <TopBar />
        </div>
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          <div className="p-4 sm:p-6 pt-16 lg:pt-4 max-w-[1400px] mx-auto min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
