'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Users } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';

interface FlatOpenJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  jobType: string;
  region: string;
  primeUrl: string;
  authorisedTotal: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  createdBy: string;
}

interface TeamMember {
  name: string;
  openJobsCount: number;
  updatedThisWeek: number;
  updatedThisMonth: number;
}

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Use the open-jobs endpoint — has all 217 open jobs with updatedBy populated
        const res = await fetch('/api/prime/jobs/open');
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const jobs: FlatOpenJob[] = Array.isArray(json) ? json : [];

        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const memberMap: Record<string, TeamMember> = {};

        for (const job of jobs) {
          const name = job.updatedBy || 'Unknown';
          if (!memberMap[name]) {
            memberMap[name] = { name, openJobsCount: 0, updatedThisWeek: 0, updatedThisMonth: 0 };
          }

          // Every job in this list is open — count it
          memberMap[name].openJobsCount++;

          // Activity from updatedAt
          if (job.updatedAt) {
            const updatedAt = new Date(job.updatedAt);
            if (updatedAt >= weekStart) memberMap[name].updatedThisWeek++;
            if (updatedAt >= monthStart) memberMap[name].updatedThisMonth++;
          }
        }

        const sorted = Object.values(memberMap).sort(
          (a, b) => b.openJobsCount - a.openJobsCount
        );

        setTeam(sorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading team data..." />;
  if (error) return <ErrorMessage message={error} />;

  const columns: Column<TeamMember>[] = [
    {
      key: 'name',
      label: 'Team Member',
      sortable: true,
      render: (m) => <span className="font-medium text-white">{m.name}</span>,
    },
    {
      key: 'openJobsCount',
      label: 'Open Jobs',
      sortable: true,
      render: (m) => (
        <span className={`font-mono font-bold ${m.openJobsCount > 20 ? 'text-yellow-400' : 'text-gray-300'}`}>
          {m.openJobsCount}
        </span>
      ),
    },
    {
      key: 'updatedThisWeek',
      label: 'Updated This Week',
      sortable: true,
      render: (m) => (
        <span className={`font-mono ${m.updatedThisWeek > 0 ? 'text-green-400' : 'text-gray-600'}`}>
          {m.updatedThisWeek}
        </span>
      ),
    },
    {
      key: 'updatedThisMonth',
      label: 'Updated This Month',
      sortable: true,
      render: (m) => (
        <span className="font-mono text-gray-300">{m.updatedThisMonth}</span>
      ),
    },
  ];

  const totalUpdatedThisWeek = team.reduce((s, m) => s + m.updatedThisWeek, 0);
  const totalUpdatedThisMonth = team.reduce((s, m) => s + m.updatedThisMonth, 0);

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Open job ownership & activity from last update (across all open jobs)"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard
          title="Active Members"
          value={team.length}
          icon={<Users size={18} />}
        />
        <KpiCard
          title="Jobs Updated This Week"
          value={totalUpdatedThisWeek}
          icon={<Users size={18} />}
        />
        <KpiCard
          title="Jobs Updated This Month"
          value={totalUpdatedThisMonth}
          icon={<Users size={18} />}
        />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-base font-semibold text-white mb-4">
          Team Activity (Open Jobs)
        </h2>
        <DataTable
          columns={columns}
          data={team}
          keyFn={(item) => item.name}
          pageSize={50}
          emptyMessage="No team activity found in open jobs."
        />
      </div>
    </div>
  );
}
