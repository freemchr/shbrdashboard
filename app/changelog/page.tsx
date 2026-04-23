'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirects to the unified admin panel
export default function ChangelogRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin?tab=changelog'); }, [router]);
  return null;
}
