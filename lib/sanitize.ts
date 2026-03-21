/**
 * Shared input sanitisation helpers.
 */

/**
 * Sanitise a job number for use in blob storage paths.
 * Allows only alphanumeric characters, hyphens, and underscores.
 * Returns null if the result is empty (invalid input).
 */
export function sanitizeJobNumber(raw: string): string | null {
  const safe = String(raw).replace(/[^a-zA-Z0-9\-_]/g, '');
  return safe.length > 0 ? safe.slice(0, 64) : null;
}
