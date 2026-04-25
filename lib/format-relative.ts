/**
 * Format an absolute timestamp as a human-relative phrase.
 *
 * Unit thresholds (locked by Phase 3 UI-SPEC §"Refresh Button + Metadata Strip"):
 *   < 60s          → "just now"
 *   < 60 minutes   → "{n}m ago"
 *   < 24 hours     → "{n}h ago"
 *   < 7 days       → "{n} day[s] ago"
 *   < 30 days      → "{n} week[s] ago"
 *   ≥ 30 days      → "{n} month[s] ago"
 *
 * Accepts ISO strings, Date instances, or epoch-ms numbers.
 * Defensive: future/invalid timestamps return "just now" — never throws.
 *
 * Phase 3 D-13 consumer: Visibility tab refresh-metadata strip.
 * Lifted+extended from components/ui/DataRefreshButton.tsx:24-32.
 */
export function formatRelative(input: string | Date | number): string {
  let ms: number;
  if (input instanceof Date) ms = input.getTime();
  else if (typeof input === 'number') ms = input;
  else ms = new Date(input).getTime();

  if (!Number.isFinite(ms)) return 'just now';

  const diffMs = Date.now() - ms;
  if (diffMs < 0) return 'just now';                              // future / clock skew

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;

  const diffWk = Math.floor(diffDay / 7);
  if (diffDay < 30) return `${diffWk} ${diffWk === 1 ? 'week' : 'weeks'} ago`;

  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo} ${diffMo === 1 ? 'month' : 'months'} ago`;
}
