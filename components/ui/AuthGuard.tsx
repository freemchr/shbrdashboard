'use client';

import { useLayoutEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Start as false — content is hidden until auth confirmed
  const [authed, setAuthed] = useState(false);

  const isLoginPage = pathname === '/login';

  useLayoutEffect(() => {
    if (isLoginPage) {
      setAuthed(true);
      return;
    }

    fetch('/api/auth/session')
      .then(res => {
        if (!res.ok) {
          router.replace('/login');
          // keep authed=false so nothing shows
        } else {
          setAuthed(true);
        }
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  // Not yet confirmed — show SHBR splash, hide all page content via CSS
  // Using visibility:hidden (not display:none) so layout doesn't shift on reveal
  return (
    <>
      {/* Fullscreen overlay blocks ALL content until auth confirmed */}
      {!authed && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#030712' }}
          className="flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-5">
            <Image src="/shbr-logo.png" alt="SHBR Group" width={160} height={62} unoptimized priority />
            <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}
      {/* Children always in DOM (for hydration) but hidden behind overlay */}
      <div style={{ visibility: authed ? 'visible' : 'hidden' }}>
        {children}
      </div>
    </>
  );
}
