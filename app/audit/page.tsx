'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirects to the unified admin panel
export default function AuditRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin?tab=audit'); }, [router]);
  return null;
}
