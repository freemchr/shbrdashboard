/**
 * Local WHS refresh runner — bypasses Vercel 5-min timeout
 * Run: node --env-file=.env.local scripts/whs-refresh.mjs
 */

import { put } from '@vercel/blob';

const PRIME_BASE_URL = process.env.PRIME_BASE_URL;
const PRIME_USERNAME = process.env.PRIME_USERNAME;
const PRIME_PASSWORD = process.env.PRIME_PASSWORD;
const PRIME_CLIENT_ID = process.env.PRIME_CLIENT_ID;
const PRIME_CLIENT_SECRET = process.env.PRIME_CLIENT_SECRET;
const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
const WHS_CACHE_KEY = 'whs-swms-v2';
const BLOB_PREFIX = 'shbr-cache/';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function blobFilename(key) {
  return `${BLOB_PREFIX}${key.replace(/[^a-z0-9-_]/gi, '_')}.json`;
}

let tokenCache = null;

async function getToken() {
  if (tokenCache && Date.now() < tokenCache.expires_at - 30000) return tokenCache.access_token;
  const params = new URLSearchParams({
    grant_type: 'password',
    username: PRIME_USERNAME,
    password: PRIME_PASSWORD,
    client_id: PRIME_CLIENT_ID,
    client_secret: PRIME_CLIENT_SECRET,
    scope: '',
  });
  const res = await fetch(`${PRIME_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/vnd.api.v2+json' },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  tokenCache = { access_token: data.access_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000 };
  return tokenCache.access_token;
}

async function primeGet(path, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const token = await getToken();
    const res = await fetch(`${PRIME_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.api.v2+json' },
    });
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('Retry-After') || '5', 10);
      console.log(`  [429] Rate limited — waiting ${wait}s...`);
      await sleep(wait * 1000);
      continue;
    }
    if (res.status === 401) { tokenCache = null; continue; }
    if (!res.ok) throw new Error(`Prime API ${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error('Max retries exceeded');
}

async function setCached(key, data, ttlMs) {
  const staleMs = Math.floor(ttlMs * 0.8);
  const meta = { expiresAt: Date.now() + ttlMs, staleAt: Date.now() + staleMs, data };
  await put(blobFilename(key), JSON.stringify(meta), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function getCached(key) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const base = (process.env.BLOB_CACHE_BASE_URL || '').replace(/\/$/, '');
  if (!base) return null;
  const url = `${base}/${blobFilename(key)}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) return null;
  const meta = await res.json();
  if (Date.now() > meta.expiresAt) return null;
  return meta.data;
}

async function getOpenStatusIds() {
  const cached = await getCached('open-status-ids');
  if (cached) { console.log('  [cache] open-status-ids hit'); return cached; }
  const data = await primeGet('/statuses?per_page=200');
  const openStatuses = (data.data || [])
    .filter(s => s.attributes?.statusType === 'Open')
    .map(s => ({ id: s.id, name: s.attributes.name }));
  await setCached('open-status-ids', openStatuses, 24 * 60 * 60 * 1000);
  return openStatuses;
}

async function getAllOpenJobs() {
  const cached = await getCached('all-open-jobs-v3');
  if (cached) { console.log(`  [cache] all-open-jobs-v3 hit (${cached.length} jobs)`); return cached; }

  console.log('  Fetching open status IDs...');
  const openStatuses = await getOpenStatusIds();
  console.log(`  Found ${openStatuses.length} open statuses`);

  const batchSize = 15;
  const batches = [];
  for (let i = 0; i < openStatuses.length; i += batchSize) {
    batches.push(openStatuses.slice(i, i + batchSize).map(s => s.id));
  }

  let allJobs = [];
  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const inQuery = batch.map(id => `'${id}'`).join(',');
    let page = 1, totalPages = 1;
    while (page <= totalPages) {
      console.log(`  [jobs] batch ${bi + 1}/${batches.length} page ${page}/${totalPages}...`);
      const data = await primeGet(`/jobs?per_page=250&page=${page}&q='statusId'.in(${inQuery})`);
      allJobs = allJobs.concat(data.data || []);
      totalPages = data.meta?.pagination?.total_pages ?? 1;
      page++;
      if (page <= totalPages) await sleep(700);
    }
  }

  allJobs = allJobs.filter(job => {
    const jobNum = job.attributes?.jobNumber ?? '';
    return !jobNum.toUpperCase().startsWith('ABE');
  });

  console.log(`  Total open jobs: ${allJobs.length}`);
  await setCached('all-open-jobs-v3', allJobs, 12 * 60 * 60 * 1000);
  return allJobs;
}

async function buildWHSData() {
  const sixMonthsAgo = new Date(Date.now() - SIX_MONTHS_MS).toISOString().slice(0, 10);
  const q = encodeURIComponent(`'createdAt'.gte('${sixMonthsAgo}')`);

  const all = [];
  let page = 1, totalPages = 1;

  do {
    if (page > 1) await sleep(700);
    console.log(`  [swms] page ${page}/${totalPages}...`);
    const data = await primeGet(`/site-forms?per_page=100&page=${page}&order=createdAt|DESC&q=${q}`);

    for (const f of data.data || []) {
      if (f.attributes?.template !== 'Safe Work Method Statement / TMP') continue;
      const a = f.attributes;
      all.push({
        id: f.id,
        number: a.number,
        jobId: a.jobId || '',
        status: a.status || 'Unknown',
        assignedContact: a.assignedContact || '',
        assignedUser: a.assignedUser || '',
        approvedBy: a.approvedBy || '',
        approvedAt: (a.approvedAt || '').slice(0, 10),
        createdAt: (a.createdAt || '').slice(0, 10),
      });
    }

    totalPages = data.meta?.pagination?.total_pages || 1;
    page++;
  } while (page <= totalPages);

  console.log(`  Total SWMS forms: ${all.length}`);

  console.log('  Fetching open jobs...');
  const openJobsRaw = await getAllOpenJobs();

  const byStatus = {};
  for (const f of all) {
    if (!byStatus[f.status]) byStatus[f.status] = [];
    byStatus[f.status].push(f);
  }

  const notStarted = byStatus['Not Started']?.length ?? 0;
  const inProgress = byStatus['In Progress']?.length ?? 0;
  const awaitingApproval = byStatus['Awaiting Approval']?.length ?? 0;
  const completed = byStatus['Completed']?.length ?? 0;
  const total = all.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const approvedForms = (byStatus['Completed'] || []).filter(f => f.approvedAt && f.createdAt);
  let avgApprovalDays = 0;
  if (approvedForms.length > 0) {
    const totalDays = approvedForms.reduce((sum, f) => {
      return sum + Math.max(0, (new Date(f.approvedAt).getTime() - new Date(f.createdAt).getTime()) / 86400000);
    }, 0);
    avgApprovalDays = Math.round(totalDays / approvedForms.length);
  }

  const jobsWithSwms = new Set(all.map(f => f.jobId).filter(Boolean));
  const openJobsWithoutSwms = openJobsRaw.filter(j => !jobsWithSwms.has(j.id));
  const coverageRate = openJobsRaw.length > 0
    ? Math.round(((openJobsRaw.length - openJobsWithoutSwms.length) / openJobsRaw.length) * 100)
    : 100;

  const monthlyTrend = {};
  for (const f of all) {
    const month = f.createdAt.slice(0, 7);
    if (!month) continue;
    if (!monthlyTrend[month]) monthlyTrend[month] = { completed: 0, total: 0 };
    monthlyTrend[month].total++;
    if (f.status === 'Completed') monthlyTrend[month].completed++;
  }
  const trend = Object.keys(monthlyTrend).sort().slice(-6).map(m => ({
    month: m,
    completed: monthlyTrend[m].completed,
    total: monthlyTrend[m].total,
    rate: monthlyTrend[m].total > 0 ? Math.round((monthlyTrend[m].completed / monthlyTrend[m].total) * 100) : 0,
  }));

  const awaitingList = (byStatus['Awaiting Approval'] || []).slice(0, 20).map(f => ({
    id: f.id,
    number: f.number,
    jobId: f.jobId,
    assignedContact: f.assignedContact || f.assignedUser,
    createdAt: f.createdAt,
    daysPending: f.createdAt ? Math.floor((Date.now() - new Date(f.createdAt).getTime()) / 86400000) : 0,
  }));

  const noSwmsList = openJobsWithoutSwms
    .sort((a, b) => (a.attributes?.createdAt || '').localeCompare(b.attributes?.createdAt || ''))
    .slice(0, 20)
    .map(j => {
      const addr = j.attributes?.address;
      const location = typeof addr === 'object' && addr ? [addr.suburb, addr.state].filter(Boolean).join(' ') : '';
      return {
        id: j.id,
        jobNumber: j.attributes?.jobNumber,
        location,
        jobType: j.attributes?.jobType,
        region: j.attributes?.region,
        primeUrl: j.attributes?.primeUrl,
        daysSinceCreated: j.attributes?.createdAt
          ? Math.floor((Date.now() - new Date(j.attributes.createdAt).getTime()) / 86400000)
          : 0,
      };
    });

  return {
    asOf: new Date().toISOString(),
    total,
    notStarted,
    inProgress,
    awaitingApproval,
    completed,
    completionRate,
    avgApprovalDays,
    coverageRate,
    openJobsTotal: openJobsRaw.length,
    openJobsWithSwms: openJobsRaw.length - openJobsWithoutSwms.length,
    openJobsNoSwms: openJobsWithoutSwms.length,
    trend,
    awaitingList,
    noSwmsList,
  };
}

console.log('=== WHS Weekly Refresh ===');
console.log('Started:', new Date().toISOString());

const start = Date.now();
buildWHSData()
  .then(async result => {
    console.log('\nBuilt WHS data. Writing to blob cache...');
    await setCached(WHS_CACHE_KEY, result, 26 * 60 * 60 * 1000);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log('\n=== SUCCESS ===');
    console.log(`Total SWMS: ${result.total}`);
    console.log(`Completion rate: ${result.completionRate}%`);
    console.log(`Coverage rate: ${result.coverageRate}%`);
    console.log(`Not started: ${result.notStarted}`);
    console.log(`In progress: ${result.inProgress}`);
    console.log(`Awaiting approval: ${result.awaitingApproval}`);
    console.log(`Completed: ${result.completed}`);
    console.log(`Open jobs total: ${result.openJobsTotal}`);
    console.log(`Open jobs w/SWMS: ${result.openJobsWithSwms}`);
    console.log(`Open jobs w/o SWMS: ${result.openJobsNoSwms}`);
    console.log(`Avg approval days: ${result.avgApprovalDays}`);
    console.log(`AsOf: ${result.asOf}`);
    console.log(`Elapsed: ${elapsed}s`);
    console.log(JSON.stringify({ ok: true, total: result.total, completionRate: result.completionRate, coverageRate: result.coverageRate, asOf: result.asOf }));
  })
  .catch(err => {
    console.error('\n=== FAILED ===');
    console.error(err.message);
    process.exit(1);
  });
