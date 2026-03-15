'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { KpiCard } from '@/components/ui/KpiCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Users, Briefcase, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/prime-helpers';

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

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetch('/api/prime/team')
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error || 'Failed to load')))
      .then(d => setTeam(Array.isArray(d) ? d : []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading team data…" />;
  if (error) return <ErrorMessage message={error} />;

  const displayed = showInactive ? team : team.filter(m => m.status === 'active' || m.openJobs > 0);
  const activeWithJobs = team.filter(m => m.openJobs > 0);
  const totalOpen = team.reduce((s, m) => s + m.openJobs, 0);
  const totalValue = team.reduce((s, m) => s + m.totalAuthorisedValue, 0);

  const columns: Column<TeamMember>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (m) => (
        <span className="font-medium text-white text-xs whitespace-nowrap">{m.name}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (m) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">{m.email || '—'}</span>
      ),
    },
    {
      key: 'roles',
      label: 'Role',
      render: (m) => (
        <span className="text-xs text-gray-400 whitespace-nowrap">{m.roles.join(', ') || '—'}</span>
      ),
    },
    {
      key: 'openJobs',
      label: 'Open Jobs',
      sortable: true,
      render: (m) => (
        <span className={`font-bold font-mono text-sm ${
          m.openJobs > 20 ? 'text-red-400' : m.openJobs > 10 ? 'text-yellow-400' : m.openJobs > 0 ? 'text-green-400' : 'text-gray-600'
        }`}>
          {m.openJobs || '—'}
        </span>
      ),
    },
    {
      key: 'totalAuthorisedValue',
      label: 'Auth. Value',
      sortable: true,
      render: (m) => (
        <span className="text-xs text-gray-300 font-mono whitespace-nowrap">
          {m.totalAuthorisedValue > 0 ? formatCurrency(m.totalAuthorisedValue) : '—'}
        </span>
      ),
    },
    {
      key: 'updatedThisWeek',
      label: 'This Week',
      sortable: true,
      render: (m) => (
        <span className={`font-mono text-xs ${m.updatedThisWeek > 0 ? 'text-green-400' : 'text-gray-600'}`}>
          {m.updatedThisWeek || '—'}
        </span>
      ),
    },
    {
      key: 'updatedThisMonth',
      label: 'This Month',
      sortable: true,
      render: (m) => (
        <span className="font-mono text-xs text-gray-400">{m.updatedThisMonth || '—'}</span>
      ),
    },
    {
      key: 'regions',
      label: 'Regions',
      render: (m) => (
        <span className="text-xs text-gray-500">{m.regions.join(', ') || '—'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (m) => (
        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
          m.status === 'active' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'
        }`}>
          {m.status}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Active users and their current open job workload"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard
          title="Staff with Open Jobs"
          value={activeWithJobs.length}
          icon={<Users size={18} />}
        />
        <KpiCard
          title="Total Open Jobs Assigned"
          value={totalOpen}
          icon={<Briefcase size={18} />}
        />
        <KpiCard
          title="Total Auth. Value"
          value={formatCurrency(totalValue)}
          icon={<DollarSign size={18} />}
        />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-base font-semibold text-white">
            Team Workload ({displayed.length} members)
          </h2>
          <button
            onClick={() => setShowInactive(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
              showInactive
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {showInactive ? 'Hiding inactive' : 'Show inactive'}
          </button>
        </div>

        {team.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">No team data found.</p>
        ) : (
          <DataTable
            columns={columns}
            data={displayed}
            keyFn={(m) => m.id}
            pageSize={50}
            emptyMessage="No team members found."
          />
        )}
      </div>
    </div>
  );
}
