/**
 * Efficiently fetch only OPEN jobs from Prime API.
 * - Fetches open status IDs once (cached)
 * - Queries jobs filtered to those status IDs only
 * - Only 217 open jobs vs 9,400 total — much faster!
 */

import { primeGet } from './prime-auth';
import { getCached, setCached } from './blob-cache';

interface StatusData {
  data: { id: string; attributes: { name: string; statusType: string } }[];
}

// Get open status IDs (cached 24h)
export async function getOpenStatusIds(): Promise<{ id: string; name: string }[]> {
  const cacheKey = 'open-status-ids';
  const cached = await getCached<{ id: string; name: string }[]>(cacheKey);
  if (cached) return cached;

  const data = await primeGet('/statuses?per_page=200') as StatusData;
  const openStatuses = (data.data || [])
    .filter(s => s.attributes?.statusType === 'Open')
    .map(s => ({ id: s.id, name: s.attributes.name }));

  await setCached(cacheKey, openStatuses, 24 * 60 * 60 * 1000);
  return openStatuses;
}

// Fetch all open jobs efficiently using status ID batches
export async function getAllOpenJobs(): Promise<unknown[]> {
  const cacheKey = 'all-open-jobs-v2';
  const cached = await getCached<unknown[]>(cacheKey);
  if (cached) return cached;

  const openStatuses = await getOpenStatusIds();
  if (!openStatuses.length) return [];

  // Batch status IDs into groups of 15 for the in() query
  const batchSize = 15;
  const batches: string[][] = [];
  for (let i = 0; i < openStatuses.length; i += batchSize) {
    batches.push(openStatuses.slice(i, i + batchSize).map(s => s.id));
  }

  let allJobs: unknown[] = [];

  for (const batch of batches) {
    const inQuery = batch.map(id => `'${id}'`).join(',');
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const data = await primeGet(
        `/jobs?per_page=100&page=${page}&q='statusId'.in(${inQuery})`
      ) as { data?: unknown[]; meta?: { pagination?: { total_pages?: number; total?: number } } };

      const items = data.data || [];
      allJobs = allJobs.concat(items);
      totalPages = data.meta?.pagination?.total_pages ?? 1;
      page++;
    }
  }

  await setCached(cacheKey, allJobs, 30 * 60 * 1000); // 30 min
  return allJobs;
}

// Get open status name map (id -> name)
export async function getStatusNameMap(): Promise<Record<string, string>> {
  const statuses = await getOpenStatusIds();
  return Object.fromEntries(statuses.map(s => [s.id, s.name]));
}
