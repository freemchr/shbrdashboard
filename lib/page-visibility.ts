/**
 * Page Visibility — admin-controlled page access by group.
 *
 * Config is stored in Vercel Blob so changes take effect without a redeploy.
 * Falls back to a wide-open default (all pages visible to everyone) if no config exists.
 *
 * Groups are defined here — each group has a list of member emails.
 * Pages are identified by their Next.js pathname (e.g. '/financial', '/reports').
 * A page with no restrictions is visible to everyone.
 * A page with restrictions is only visible to members of the listed groups + admins.
 */

import { put } from '@vercel/blob';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VisibilityGroup {
  id: string;         // e.g. 'assessors'
  label: string;      // e.g. 'Assessors'
  members: string[];  // lowercase emails
}

export interface PageRestriction {
  path: string;           // e.g. '/financial'
  label: string;          // human-readable name, e.g. 'Financial'
  hiddenFrom: string[];   // group ids that cannot see this page
}

export interface VisibilityConfig {
  groups: VisibilityGroup[];
  pages: PageRestriction[];
  updatedAt?: string;
  updatedBy?: string;
}

// ── All known pages (update this list when adding new pages) ──────────────────

export const ALL_PAGES: { path: string; label: string; group?: string }[] = [
  { path: '/',                    label: 'Overview' },
  { path: '/command-centre',      label: 'Command Centre' },
  { path: '/pipeline',            label: 'Pipeline' },
  { path: '/stalled',             label: 'Stalled Jobs' },
  { path: '/financial',           label: 'Financial' },
  { path: '/search',              label: 'Job Search' },
  { path: '/map',                 label: 'Jobs Map' },
  { path: '/socials',             label: 'Socials' },
  { path: '/whs',                 label: 'WHS' },
  { path: '/weather',             label: 'Weather Forecast',  group: 'Weather & CAT' },
  { path: '/cat-forecast',        label: 'CAT Demand',        group: 'Weather & CAT' },
  { path: '/clients',             label: 'Client Analytics',  group: 'Insights' },
  { path: '/locations',           label: 'Jobs by Location',  group: 'Insights' },
  { path: '/ops',                 label: 'Job Board',         group: 'Operations' },
  { path: '/team',                label: 'Team Performance',  group: 'Operations' },
  { path: '/sla',                 label: 'SLA Tracker',       group: 'Operations' },
  { path: '/sla-predict',         label: 'SLA Predictor',     group: 'Operations' },
  { path: '/reports',             label: 'Report Status',     group: 'Reports' },
  { path: '/report-assist/polish', label: 'AI Polisher',      group: 'Reports' },
  { path: '/flagged',             label: 'Flagged Jobs' },
  { path: '/estimators',          label: 'Estimator Workload', group: 'Estimators' },
  { path: '/timeline',            label: 'Timeline Tracking',  group: 'Estimators' },
  { path: '/flexi-calc',          label: 'Flexi ROI Calc',     group: 'APP' },
  { path: '/aging',               label: 'Aging Report' },
  { path: '/bottlenecks',         label: 'Bottlenecks' },
  { path: '/vulnerable',          label: 'Vulnerable Customers' },
  { path: '/eol',                 label: 'EOL Tracker' },
];

// ── Default config (everything open) ─────────────────────────────────────────

export const DEFAULT_CONFIG: VisibilityConfig = {
  groups: [],
  pages: [],
};

// ── Blob storage ──────────────────────────────────────────────────────────────

const BLOB_KEY = 'shbr-admin/page-visibility.json';

function getBlobBase(): string {
  return (process.env.BLOB_CACHE_BASE_URL || '').replace(/\/$/, '');
}

// In-memory cache for the visibility config (reset on cold starts)
let memConfig: VisibilityConfig | null = null;
let memConfigAt = 0;
const MEM_TTL = 60 * 1000; // 1 minute — keeps it snappy but not stale forever

export async function getVisibilityConfig(): Promise<VisibilityConfig> {
  // 1. In-memory hit
  if (memConfig && Date.now() - memConfigAt < MEM_TTL) {
    return memConfig;
  }

  // 2. Blob fetch
  try {
    const base = getBlobBase();
    if (!base) return DEFAULT_CONFIG;

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const res = await fetch(`${base}/${BLOB_KEY}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return DEFAULT_CONFIG;

    const config: VisibilityConfig = await res.json();
    memConfig = config;
    memConfigAt = Date.now();
    return config;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveVisibilityConfig(
  config: VisibilityConfig
): Promise<void> {
  memConfig = config;
  memConfigAt = Date.now();

  await put(BLOB_KEY, JSON.stringify(config, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// ── Access check ──────────────────────────────────────────────────────────────

/**
 * Returns true if the given email can see the given page path.
 * Admins always see everything.
 */
export function canSeePage(
  path: string,
  email: string,
  config: VisibilityConfig,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;

  const normalised = email.toLowerCase().trim();

  const restriction = config.pages.find((p) => {
    // exact match or prefix match for nested routes
    return path === p.path || path.startsWith(p.path + '/');
  });

  if (!restriction || restriction.hiddenFrom.length === 0) return true;

  // Check if user is in any of the restricted groups
  for (const groupId of restriction.hiddenFrom) {
    const group = config.groups.find((g) => g.id === groupId);
    if (group && group.members.includes(normalised)) {
      return false; // user is in a group that's blocked from this page
    }
  }

  return true;
}

/**
 * Returns the set of page paths the user cannot see.
 */
export function getHiddenPaths(
  email: string,
  config: VisibilityConfig,
  isAdmin: boolean
): Set<string> {
  const hidden = new Set<string>();
  if (isAdmin) return hidden;

  for (const page of config.pages) {
    if (!canSeePage(page.path, email, config, false)) {
      hidden.add(page.path);
    }
  }

  return hidden;
}
