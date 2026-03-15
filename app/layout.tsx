import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthGuard } from '@/components/ui/AuthGuard';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SHBR Prime Dashboard',
  description: 'SHBR Group - Insurance Builders & Repairs Operations Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}
