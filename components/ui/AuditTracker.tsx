'use client';

// AuditTracker — page_view logging disabled to reduce blob usage.
// Only login and logout events are recorded (see api/auth/login and api/auth/logout).
export function AuditTracker() {
  return null;
}
