import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelative } from './format-relative';

const NOW = new Date('2026-04-25T12:00:00.000Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('formatRelative', () => {
  it('returns "just now" for < 60 seconds elapsed', () => {
    expect(formatRelative(NOW)).toBe('just now');
    expect(formatRelative(NOW - 30_000)).toBe('just now');
    expect(formatRelative(NOW - 59_000)).toBe('just now');
  });

  it('returns "{n}m ago" for < 60 minutes', () => {
    expect(formatRelative(NOW - 60_000)).toBe('1m ago');
    expect(formatRelative(NOW - 5 * 60_000)).toBe('5m ago');
    expect(formatRelative(NOW - 59 * 60_000)).toBe('59m ago');
  });

  it('returns "{n}h ago" for < 24 hours', () => {
    expect(formatRelative(NOW - 60 * 60_000)).toBe('1h ago');
    expect(formatRelative(NOW - 3 * 60 * 60_000)).toBe('3h ago');
    expect(formatRelative(NOW - 23 * 60 * 60_000)).toBe('23h ago');
  });

  it('returns singular "1 day ago" for exactly 1 day', () => {
    expect(formatRelative(NOW - 24 * 60 * 60_000)).toBe('1 day ago');
  });

  it('returns plural "{n} days ago" for 2-6 days', () => {
    expect(formatRelative(NOW - 2 * 24 * 60 * 60_000)).toBe('2 days ago');
    expect(formatRelative(NOW - 5 * 24 * 60 * 60_000)).toBe('5 days ago');
    expect(formatRelative(NOW - 6 * 24 * 60 * 60_000)).toBe('6 days ago');
  });

  it('returns singular "1 week ago" for exactly 7 days', () => {
    expect(formatRelative(NOW - 7 * 24 * 60 * 60_000)).toBe('1 week ago');
  });

  it('returns plural "{n} weeks ago" for 2-4 weeks', () => {
    expect(formatRelative(NOW - 14 * 24 * 60 * 60_000)).toBe('2 weeks ago');
    expect(formatRelative(NOW - 28 * 24 * 60 * 60_000)).toBe('4 weeks ago');
  });

  it('returns singular "1 month ago" for exactly 30 days', () => {
    expect(formatRelative(NOW - 30 * 24 * 60 * 60_000)).toBe('1 month ago');
  });

  it('returns plural "{n} months ago" for ≥ 60 days', () => {
    expect(formatRelative(NOW - 60 * 24 * 60 * 60_000)).toBe('2 months ago');
  });

  it('accepts ISO string input', () => {
    expect(formatRelative(new Date(NOW - 5 * 60_000).toISOString())).toBe('5m ago');
  });

  it('accepts Date instance input', () => {
    expect(formatRelative(new Date(NOW - 3 * 60 * 60_000))).toBe('3h ago');
  });

  it('returns "just now" for future timestamp (clock skew defensive)', () => {
    expect(formatRelative(NOW + 60_000)).toBe('just now');
  });

  it('returns "just now" for invalid input', () => {
    expect(formatRelative('not-a-date')).toBe('just now');
    expect(formatRelative(NaN)).toBe('just now');
  });
});
