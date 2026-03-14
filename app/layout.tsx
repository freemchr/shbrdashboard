import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/ui/Sidebar';
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
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto lg:ml-0">
              <div className="p-6 pt-14 lg:pt-6 max-w-[1400px] mx-auto">
                {children}
              </div>
            </main>
          </div>
        </AuthGuard>
      </body>
    </html>
  );
}
