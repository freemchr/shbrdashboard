// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { PrimeUser } from '@/lib/prime-users';

// Mock the directory context that Wave 1 Plan 03 will create.
// PrimeDirectoryProvider mock returns children via React.createElement (avoids JSX-fragment
// parse ambiguity inside the hoisted vi.mock factory — Vite's import-analysis plugin rejects
// `<>{children}</>` here even in a .tsx file).
vi.mock('@/lib/prime-directory-context', () => ({
  usePrimeDirectory: vi.fn(),
  PrimeDirectoryProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// Phase 2 auth-context — already shipped; mock to make AdminPage render-able in isolation.
vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(() => ({
    userEmail: 'admin@shbr.com',
    userName: 'Admin',
    isAdmin: true,
    hiddenPaths: new Set<string>(),
    primeUser: null,
  })),
}));

// next/navigation stub — AuditTab uses useRouter / useSearchParams.
// Wave 2 (Plan 04): seed `tab=audit` so AdminPage lands on the AuditTab — the test
// assertions ("Jane (Live) Doe", "Prime miss" option, action=prime_user_miss fetch)
// are all AuditTab-scoped. Without this, AdminPage defaults to VisibilityTab and the
// audit DOM never renders. (Server-side `/api/auth/session` check is harmless: the
// fetch mock returns audit-shaped JSON; `data.isAdmin` is undefined → router.replace('/')
// fires but useRouter() is mocked, so it's a no-op.)
//
// `routerStub` is a singleton so `useRouter()` returns a referentially-stable object
// across renders. Without this, AuditTab's `fetchEntries` useCallback (depending on
// `router`) gets a fresh identity each render → useEffect re-fires → new fetch → new
// setState → re-render → infinite loop, hanging the test runner.
// vi.hoisted() is needed because vi.mock() factories are hoisted above all imports;
// a plain top-level const wouldn't be in scope when the factory runs.
const { routerStub } = vi.hoisted(() => ({
  routerStub: { replace: () => undefined, push: () => undefined, refresh: () => undefined },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => routerStub,
  useSearchParams: () => new URLSearchParams('tab=audit'),
  usePathname: () => '/admin',
}));

import { usePrimeDirectory } from '@/lib/prime-directory-context';
import { useAuth } from '@/lib/auth-context';
const mockedUseDirectory = vi.mocked(usePrimeDirectory);
const mockedUseAuth = vi.mocked(useAuth);

function makeUser(overrides: Partial<PrimeUser> = {}): PrimeUser {
  return {
    id: 'u1', email: 'jane@shbr.com', fullName: 'Jane Doe',
    firstName: 'Jane', lastName: 'Doe',
    division: null, region: null, roleOrTrade: null,
    status: 'active',
    ...overrides,
  };
}

function makeDirectoryReady(users: PrimeUser[]) {
  const byEmail = new Map(users.map(u => [u.email, u]));
  return {
    status: 'ready' as const,
    users,
    byEmail,
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
    refresh: vi.fn(),
    refreshing: false,
  };
}

function makeAuditEntry(overrides: Partial<{
  id: string; timestamp: string; email: string; name: string; action: string;
}> = {}) {
  return {
    id: 'e1',
    timestamp: '2026-04-24T01:00:00.000Z',
    email: 'jane@shbr.com',
    name: '',
    action: 'login' as const,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  // resetAllMocks clears `vi.fn(() => ({...}))` implementations to bare returns-undefined.
  // Re-prime the auth mock so AdminPage's `const { isAdmin } = useAuth()` doesn't crash.
  // (next/navigation hooks are plain arrow fns in the vi.mock factory, not vi.fn(), so
  // they survive reset.)
  mockedUseAuth.mockReturnValue({
    userEmail: 'admin@shbr.com',
    userName: 'Admin',
    isAdmin: true,
    hiddenPaths: new Set<string>(),
    primeUser: null,
  });
});

// Import AdminPage AFTER mocks so the mocked context is consumed.
// We intentionally import the page module — Wave 2 Plan 04 will wire
// PrimeDirectoryProvider + the audit cascade INTO this module.
describe('AuditTab — actor cascade (D-11 / D-12)', () => {
  it('renders live PrimeUser.fullName when email is in byEmail (live-hit)', async () => {
    const { default: AdminPage } = await import('./page');
    const live = makeUser({ email: 'jane@shbr.com', fullName: 'Jane (Live) Doe' });
    mockedUseDirectory.mockReturnValue(makeDirectoryReady([live]) as never);
    // Stub the audit fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entries: [makeAuditEntry({ email: 'jane@shbr.com', name: 'Saved Name (stale)' })],
      }),
    }) as never;
    render(<AdminPage />);
    // Switch to audit tab if needed (manual UAT covers tab navigation; here we just assert the resolver result)
    // The test asserts that when the AuditTab renders, the cascade resolves the live name.
    await waitFor(() => {
      expect(screen.queryByText('Jane (Live) Doe')).toBeInTheDocument();
    }, { timeout: 1500 });
  });

  it('falls back to entry.name when live-miss + saved-hit', async () => {
    const { default: AdminPage } = await import('./page');
    mockedUseDirectory.mockReturnValue(makeDirectoryReady([]) as never); // no live entries
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entries: [makeAuditEntry({ email: 'jane@shbr.com', name: 'Saved Name' })],
      }),
    }) as never;
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.queryByText('Saved Name')).toBeInTheDocument();
    }, { timeout: 1500 });
  });

  it('falls back to entry.email when live-miss + saved-miss; secondary line does NOT render (D-12)', async () => {
    const { default: AdminPage } = await import('./page');
    mockedUseDirectory.mockReturnValue(makeDirectoryReady([]) as never);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entries: [makeAuditEntry({ email: 'orphan@shbr.com', name: '' })],
      }),
    }) as never;
    render(<AdminPage />);
    await waitFor(() => {
      // Email renders as primary
      const primaryCells = screen.queryAllByText('orphan@shbr.com');
      // D-12: only ONE rendering (primary line) — no duplicated secondary email line
      expect(primaryCells.length).toBe(1);
    }, { timeout: 1500 });
  });

  it('whitespace-only fullName falls through the cascade (.trim() defensiveness — TopBar pattern)', async () => {
    const { default: AdminPage } = await import('./page');
    const live = makeUser({ email: 'jane@shbr.com', fullName: '   ' }); // whitespace-only
    mockedUseDirectory.mockReturnValue(makeDirectoryReady([live]) as never);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entries: [makeAuditEntry({ email: 'jane@shbr.com', name: 'Saved Name' })],
      }),
    }) as never;
    render(<AdminPage />);
    await waitFor(() => {
      // Whitespace fullName MUST NOT pass the `||` short-circuit; saved name wins
      expect(screen.queryByText('Saved Name')).toBeInTheDocument();
    }, { timeout: 1500 });
  });
});

describe('AuditTab — filter dropdown extension (D-13)', () => {
  it('select contains <option value="prime_user_miss">Prime miss</option>', async () => {
    const { default: AdminPage } = await import('./page');
    mockedUseDirectory.mockReturnValue(makeDirectoryReady([]) as never);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [] }),
    }) as never;
    render(<AdminPage />);
    await waitFor(() => {
      // The literal option label is locked to "Prime miss" per UI-SPEC Surface 13
      const option = screen.queryByRole('option', { name: 'Prime miss' });
      expect(option).not.toBeNull();
      expect((option as HTMLOptionElement).value).toBe('prime_user_miss');
    }, { timeout: 1500 });
  });

  it('selecting Prime miss issues a fetch with action=prime_user_miss', async () => {
    const { default: AdminPage } = await import('./page');
    mockedUseDirectory.mockReturnValue(makeDirectoryReady([]) as never);
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [] }),
    });
    global.fetch = fetchSpy as never;
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'Prime miss' })).not.toBeNull();
    }, { timeout: 1500 });
    const select = screen.getByRole('combobox', { name: /action|filter/i }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'prime_user_miss' } });
    await waitFor(() => {
      const auditCalls = fetchSpy.mock.calls.filter((c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('action=prime_user_miss'));
      expect(auditCalls.length).toBeGreaterThan(0);
    }, { timeout: 1500 });
  });
});
