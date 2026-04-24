---
phase: 03-admin-picker-identity-rich-display
fixed_at: 2026-04-24T08:53:00Z
review_path: .planning/phases/03-admin-picker-identity-rich-display/03-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-04-24T08:53:00Z
**Source review:** .planning/phases/03-admin-picker-identity-rich-display/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (Critical 0 + Warning 4)
- Fixed: 4
- Skipped: 0
- Test suite: 69/69 GREEN (matches baseline — no test count change)

## Fixed Issues

### WR-01: Case-insensitive email handling in PrimeUserPicker

**Files modified:** `components/ui/PrimeUserPicker.tsx`
**Commit:** 976f822
**Applied fix:** Normalize-on-save approach. `addEmail` now lowercases both the incoming
email and every existing entry before deduping via `new Set`, so saved values are canonical
lowercase. `removeEmail`, the dropdown row's `isAlreadySelected` guard, and the keyboard
Enter dedupe in `onKeyDown` all use case-insensitive comparison via `.toLowerCase()` so
legacy mixed-case VisibilityConfig blob entries can no longer silently duplicate against
lowercase Prime emails. Matches Phase 1 D-09 normalization (`lib/prime-users.ts:105`).

### WR-02: Defensive cascade when PrimeUser.fullName is empty

**Files modified:** `components/ui/PrimeUserPicker.tsx`
**Commit:** a5d9899
**Applied fix:** `sortKey` now uses `(u.fullName?.trim() || email).toLowerCase()` and the
live `Chip` component computes `displayName = user.fullName?.trim() || email` for both the
chip body text and the aria-label of the remove button. Mirrors the D-10 cascade in
`TopBar.tsx:48` and the audit cascade in `page.tsx:623`. Prevents empty chip rendering
when Prime omits firstName/lastName (per `lib/prime-users.ts:106`).

### WR-03: Honest comment on PrimeDirectoryProvider memo

**Files modified:** `lib/prime-directory-context.tsx`
**Commit:** 66aaac1
**Applied fix:** Replaced the misleading "consumers don't re-render on `refreshing`
toggles" comment (which the implementation does not actually deliver — `state` gets a
fresh object identity on every successful `load()`) with an accurate description of
the bounded cost: load() runs only on mount + manual refresh-button clicks, AuditTab's
60s interval doesn't touch this provider, and the directory is ~30 users. Deep-equal
short-circuiting explicitly deferred as out-of-scope for v1. Smaller, more honest change
chosen per guidance.

### WR-04: setTimeout cleanup + relatedTarget guard

**Files modified:** `components/ui/PrimeUserPicker.tsx`
**Commit:** fd95101
**Applied fix:** Added `useRef<NodeJS.Timeout | null>` to track the onBlur close-timer
and a `useEffect` cleanup that clears it on unmount (eliminates React 18's
"Cannot update unmounted component" warning). Also added a `relatedTarget`
check in `onBlur` that skips scheduling the close if focus moved into the
listbox itself — addresses the keyboard Tab race. Used `CSS.escape(listboxId)`
for the selector because React 18's `useId()` returns IDs containing `:`
which break a naked `#id` selector. Preserved the existing 100ms timeout
behaviour (smaller, lower-risk fix per guidance).

## Verification

- Per-fix Tier 1 (re-read modified file sections) confirmed for all 4 fixes
- Per-fix Tier 2 (vitest scoped to PrimeUserPicker.test.tsx + page.test.tsx, 21/21 passing) confirmed for all 4 fixes
- Final full `npm test` run: 7/7 test files passing, 69/69 tests passing — matches baseline (no test count change)
- Pre-existing TypeScript errors in `app/api/auth/login/route.test.ts` and `lib/audit.test.ts` (mockResolvedValueOnce on never) are unrelated to this phase's fixes and ignored per verification strategy

---

_Fixed: 2026-04-24T08:53:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
