'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const SECRET = 'shbr2026';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === '/login') {
      setChecked(true);
      return;
    }
    const auth = localStorage.getItem('shbr_auth');
    if (auth !== SECRET) {
      window.location.href = '/login';
    } else {
      setChecked(true);
    }
  }, [pathname]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
