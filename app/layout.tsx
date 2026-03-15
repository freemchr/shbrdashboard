import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/ui/Sidebar';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { TopBar } from '@/components/ui/TopBar';

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
            <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
              {/* Top bar */}
              <div className="flex items-center justify-end px-6 py-3 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm flex-shrink-0">
                <TopBar />
              </div>
              <main className="flex-1 overflow-y-auto">
                <div className="p-6 pt-4 max-w-[1400px] mx-auto">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </AuthGuard>
      </body>
    </html>
  );
}
