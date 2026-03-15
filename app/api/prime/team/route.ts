/**
 * Team API — fetches active users + their open job workloads.
 * 
 * assignedId on a job = the user responsible for it.
 * We join users → open jobs by user.id === job.assignedId.
 */
import { NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';
import { getAllOpenJobs } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface RawUser {
  id: string;
  attributes: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    status?: string;
    roles?: string[];
  };
}

interface RawJob {
  id: string;
  attributes?: {
    assignedId?: string;
    updatedBy?: string;
    updatedAt?: string;
    createdAt?: string;
    statusId?: string;
    region?: string;
    jobType?: string;
    authorisedTotalIncludingTax?: number;
  };
}

export interface TeamMember {
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

const CACHE_KEY = 'team-data-v1';

export async function GET() {
  try {
    const cached = await getCached<TeamMember[]>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    // Fetch users and open jobs in parallel
    const [usersData, openJobs] = await Promise.all([
      primeGet('/users?per_page=200') as Promise<{ data?: RawUser[] }>,
      getAllOpenJobs() as Promise<RawJob[]>,
    ]);

    const users = usersData.data || [];

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Build per-user stats from open jobs
    const stats: Record<string, {
      openJobs: number;
      totalValue: number;
      updatedThisWeek: number;
      updatedThisMonth: number;
      regions: Set<string>;
    }> = {};

    for (const job of openJobs) {
      const assignedId = job.attributes?.assignedId;
      if (!assignedId) continue;

      if (!stats[assignedId]) {
        stats[assignedId] = { openJobs: 0, totalValue: 0, updatedThisWeek: 0, updatedThisMonth: 0, regions: new Set() };
      }

      stats[assignedId].openJobs++;
      stats[assignedId].totalValue += Number(job.attributes?.authorisedTotalIncludingTax || 0);

      if (job.attributes?.region) {
        stats[assignedId].regions.add(job.attributes.region);
      }

      if (job.attributes?.updatedAt) {
        const updatedAt = new Date(job.attributes.updatedAt);
        if (updatedAt >= weekStart) stats[assignedId].updatedThisWeek++;
        if (updatedAt >= monthStart) stats[assignedId].updatedThisMonth++;
      }
    }

    // Merge users with stats — only show active users OR users with open jobs
    const team: TeamMember[] = users
      .filter(u => u.attributes.status === 'active' || stats[u.id])
      .map(u => {
        const s = stats[u.id];
        return {
          id: u.id,
          name: u.attributes.fullName || `${u.attributes.firstName || ''} ${u.attributes.lastName || ''}`.trim(),
          email: u.attributes.email || '',
          status: u.attributes.status || 'unknown',
          roles: u.attributes.roles || [],
          openJobs: s?.openJobs || 0,
          totalAuthorisedValue: s?.totalValue || 0,
          updatedThisWeek: s?.updatedThisWeek || 0,
          updatedThisMonth: s?.updatedThisMonth || 0,
          regions: s ? Array.from(s.regions).sort() : [],
        };
      })
      .sort((a, b) => b.openJobs - a.openJobs);

    await setCached(CACHE_KEY, team, 30 * 60 * 1000);
    return NextResponse.json(team);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
