'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  // Login page never needs auth check
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (isLoginPage) {
      setChecked(true);
      return;
    }

    // Verify session server-side — if not valid, redirect to login
    fetch('/api/auth/session')
      .then(res => {
        if (!res.ok) {
          router.replace('/login');
        } else {
          setChecked(true);
        }
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [isLoginPage, router]);

  // Show nothing until auth is confirmed — prevents any flash of content
  if (!isLoginPage && !checked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Image src="/shbr-logo.png" alt="SHBR Group" width={160} height={62} unoptimized priority />
          <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mt-2" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
