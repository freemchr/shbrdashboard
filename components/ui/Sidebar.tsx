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
  Cloud,
  Shield,
  BarChart2,
  Sparkles,
  ChevronDown,
  Tv2,
  HardHat,
  Activity,
  ShieldCheck,
  HelpCircle,
  GitCommit,
  Droplets,
  UserCheck,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/command-centre', label: 'Command Centre', icon: Tv2 },
  { href: '/weather', label: 'Weather', icon: Cloud },
  { href: '/whs', label: 'WHS', icon: ShieldCheck },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/bottlenecks', label: 'Bottlenecks', icon: AlertTriangle },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/aging', label: 'Aging', icon: Clock },
  { href: '/financial', label: 'Financial', icon: DollarSign },
  { href: '/search', label: 'Job Search', icon: Search },
  { href: '/map', label: 'Jobs Map', icon: Map },
];

const reportsSubItems = [
  { href: '/reports', label: 'Overview', icon: BarChart2, alert: true },
  { href: '/sla', label: 'SLA Tracker', icon: AlertTriangle, alert: true },
  { href: '/report-assist', label: 'Report Assist', icon: FileEdit, alert: true },
  { href: '/report-assist/polish', label: 'Report Polisher', icon: Sparkles },
  { href: '/eol', label: 'EOL Portfolio', icon: Droplets },
  { href: '/vulnerable', label: 'Vulnerable Customers', icon: UserCheck, alert: true },
];

const estimatorsSubItems = [
  { href: '/estimators', label: 'Workload', icon: HardHat },
  { href: '/timeline', label: 'Timeline Tracking', icon: Activity },
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

const ADMIN_EMAIL = 'chris.freeman@techgurus.com.au';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const isInReports = pathname.startsWith('/reports') || pathname.startsWith('/report-assist') || pathname.startsWith('/sla') || pathname.startsWith('/eol') || pathname.startsWith('/vulnerable');
  const [reportsOpen, setReportsOpen] = useState(isInReports);

  const isInEstimators = pathname.startsWith('/estimators') || pathname.startsWith('/timeline');
  const [estimatorsOpen, setEstimatorsOpen] = useState(isInEstimators);

  // Auto-expand when navigating into a reports or estimators route
  useEffect(() => {
    if (isInReports) setReportsOpen(true);
  }, [isInReports]);

  useEffect(() => {
    if (isInEstimators) setEstimatorsOpen(true);
  }, [isInEstimators]);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {

        if (data?.userEmail) setUserEmail(data.userEmail);
      })
      .catch(() => {});
  }, []);

  const isActive = (href: string) =>
    href === '/report-assist/polish'
      ? pathname === '/report-assist/polish'
      : href === '/report-assist'
      ? pathname === '/report-assist' || (pathname.startsWith('/report-assist/') && pathname !== '/report-assist/polish')
      : href === '/'
      ? pathname === '/'
      : pathname.startsWith(href);

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
          {/* Overview, Weather, Pipeline */}
          {navItems.slice(0, 3).map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActive(item.href)}
            />
          ))}

          {/* Collapsible Reports group */}
          <div>
            <button
              onClick={() => setReportsOpen(o => !o)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isInReports ? 'text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}
            >
              <FileText size={18} className={isInReports ? 'text-red-400' : ''} />
              <span className="flex-1 text-left">Reports</span>
              {isInReports && !reportsOpen && (
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mr-1" />
              )}
              <ChevronDown
                size={15}
                className={`text-gray-500 transition-transform duration-200 ${reportsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <div className={`overflow-hidden transition-all duration-200 ${reportsOpen ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="mt-0.5 space-y-0.5">
                {reportsSubItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 pl-8 pr-4 py-2 rounded-lg text-sm transition-all
                      ${isActive(item.href)
                        ? 'bg-red-600 text-white font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                  >
                    <item.icon size={15} />
                    <span className="flex-1">{item.label}</span>
                    {item.alert && !isActive(item.href) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Collapsible Estimators group */}
          <div>
            <button
              onClick={() => setEstimatorsOpen(o => !o)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isInEstimators ? 'text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}
            >
              <HardHat size={18} className={isInEstimators ? 'text-red-400' : ''} />
              <span className="flex-1 text-left">Estimators</span>
              <ChevronDown
                size={15}
                className={`text-gray-500 transition-transform duration-200 ${estimatorsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <div className={`overflow-hidden transition-all duration-200 ${estimatorsOpen ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="mt-0.5 space-y-0.5">
                {estimatorsSubItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 pl-8 pr-4 py-2 rounded-lg text-sm transition-all
                      ${isActive(item.href)
                        ? 'bg-red-600 text-white font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                  >
                    <item.icon size={15} />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Remaining nav items (Bottlenecks onward) */}
          {navItems.slice(3).map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActive(item.href)}
            />
          ))}

          {userEmail?.toLowerCase() === ADMIN_EMAIL && (
            <>
              <NavItem
                href="/audit"
                label="Audit Log"
                icon={Shield}
                active={isActive('/audit')}
              />
              <NavItem
                href="/changelog"
                label="Changelog"
                icon={GitCommit}
                active={isActive('/changelog')}
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-3">
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
            <Link
              href="/support"
              className={`flex items-center justify-center gap-1.5 text-xs mt-1.5 transition-colors ${
                isActive('/support') ? 'text-red-400' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              <HelpCircle size={11} />
              <span>Support &amp; Help</span>
            </Link>
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
