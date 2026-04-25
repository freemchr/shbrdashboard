import type { PrimeUser } from '@/lib/prime-users';

/**
 * D-15 three-step actor cascade.
 *
 * Layer 1: live Prime fullName (from refreshed user list)
 * Layer 2: snapshot name on the audit/auth row (cookie-time userName)
 * Layer 3: bare email
 *
 * Defensive: treats empty / whitespace-only strings at each layer as missing.
 * Used by both <PrimeUserPicker> rows AND audit tab rows.
 */
export function resolveDisplayName(
  email: string,
  primeUsers: PrimeUser[],
  fallbackName?: string | null,
): string {
  const normalised = email.trim().toLowerCase();
  const live = primeUsers.find(u => u.email === normalised);
  if (live?.fullName?.trim()) return live.fullName.trim();
  if (fallbackName?.trim()) return fallbackName.trim();
  return email;
}

/**
 * Returns true when the email could NOT be matched in the live directory —
 * the row should render with the "No Prime record found" tooltip (D-09).
 */
export function isUnresolvedEmail(email: string, primeUsers: PrimeUser[]): boolean {
  const normalised = email.trim().toLowerCase();
  return !primeUsers.find(u => u.email === normalised);
}

/** Returns the matched PrimeUser (or null) — for callers that need division. */
export function findPrimeUser(email: string, primeUsers: PrimeUser[]): PrimeUser | null {
  const normalised = email.trim().toLowerCase();
  return primeUsers.find(u => u.email === normalised) ?? null;
}
