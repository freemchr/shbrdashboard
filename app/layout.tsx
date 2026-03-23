import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { ThemeProvider } from '@/components/ui/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SHBR Insights',
  description: 'SHBR Group - Insurance Builders & Repairs Operations Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 dark:bg-gray-950 text-white dark:text-white min-h-screen transition-colors duration-200`}>
        <ThemeProvider>
          <AuthGuard>
            {children}
          </AuthGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}
