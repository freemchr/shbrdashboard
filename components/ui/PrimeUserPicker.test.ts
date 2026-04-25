import { describe, it, expect } from 'vitest';
import type { PrimeUser } from '@/lib/prime-users';
import { filterPrimeUsers, normalizeManualEmail } from './PrimeUserPicker';

/**
 * Pure-function coverage per Plan 03-03 D-19.
 * No JSX, no DOM mounting — only the two exported helpers.
 */

function pu(overrides: Partial<PrimeUser> = {}): PrimeUser {
  return {
    id: 'u1',
    email: 'jane@shbr.com',
    fullName: 'Jane Doe',
    firstName: 'Jane',
    lastName: 'Doe',
    division: null,
    region: null,
    roleOrTrade: null,
    status: 'active',
    ...overrides,
  };
}

const USERS: PrimeUser[] = [
  pu({ email: 'jane@shbr.com',          fullName: 'Jane Doe',         division: 'Estimators' }),
  pu({ email: 'bob@shbr.com',           fullName: 'Bob Smith',        division: null }),
  pu({ email: 'alice@example.com',      fullName: 'Alice Estimator',  division: null }),
  pu({ email: 'chris@techgurus.com.au', fullName: 'Chris Freeman',    division: null, status: 'inactive' }),
];

describe('filterPrimeUsers (D-03 — case-insensitive across name + email + division)', () => {
  it('returns full list when query is empty', () => {
    expect(filterPrimeUsers('', USERS)).toHaveLength(USERS.length);
  });

  it('returns full list when query is whitespace-only', () => {
    expect(filterPrimeUsers('   ', USERS)).toHaveLength(USERS.length);
  });

  it('matches by fullName substring case-insensitively', () => {
    const result = filterPrimeUsers('jane', USERS);
    expect(result.map(u => u.email)).toEqual(['jane@shbr.com']);
  });

  it('matches by uppercase fullName substring', () => {
    const result = filterPrimeUsers('SMITH', USERS);
    expect(result.map(u => u.email)).toEqual(['bob@shbr.com']);
  });

  it('matches by email substring case-insensitively', () => {
    const result = filterPrimeUsers('shbr', USERS);
    expect(result.map(u => u.email).sort()).toEqual(['bob@shbr.com', 'jane@shbr.com']);
  });

  it('matches by division substring case-insensitively', () => {
    const result = filterPrimeUsers('estim', USERS);
    // Matches "Estimators" (Jane's division) AND "Estimator" (in Alice's fullName)
    expect(result.map(u => u.email).sort()).toEqual(['alice@example.com', 'jane@shbr.com']);
  });

  it('null division is null-safe and contributes no match', () => {
    // Bob has null division; query should not throw and should not match Bob via division
    const result = filterPrimeUsers('estim', USERS);
    expect(result.find(u => u.email === 'bob@shbr.com')).toBeUndefined();
  });

  it('returns empty array when no field matches', () => {
    expect(filterPrimeUsers('zzzzz_no_match', USERS)).toEqual([]);
  });

  it('trims surrounding whitespace from query before filtering', () => {
    const result = filterPrimeUsers('  jane  ', USERS);
    expect(result.map(u => u.email)).toEqual(['jane@shbr.com']);
  });
});

describe('normalizeManualEmail (D-12 + Phase 1 D-09 normalization)', () => {
  it('returns ok with lowercased email for valid input', () => {
    expect(normalizeManualEmail('User@Example.com')).toEqual({ ok: true, email: 'user@example.com' });
  });

  it('trims surrounding whitespace before validating', () => {
    expect(normalizeManualEmail('  alice@example.com  ')).toEqual({ ok: true, email: 'alice@example.com' });
  });

  it('returns reason=empty for empty string', () => {
    expect(normalizeManualEmail('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('returns reason=empty for whitespace-only string', () => {
    expect(normalizeManualEmail('     ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('returns reason=invalid when @ is missing', () => {
    expect(normalizeManualEmail('not-an-email')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('returns reason=invalid when TLD is missing (no dot after @)', () => {
    expect(normalizeManualEmail('user@example')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('returns reason=invalid when local-part contains whitespace', () => {
    expect(normalizeManualEmail('not valid@example.com')).toEqual({ ok: false, reason: 'invalid' });
  });
});
