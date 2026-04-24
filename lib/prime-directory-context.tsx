'use client';

/**
 * PrimeDirectoryContext — single-source-of-truth for the cached Prime user
 * directory on the admin page client.
 *
 * Lifecycle:
 *   - Mounts at the AdminPage root (Plan 04 wires this up).
 *   - Fetches GET /api/admin/prime-users ONCE on mount (D-16 single-fetch invariant).
 *   - Exposes O(1) `byEmail` Map for picker historical-detection + audit cascade.
 *   - `refresh()` calls Phase 1's POST /api/admin/prime-users/refresh then re-loads.
 *
 * Tri-state status (`loading | ready | error`) — Pitfall 1 mitigation.
 * Without the explicit `loading` signal, the picker mis-classifies every
 * existing config email as historical during the brief first-fetch window
 * (false-historical flash). Consumers MUST gate historical-detection on
 * `status === 'ready'`.
 *
 * Pitfall 3: the `byEmail` Map is built ONCE per `users` change inside this
 * Provider's setState — never inside a consumer. Consumers consume; never derive.
 *
 * Mounted at the AdminPage root (RESEARCH Open Question 2 → at AdminPage so
 * tab switches don't trigger re-fetches; both VisibilityTab and AuditTab
 * are sibling consumers).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { PrimeUser } from '@/lib/prime-users';

type DirectoryState =
  | { status: 'loading'; users: PrimeUser[]; byEmail: Map<string, PrimeUser>; lastSuccessAt: string | null; lastError: string | null }
  | { status: 'ready';   users: PrimeUser[]; byEmail: Map<string, PrimeUser>; lastSuccessAt: string | null; lastError: string | null }
  | { status: 'error';   users: PrimeUser[]; byEmail: Map<string, PrimeUser>; lastSuccessAt: string | null; lastError: string };

export interface PrimeDirectoryContextValue {
  status: 'loading' | 'ready' | 'error';
  users: PrimeUser[];
  byEmail: Map<string, PrimeUser>;
  lastSuccessAt: string | null;
  lastError: string | null;
  refresh: () => Promise<void>;
  refreshing: boolean;
}

interface GetResponse {
  users: PrimeUser[];
  lastSuccessAt: string | null;
  lastError: string | null;
}

// Default `null` forces `usePrimeDirectory()` to throw if used outside the Provider —
// a deliberate divergence from auth-context.tsx (which uses a populated default
// because it tolerates being read during the splash render). The directory hook
// is consumed only inside <AdminPage> where the Provider is guaranteed mounted.
const Ctx = createContext<PrimeDirectoryContextValue | null>(null);

export function PrimeDirectoryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DirectoryState>({
    status: 'loading',
    users: [],
    byEmail: new Map(),
    lastSuccessAt: null,
    lastError: null,
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/prime-users');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GetResponse = await res.json();
      // Pitfall 3: build the Map here — once per `users` change — so all
      // consumers share the same instance. Phase 1 already lowercased
      // emails at store time (mapRawToPrimeUser line 105); Map keys are
      // already canonical — but Pitfall 4 belt-and-braces motivates the
      // .toLowerCase() lookup on the consumer side too.
      const byEmail = new Map(data.users.map(u => [u.email, u]));
      setState({
        status: 'ready',
        users: data.users,
        byEmail,
        lastSuccessAt: data.lastSuccessAt,
        lastError: data.lastError,
      });
    } catch (err) {
      // PRESERVE prev.users / prev.byEmail (RESEARCH Pattern 2 lines 337-344).
      // A transient refresh failure must not wipe a previously-good cache.
      setState(prev => ({
        status: 'error',
        users: prev.users,
        byEmail: prev.byEmail,
        lastSuccessAt: prev.lastSuccessAt,
        lastError: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Phase 1 endpoint (already shipped). On success it re-populates the
      // blob; we then re-fetch GET to pick up the new state.
      await fetch('/api/admin/prime-users/refresh', { method: 'POST' });
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // WR-03: stable value identity. Note that `state` itself is a fresh object on
  // every successful load() (setState always passes a new object literal), so
  // consumers DO re-render on every refresh tick — this memo only short-circuits
  // when `refreshing` flips without `state` changing (rare, e.g. an in-flight
  // refresh aborts). The cost is bounded: load() runs only on mount + manual
  // refresh-button clicks, AuditTab's 60s interval doesn't touch this provider,
  // and the directory is ~30 users. Deep-equal short-circuiting is out of scope.
  const value = useMemo<PrimeDirectoryContextValue>(
    () => ({
      status: state.status,
      users: state.users,
      byEmail: state.byEmail,
      lastSuccessAt: state.lastSuccessAt,
      lastError: state.lastError,
      refresh,
      refreshing,
    }),
    [state, refresh, refreshing],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrimeDirectory(): PrimeDirectoryContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('usePrimeDirectory must be inside <PrimeDirectoryProvider>');
  }
  return ctx;
}
