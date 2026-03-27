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
  ClipboardList,
  Flag,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/command-centre', label: 'Command Centre', icon: Tv2 },
  { href: '/whs', label: 'WHS', icon: ShieldCheck },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/stalled', label: 'Stalled Jobs', icon: Clock },
  { href: '/financial', label: 'Financial', icon: DollarSign },
  { href: '/search', label: 'Job Search', icon: Search },
  { href: '/map', label: 'Jobs Map', icon: Map },
];

const weatherSubItems = [
  { href: '/weather', label: 'Forecast', icon: Cloud },
  { href: '/cat-forecast', label: 'CAT Demand', icon: Zap },
];

const opsSubItems = [
  { href: '/ops', label: 'Job Board', icon: ClipboardList },
  { href: '/team', label: 'Team Performance', icon: Users },
  { href: '/sla', label: 'SLA Tracker', icon: AlertTriangle, alert: true },
  { href: '/sla-predict', label: 'SLA Predictor', icon: TrendingUp, alert: true },
];

const reportsSubItems = [
  { href: '/reports', label: 'Report Status', icon: BarChart2, alert: true },
  { href: '/report-assist/polish', label: 'AI Polisher', icon: Sparkles },
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

  const isInWeather = pathname.startsWith('/weather') || pathname.startsWith('/cat-forecast');
  const [weatherOpen, setWeatherOpen] = useState(isInWeather);

  const isInOps = pathname.startsWith('/ops') || pathname.startsWith('/team') || pathname.startsWith('/sla');
  const [opsOpen, setOpsOpen] = useState(isInOps);

  const isInReports = pathname.startsWith('/reports') || pathname.startsWith('/report-assist');
  const [reportsOpen, setReportsOpen] = useState(isInReports);

  const isInEstimators = pathname.startsWith('/estimators') || pathname.startsWith('/timeline');
  const [estimatorsOpen, setEstimatorsOpen] = useState(isInEstimators);

  useEffect(() => { if (isInWeather) setWeatherOpen(true); }, [isInWeather]);
  useEffect(() => { if (isInOps) setOpsOpen(true); }, [isInOps]);
  useEffect(() => { if (isInReports) setReportsOpen(true); }, [isInReports]);
  useEffect(() => { if (isInEstimators) setEstimatorsOpen(true); }, [isInEstimators]);

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
      : href === '/'
      ? pathname === '/'
      : href === '/sla'
      ? pathname === '/sla'
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

  // Overview + Command Centre sit above all groups; everything else below
  const navItemsTop    = navItems.slice(0, 2);  // Overview, Command Centre
  const navItemsBottom = navItems.slice(2);     // WHS, Pipeline, Stalled, Financial, Search, Map

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
          {/* Top nav items: Overview, Command Centre, Ops */}
          {navItemsTop.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActive(item.href)}
            />
          ))}

          {/* Collapsible Weather & CAT group */}
          <div>
            <button
              onClick={() => setWeatherOpen(o => !o)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isInWeather ? 'text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}
            >
              <Cloud size={18} className={isInWeather ? 'text-red-400' : ''} />
              <span className="flex-1 text-left">Weather & CAT</span>
              <ChevronDown
                size={15}
                className={`text-gray-500 transition-transform duration-200 ${weatherOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${weatherOpen ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="mt-0.5 space-y-0.5">
                {weatherSubItems.map((item) => (
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

          {/* Collapsible Operations group — Job Board + Team Performance */}
          <div>
            <button
              onClick={() => setOpsOpen(o => !o)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isInOps ? 'text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}
            >
              <ClipboardList size={18} className={isInOps ? 'text-red-400' : ''} />
              <span className="flex-1 text-left">Operations</span>
              <ChevronDown
                size={15}
                className={`text-gray-500 transition-transform duration-200 ${opsOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${opsOpen ? 'max-h-56 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="mt-0.5 space-y-0.5">
                {opsSubItems.map((item) => (
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

            <div className={`overflow-hidden transition-all duration-200 ${reportsOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
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

          {/* Flagged Jobs — direct nav item after Reports, before Estimators */}
          <NavItem
            href="/flagged"
            label="Flagged Jobs"
            icon={Flag}
            active={isActive('/flagged')}
          />

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

          {/* Remaining nav items (Weather, WHS, Pipeline, Stalled, Financial, Search, Map) */}
          {navItemsBottom.map((item) => (
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

        <div className="px-3 py-2 border-t border-gray-800">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-white hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut size={13} />
              <span>{loggingOut ? 'Signing out…' : 'Sign Out'}</span>
            </button>
            <Link
              href="/support"
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                isActive('/support') ? 'text-red-400' : 'text-gray-600 hover:text-gray-400 hover:bg-gray-800'
              }`}
            >
              <HelpCircle size={11} />
              <span>Help</span>
            </Link>
          </div>
          <p className="text-[10px] text-gray-700 text-center mt-1 leading-tight">SHBR Insights · Internal Use Only</p>
        </div>
      </aside>
    </>
  );
}
