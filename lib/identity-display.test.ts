import { describe, it, expect } from 'vitest';
import type { PrimeUser } from './prime-users';
import { resolveDisplayName, isUnresolvedEmail, findPrimeUser } from './identity-display';

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

describe('resolveDisplayName (D-15 cascade)', () => {
  it('Layer 1 hit: returns trimmed Prime fullName when live user present', () => {
    const users = [pu({ email: 'jane@shbr.com', fullName: '  Jane Doe  ' })];
    expect(resolveDisplayName('jane@shbr.com', users, 'ignored')).toBe('Jane Doe');
  });

  it('Layer 1 whitespace-only fullName falls through to Layer 2 fallbackName', () => {
    const users = [pu({ email: 'jane@shbr.com', fullName: '   ' })];
    expect(resolveDisplayName('jane@shbr.com', users, 'Jane Snapshot')).toBe('Jane Snapshot');
  });

  it('Layer 1 missing + Layer 2 fallbackName present: returns trimmed fallbackName', () => {
    expect(resolveDisplayName('ghost@shbr.com', [], '  Ghost Entry  ')).toBe('Ghost Entry');
  });

  it('Layer 1 missing + Layer 2 null: returns email verbatim', () => {
    expect(resolveDisplayName('ghost@shbr.com', [], null)).toBe('ghost@shbr.com');
  });

  it('Layer 1 missing + Layer 2 undefined: returns email verbatim', () => {
    expect(resolveDisplayName('ghost@shbr.com', [])).toBe('ghost@shbr.com');
  });

  it('Layer 1 missing + Layer 2 whitespace-only: returns email verbatim', () => {
    expect(resolveDisplayName('ghost@shbr.com', [], '   ')).toBe('ghost@shbr.com');
  });

  it('Mixed-case email input matches lowercase Prime emails', () => {
    const users = [pu({ email: 'jane@shbr.com', fullName: 'Jane Doe' })];
    expect(resolveDisplayName('JANE@SHBR.COM', users)).toBe('Jane Doe');
  });

  it('Email with surrounding whitespace matches lowercase Prime emails', () => {
    const users = [pu({ email: 'jane@shbr.com', fullName: 'Jane Doe' })];
    expect(resolveDisplayName('  jane@shbr.com  ', users)).toBe('Jane Doe');
  });
});

describe('isUnresolvedEmail', () => {
  it('returns false when email matches', () => {
    const users = [pu({ email: 'jane@shbr.com' })];
    expect(isUnresolvedEmail('jane@shbr.com', users)).toBe(false);
  });

  it('returns true when email does not match', () => {
    const users = [pu({ email: 'jane@shbr.com' })];
    expect(isUnresolvedEmail('ghost@shbr.com', users)).toBe(true);
  });

  it('normalizes input before lookup (mixed case + whitespace)', () => {
    const users = [pu({ email: 'jane@shbr.com' })];
    expect(isUnresolvedEmail('  JANE@SHBR.COM  ', users)).toBe(false);
  });

  it('returns true for empty list', () => {
    expect(isUnresolvedEmail('any@shbr.com', [])).toBe(true);
  });
});

describe('findPrimeUser', () => {
  it('returns the matched user when present', () => {
    const jane = pu({ email: 'jane@shbr.com', fullName: 'Jane Doe' });
    expect(findPrimeUser('jane@shbr.com', [jane])).toBe(jane);
  });

  it('returns null when not present', () => {
    expect(findPrimeUser('ghost@shbr.com', [pu()])).toBeNull();
  });

  it('normalizes input before lookup', () => {
    const jane = pu({ email: 'jane@shbr.com' });
    expect(findPrimeUser(' JANE@SHBR.COM ', [jane])).toBe(jane);
  });
});
