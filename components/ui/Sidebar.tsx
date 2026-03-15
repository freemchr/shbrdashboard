'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from './Logo';
import {
  LayoutDashboard,
  GitBranch,
  AlertTriangle,
  Users,
  Clock,
  DollarSign,
  Search,
  Map,
  FileText,
  FileEdit,
  Menu,
  X,
  LogOut,
  User,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/reports', label: 'Reports', icon: FileText, alert: true },
  { href: '/report-assist', label: 'Report Assist', icon: FileEdit, alert: true },
  { href: '/bottlenecks', label: 'Bottlenecks', icon: AlertTriangle },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/aging', label: 'Aging', icon: Clock },
  { href: '/financial', label: 'Financial', icon: DollarSign },
  { href: '/search', label: 'Job Search', icon: Search },
  { href: '/map', label: 'Jobs Map', icon: Map },
];

function NavItem({ href, label, icon: Icon, active, alert }: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
        ${active
          ? 'bg-red-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
    >
      <Icon size={18} />
      <span className="flex-1">{label}</span>
      {alert && !active && (
        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.userName) setUserName(data.userName);
      })
      .catch(() => {});
  }, []);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-gray-900 text-white"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 w-64 flex flex-col
          bg-[#111111] border-r border-gray-800
          transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:flex
        `}
      >
        <div className="p-5 border-b border-gray-800">
          <Logo />
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActive(item.href)}
              alert={item.alert}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-3">
          {/* User info */}
          {userName && (
            <div className="flex items-center gap-2 px-2 py-1">
              <User size={14} className="text-gray-500 flex-shrink-0" />
              <span className="text-xs text-gray-400 truncate">{userName}</span>
            </div>
          )}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut size={16} />
            <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>

          <div className="pt-1">
            <p className="text-xs text-gray-600 text-center">SHBR Insights</p>
            <p className="text-xs text-gray-700 text-center">Internal Use Only</p>
            <p className="text-xs text-gray-700 text-center mt-1">
              Created by{' '}
              <a href="https://www.techgurus.com.au" target="_blank" rel="noopener noreferrer"
                className="text-gray-600 hover:text-red-400 transition-colors underline underline-offset-2">
                TechGurus
              </a>
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
