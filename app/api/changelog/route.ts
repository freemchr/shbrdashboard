/**
 * Fetches the commit history from GitHub and returns it as structured changelog entries.
 * Admin-only. Filters out noise (chore commits, raw infra fixes) and groups by date.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_EMAIL = 'chris.freeman@techgurus.com.au';
const GITHUB_REPO = 'freemchr/shbrdashboard';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // optional — increases rate limit

export interface ChangelogEntry {
  sha: string;
  date: string;       // YYYY-MM-DD
  type: 'feat' | 'fix' | 'security' | 'improvement' | 'other';
  title: string;      // cleaned, human-readable
  raw: string;        // original commit message
}

export interface ChangelogDay {
  date: string;
  label: string;      // e.g. "Tuesday 18 March 2026"
  entries: ChangelogEntry[];
}

// Map conventional commit prefixes to types
function classifyType(msg: string): ChangelogEntry['type'] {
  const lower = msg.toLowerCase();
  if (lower.startsWith('feat:') || lower.startsWith('feat(')) return 'feat';
  if (lower.startsWith('fix:')  || lower.startsWith('fix('))  return 'fix';
  if (lower.includes('security') || lower.includes('auth') && lower.startsWith('fix')) return 'security';
  return 'other';
}

// Convert raw commit message to friendly human-readable title
function humanise(msg: string): string {
  // Strip conventional commit prefix
  let clean = msg
    .replace(/^(feat|fix|chore|refactor|style|test|docs|build|ci|perf|nav|rebrand)(\([^)]*\))?:\s*/i, '')
    .trim();

  // Capitalise first letter
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);

  // Replace technical shorthand
  clean = clean
    .replace(/→/g, '→')
    .replace(/\bTS\b/g, 'TypeScript')
    .replace(/\bblob\b/gi, 'Blob storage')
    .replace(/\bKPI\b/g, 'KPI')
    .replace(/\bUI\b/g, 'UI');

  return clean;
}

// Skip purely internal/noise commits that users don't need to see
function shouldSkip(msg: string): boolean {
  const lower = msg.toLowerCase();
  const skipPhrases = [
    'force clean redeploy',
    'fix env vars',
    'redeploy with rotated',
    'fix typescript build errors',
    'fix token url',
    'fix statuses endpoint',
    'fix auth: add accept header',
    'simplify auth to localstorage',
    'fix login: use full page',
    'add real shbr logo',
    'bust stale blob',
    'bump stale cache',
    'bust all stale',
    'bump cache',
  ];
  return skipPhrases.some(p => lower.includes(p));
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Sydney',
  });
}

export async function GET() {
  // Auth check — admin only
  try {
    const session = await getSession();
    if (!session.accessToken || !session.userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch up to 200 commits from GitHub API
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=200`,
      { headers, cache: 'no-store' }
    );

    if (!res.ok) {
      console.error('[changelog] GitHub API error:', res.status);
      return NextResponse.json({ error: 'Could not fetch changelog from GitHub' }, { status: 502 });
    }

    const commits = await res.json() as Array<{
      sha: string;
      commit: { message: string; author: { date: string } };
    }>;

    // Process commits into entries
    const entries: ChangelogEntry[] = [];
    for (const c of commits) {
      const msg = c.commit.message.split('\n')[0].trim(); // first line only
      if (shouldSkip(msg)) continue;

      const date = c.commit.author.date.substring(0, 10); // YYYY-MM-DD
      entries.push({
        sha: c.sha.substring(0, 7),
        date,
        type: classifyType(msg),
        title: humanise(msg),
        raw: msg,
      });
    }

    // Group by date
    const grouped = new Map<string, ChangelogEntry[]>();
    for (const e of entries) {
      if (!grouped.has(e.date)) grouped.set(e.date, []);
      grouped.get(e.date)!.push(e);
    }

    const days: ChangelogDay[] = Array.from(grouped.entries())
      .sort((a, b) => b[0].localeCompare(a[0])) // newest first
      .map(([date, dayEntries]) => ({
        date,
        label: formatDateLabel(date),
        entries: dayEntries,
      }));

    return NextResponse.json({ days, total: entries.length });
  } catch (err) {
    console.error('[changelog] Error:', err);
    return NextResponse.json({ error: 'Failed to load changelog' }, { status: 500 });
  }
}
