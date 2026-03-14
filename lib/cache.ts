const cache = new Map<string, { data: unknown; expiresAt: number }>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function deleteCached(key: string): void {
  cache.delete(key);
}

export function clearCache(): void {
  cache.clear();
}
