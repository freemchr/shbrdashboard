'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { KpiCard } from '@/components/ui/KpiCard';
import { Users, Briefcase, DollarSign, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { formatCurrency } from '@/lib/prime-helpers';
import { downloadCSV } from '@/lib/export-csv';
import { Download } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  status: string;
  roles: string[];
  openJobs: number;
  totalAuthorisedValue: number;
  updatedThisWeek: number;
  updatedThisMonth: number;
  regions: string[];
}

type SortKey = 'name' | 'roles' | 'openJobs' | 'totalAuthorisedValue' | 'updatedThisWeek' | 'updatedThisMonth' | 'status';

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('openJobs');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/prime/team')
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error || 'Failed to load')))
      .then(d => setTeam(Array.isArray(d) ? d : []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading team data…" />;
  if (error) return <ErrorMessage message={error} />;

  const displayed = (showInactive ? team : team.filter(m => m.status === 'active' || m.openJobs > 0))
    .sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === 'roles') { av = a.roles.join(', '); bv = b.roles.join(', '); }
      else if (sortKey === 'status') { av = a.status; bv = b.status; }
      else { av = a[sortKey] ?? 0; bv = b[sortKey] ?? 0; }
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const activeWithJobs = team.filter(m => m.openJobs > 0);
  const totalOpen = team.reduce((s, m) => s + m.openJobs, 0);
  const totalValue = team.reduce((s, m) => s + m.totalAuthorisedValue, 0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortTh = ({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-4 py-2.5 text-left text-xs text-gray-500 font-medium cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === col
          ? sortDir === 'asc' ? <ChevronUp size={11} className="text-red-400" /> : <ChevronDown size={11} className="text-red-400" />
          : <ChevronsUpDown size={11} className="text-gray-700" />}
      </span>
    </th>
  );

  const handleExport = () => {
    downloadCSV(
      `team-workload-${new Date().toISOString().split('T')[0]}.csv`,
      ['Name', 'Email', 'Role', 'Status', 'Open Jobs', 'Auth. Value', 'This Week', 'This Month', 'Regions'],
      displayed.map(m => [m.name, m.email, m.roles.join(', '), m.status, m.openJobs, m.totalAuthorisedValue, m.updatedThisWeek, m.updatedThisMonth, m.regions.join(', ')])
    );
  };

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Active users and their current open job workload"
        actions={
          <button onClick={handleExport}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors">
            <Download size={14} /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard title="Staff with Open Jobs" value={activeWithJobs.length} icon={<Users size={18} />} />
        <KpiCard title="Total Open Jobs" value={totalOpen} icon={<Briefcase size={18} />} />
        <KpiCard title="Total Auth. Value" value={formatCurrency(totalValue)} icon={<DollarSign size={18} />} />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-white">
            Team Workload <span className="text-gray-500 font-normal">({displayed.length} members)</span>
          </h2>
          <button
            onClick={() => setShowInactive(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
              showInactive ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {showInactive ? 'Hide inactive' : 'Show inactive'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <SortTh col="name" label="Name" className="pl-5" />
                <SortTh col="roles" label="Role" />
                <SortTh col="openJobs" label="Open Jobs" />
                <SortTh col="totalAuthorisedValue" label="Auth. Value" />
                <SortTh col="updatedThisWeek" label="This Week" />
                <SortTh col="updatedThisMonth" label="This Month" />
                <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium whitespace-nowrap">Regions</th>
                <SortTh col="status" label="Status" />
              </tr>
            </thead>
            <tbody>
              {displayed.map(m => (
                <tr key={m.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-2.5 pl-5 whitespace-nowrap">
                    <div className="font-medium text-white text-sm">{m.name}</div>
                    {m.email && <div className="text-xs text-gray-500 mt-0.5">{m.email}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[140px]">
                    {m.roles.length === 0 ? '—' : (
                      <span title={m.roles.join(', ')} className="cursor-default">
                        {m.roles[0]}
                        {m.roles.length > 1 && (
                          <span className="ml-1 text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full text-[10px]" title={m.roles.join(', ')}>
                            +{m.roles.length - 1}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`font-bold font-mono text-sm ${
                      m.openJobs > 30 ? 'text-red-400' :
                      m.openJobs > 15 ? 'text-yellow-400' :
                      m.openJobs > 0  ? 'text-green-400' : 'text-gray-600'
                    }`}>
                      {m.openJobs > 0 ? m.openJobs : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-300 font-mono whitespace-nowrap">
                    {m.totalAuthorisedValue > 0 ? formatCurrency(m.totalAuthorisedValue) : '—'}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`font-mono text-xs ${m.updatedThisWeek > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                      {m.updatedThisWeek > 0 ? m.updatedThisWeek : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="font-mono text-xs text-gray-400">
                      {m.updatedThisMonth > 0 ? m.updatedThisMonth : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="text-xs text-gray-500">
                      {m.regions.length > 0 ? `${m.regions.length} region${m.regions.length !== 1 ? 's' : ''}` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      m.status === 'active' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500 text-sm">No team members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
