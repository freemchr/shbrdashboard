'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorMessage, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DataTable, Column } from '@/components/ui/DataTable';
import type { PrimeJob } from '@/lib/prime-helpers';

interface TeamMember {
  id: string;
  name: string;
  updatedThisWeek: number;
  updatedThisMonth: number;
  openJobsCount: number;
}

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/prime/jobs?per_page=200');
        if (!res.ok) throw new Error('Failed to load jobs');
        const data = await res.json();
        const jobs: PrimeJob[] = data.data || [];

        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Focus on updatedBy (string name) for activity
        const memberMap: Record<string, TeamMember> = {};

        // Only jobs updated in last 30 days
        const recentJobs = jobs.filter((j) => {
          const updatedAt = j.attributes?.updatedAt;
          return updatedAt && new Date(updatedAt) >= thirtyDaysAgo;
        });

        for (const job of recentJobs) {
          const name = job.attributes?.updatedBy || 'Unknown';
          if (!memberMap[name]) {
            memberMap[name] = {
              id: name,
              name,
              updatedThisWeek: 0,
              updatedThisMonth: 0,
              openJobsCount: 0,
            };
          }

          const updatedAt = new Date(job.attributes?.updatedAt || 0);
          if (updatedAt >= weekStart) memberMap[name].updatedThisWeek++;
          if (updatedAt >= monthStart) memberMap[name].updatedThisMonth++;
        }

        // Count open jobs per updatedBy
        const openJobs = jobs.filter((j) => {
          const st = (j.attributes?.statusType || '').toLowerCase();
          return st === 'open' || st === 'active';
        });

        for (const job of openJobs) {
          const name = job.attributes?.updatedBy || 'Unknown';
          if (memberMap[name]) {
            memberMap[name].openJobsCount++;
          }
        }

        const sorted = Object.values(memberMap).sort(
          (a, b) => b.updatedThisMonth - a.updatedThisMonth
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
    { key: 'name', label: 'Team Member', sortable: true },
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
    {
      key: 'openJobsCount',
      label: 'Open Jobs',
      sortable: true,
      render: (m) => (
        <span className={`font-mono ${m.openJobsCount > 10 ? 'text-yellow-400' : 'text-gray-300'}`}>
          {m.openJobsCount}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Activity by team member (last 30 days)"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <p className="text-gray-400 text-sm">Active Members</p>
          <p className="text-3xl font-bold text-white mt-1">{team.length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <p className="text-gray-400 text-sm">Total Updates This Week</p>
          <p className="text-3xl font-bold text-white mt-1">
            {team.reduce((sum, m) => sum + m.updatedThisWeek, 0)}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <p className="text-gray-400 text-sm">Total Updates This Month</p>
          <p className="text-3xl font-bold text-white mt-1">
            {team.reduce((sum, m) => sum + m.updatedThisMonth, 0)}
          </p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-base font-semibold text-white mb-4">Team Activity</h2>
        <DataTable
          columns={columns}
          data={team}
          keyFn={(item) => item.id}
          pageSize={50}
          emptyMessage="No team activity found for the last 30 days."
        />
      </div>
    </div>
  );
}
