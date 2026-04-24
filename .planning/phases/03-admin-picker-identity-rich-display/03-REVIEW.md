---
phase: 03-admin-picker-identity-rich-display
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - app/admin/page.tsx
  - app/admin/page.test.tsx
  - app/api/admin/prime-users/route.ts
  - app/api/admin/prime-users/route.test.ts
  - app/api/audit/entries/route.ts
  - components/ui/PrimeUserPicker.tsx
  - components/ui/PrimeUserPicker.test.tsx
  - lib/prime-directory-context.tsx
  - package.json
  - vitest.config.ts
  - vitest.setup.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-04-24
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 3 implementation correctly delivers the PrimeUserPicker, tri-state directory context, identity-rich audit cascade, and `prime_user_miss` filter. All hard invariants from the planning artifacts hold:

- **Pitfall 5 (D-15) PASS** — `app/api/admin/prime-users/route.ts` imports `getCached` from `@/lib/blob-cache` directly. No reference to `getAllPrimeUsers` / `refreshPrimeUsers` anywhere in the route file.
- **Pitfall 1 (D-19/D-22) PASS** — `historicalCount` is gated on `status === 'ready'` (PrimeUserPicker.tsx:117) and the loading branch renders neutral non-italic chips (lines 174-189).
- **Pitfall 2 PASS** — Listbox `<li>` rows have `onMouseDown={e => e.preventDefault()}` (PrimeUserPicker.tsx:319).
- **D-23 PASS** — `lib/page-visibility.ts` is not in the changed-file set; picker emits `string[]` written into `config.admins` / `group.members` unchanged.
- **D-16 PASS** — `<PrimeDirectoryProvider>` wraps the tab switch (`app/admin/page.tsx:118-124`), so AuditTab and VisibilityTab share the single fetched directory.
- **T-03-02-04 PASS** — `components/ui/PrimeUserPicker.tsx` runtime imports are limited to `react`, `lucide-react`, `@/lib/prime-directory-context`. `import type { PrimeUser }` from `@/lib/prime-users` is type-only and erased at compile.
- **D-13 paired change PASS** — `prime_user_miss` appears both in the AdminPage `<select>` (line 584) and the `/api/audit/entries` allowlist (route.ts:35).

The findings below are quality / hardening issues — none block the phase. Two warnings touch real correctness edges (case-sensitivity on legacy mixed-case emails; sortKey crash on missing fullName); the others are tightenings.

## Warnings

### WR-01: addEmail / isAlreadySelected use case-sensitive comparison; legacy mixed-case selections will silently dedupe-fail

**File:** `components/ui/PrimeUserPicker.tsx:131-137, 311`
**Issue:** `addEmail` deduplicates via `Array.from(new Set([...selected, email]))` — Set membership is case-sensitive. If the existing `VisibilityConfig` blob contains a legacy mixed-case entry (e.g. `Jane@SHBR.com`) and the user picks the live Jane (whose `PrimeUser.email` is lowercased at store by `lib/prime-users.ts:105`), the Set treats them as distinct values and both get persisted. Same bug affects `selected.includes(user.email)` on line 311 — the "already added" guard misses, so the row is clickable and re-adds a duplicate. `lib/page-visibility.ts` documents the contract as lowercase (`members: string[]; // lowercase emails`), but the picker is the new ingress point for that field and should normalise defensively to prevent duplicate accumulation across edits. (`removeEmail` line 141 has the symmetric bug — clicking × on a mixed-case legacy chip won't remove a lowercase counterpart.)
**Fix:**
```tsx
const addEmail = useCallback(
  (email: string) => {
    const normalised = email.toLowerCase();
    const next = multiSelect
      ? Array.from(new Set([...selected.map(e => e.toLowerCase()), normalised]))
      : [normalised];
    onChange(next);
  },
  [selected, onChange, multiSelect],
);

// And in the dropdown row:
const isAlreadySelected = selected.some(e => e.toLowerCase() === user.email.toLowerCase());
```

### WR-02: sortKey crashes if a PrimeUser has empty/missing fullName

**File:** `components/ui/PrimeUserPicker.tsx:104-113`
**Issue:** `sortKey: u.fullName.toLowerCase()` assumes `fullName` is a non-null string. The `PrimeUser` type declares `fullName: string`, but `lib/prime-users.ts:106` builds it as `str(a.fullName) ?? \`${firstName} ${lastName}\`.trim()` — when both Prime `firstName` and `lastName` are absent, `fullName` becomes the empty string `""`. That sorts but is a footgun if the type contract ever drifts to `string | null` (Prime API shape can change without warning per CLAUDE.md). More importantly, the same field is dereferenced in `Chip` (`{user.fullName}`, line 52) and as the chip's tooltip text, so an empty fullName renders an empty chip body with only the × button. Either tighten the type guarantee with a fallback at chip render or add a defensive fallback to `email` for sort + display.
**Fix:**
```tsx
return u
  ? { kind: 'live' as const, email, sortKey: (u.fullName || email).toLowerCase(), user: u }
  : { kind: 'historical' as const, email, sortKey: email.toLowerCase() };

// And in <Chip>:
<span className="truncate">{user.fullName || email}</span>
```

### WR-03: Provider-value memo only narrows updates from `refreshing` toggles; consumers still re-render on every audit refresh tick

**File:** `lib/prime-directory-context.tsx:123-134`
**Issue:** The `useMemo` dependency array `[state, refresh, refreshing]` only avoids new value identities when ALL three are stable. But `state` is a fresh object on every `setState({ status: 'ready', ... })` call inside `load()`, even when the response is byte-identical. Phase 1 D-16's "single fetch" invariant means `load()` only runs on mount + manual refresh, so this is dormant today. However: the `byEmail` Map identity also changes on every `load`, which means `useMemo([selected, byEmail])` in `PrimeUserPicker.tsx:104` and the audit cascade `byEmail.get(...)` on `app/admin/page.tsx:621` recompute / re-render the entire 200-row audit table on every refresh-button click. AuditTab also auto-refreshes its own fetch every 60s (`page.tsx:557`), but that does NOT touch the directory — so this is bounded. Still, the memo's stated intent in the comment ("consumers don't re-render on `refreshing` toggles when `state` is unchanged") is not what the implementation delivers; the comment is misleading. Either drop the comment or split the memo into stable sub-values.
**Fix:** Either (a) update the comment to reflect "memo prevents new identity on `refreshing` flips when `state` *reference* is unchanged — which today only happens never, since every `load()` calls `setState`", or (b) destructure to depend on individual primitives:
```tsx
const value = useMemo<PrimeDirectoryContextValue>(
  () => ({ status: state.status, users: state.users, byEmail: state.byEmail,
           lastSuccessAt: state.lastSuccessAt, lastError: state.lastError,
           refresh, refreshing }),
  [state.status, state.users, state.byEmail, state.lastSuccessAt, state.lastError, refresh, refreshing],
);
```
This still re-computes on every `setState` (each field gets new identity from the new state object), but at least documents intent. The structural fix is to short-circuit `setState` when the new payload deep-equals the previous — out of scope for v1.

### WR-04: Picker's onBlur uses setTimeout(100) — race-prone with fast keyboard navigation; can dismiss dropdown mid-interaction

**File:** `components/ui/PrimeUserPicker.tsx:258`
**Issue:** `onBlur={() => setTimeout(() => setOpen(false), 100)}` is a heuristic to let a click on a dropdown row settle before the input loses focus. The 100ms window can race: a fast Tab-then-Click (or arrow-then-click) can fire `setOpen(false)` after the click handler already added the email, leaving the dropdown dismissed but `activeIndex` non-reset. Also, the timeout is never cleared on unmount — if the component unmounts within 100ms of blur, React 18 will warn "Cannot update unmounted component". The Pitfall 2 mitigation (onMouseDown preventDefault) means the blur-then-click race is largely mooted for mouse, but keyboard Tab + Enter still hits this. Better: use `onMouseDown` + relatedTarget check, or maintain an `openRef` and clear the timeout on next interaction.
**Fix:**
```tsx
const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => () => { if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current); }, []);
// ...
onBlur={(e) => {
  // Don't close if focus moved to the listbox itself.
  if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest(`#${listboxId}`)) return;
  blurTimeoutRef.current = setTimeout(() => setOpen(false), 100);
}}
```

## Info

### IN-01: AuditTab byEmail-cascade `displayName !== entry.email` is fragile against case mismatch

**File:** `app/admin/page.tsx:621-625`
**Issue:** `const live = byEmail.get(entry.email.toLowerCase());` — good, lowercases for the lookup. `const displayName = live?.fullName?.trim() || entry.name || entry.email;` then compares `displayName !== entry.email`. If `entry.email` is mixed case (audit log captures session email with whatever case the OAuth response gave) AND `entry.name` is empty AND directory misses, displayName equals `entry.email` (mixed case) and `showEmailLine` is false — correct. But if a future audit-write path canonicalises to lowercase while existing rows stay mixed-case, the comparison `displayName !== entry.email` may produce false positives where the secondary line renders the same email twice with different case. Low risk — `lib/audit.ts:31` doesn't lowercase, so today's behaviour is consistent. Worth a comment.
**Fix:** Either explicitly compare lowercased forms, or add a brief comment on the comparison that documents the assumption.

### IN-02: Audit fetchEntries useEffect double-fires on mount

**File:** `app/admin/page.tsx:555-559`
**Issue:** Two `useEffect`s depend on `fetchEntries` — line 555 does the initial fetch, line 556-559 sets up the 60s interval. Both depend on the same callback identity, so when `actionFilter` or `rangeFilter` changes the interval is torn down and recreated *and* a fresh fetch fires immediately from the first effect. That's the desired behaviour. However, on initial mount both effects run synchronously, which means the interval is created with `fetchEntries` already in flight — fine, but a single combined effect would be clearer:
**Fix:**
```tsx
useEffect(() => {
  fetchEntries();
  const id = setInterval(fetchEntries, 60_000);
  return () => clearInterval(id);
}, [fetchEntries]);
```
The `intervalRef` `useRef` then becomes unnecessary (it's only read inside the same effect's cleanup).

### IN-03: AdminPage server-side session check writes to router on a delayed promise without abort

**File:** `app/admin/page.tsx:72-79`
**Issue:** The "belt-and-suspenders" `/api/auth/session` fetch fires once on mount; if the user navigates away before the response, `router.replace('/')` fires against an unmounted page. Next.js's `useRouter` is generally tolerant, but the pattern is brittle. Lower-risk than WR-04 because it's a single in-flight request, but consider adding an AbortController if you find it noisy in production.
**Fix:** Use `AbortController` with cleanup in the effect — or accept the risk as documented behaviour.

### IN-04: PrimeUserPicker formatRelative is inlined but defined outside the component — could be hoisted module-scope (it already is)

**File:** `components/ui/PrimeUserPicker.tsx:19-38`
**Issue:** Reads cleanly. Minor: `Intl.RelativeTimeFormat` is constructed on every call; instantiating once at module scope is a marginal allocation win and matches Phase 1's `intlAEDT` pattern in audit logs (if such exists). Not worth changing unless similar consumers appear.
**Fix:** None required; flagged for awareness.

### IN-05: vitest.setup.ts comment references "Wave 0 (Plan 03-01) intentionally avoided setupFiles per its summary; Wave 1 reintroduces"

**File:** `vitest.setup.ts:9-11`
**Issue:** Excellent context comment — preserves the rationale. No bug. Worth noting that this file is now load-bearing for *every* test (not just picker tests), so any future regression in `cleanup()` will silently break unrelated suites. Consider a one-line README in `__tests__/` or top-of-file note that this setup is global.
**Fix:** None required.

### IN-06: prime-users route comment claims "single-call-site inline" for BLOB_KEY but tests assert the regex shape — invariant relies on tribal knowledge

**File:** `app/api/admin/prime-users/route.ts:35-38` and `route.test.ts:138-140`
**Issue:** The comment says "Inlined literal — see lib/prime-users.ts:29 BLOB_KEY constant" and the test checks `/^shbr-admin\//` and `/prime-users\.json$/` — the duplication is intentional but means a rename in `lib/prime-users.ts` (e.g. blob namespace migration) won't break this route's compile but WILL silently desynchronise the read path from the write path. The test will still pass (regex matches the inlined literal) until someone rewrites both. Recommend exporting `BLOB_KEY` from `lib/prime-users.ts` and importing it here — small change to one line, eliminates the drift.
**Fix:** Export `BLOB_KEY` from `lib/prime-users.ts` and import directly:
```tsx
import { BLOB_KEY } from '@/lib/prime-users';
```
The PATTERNS doc cited option (b) (inline) for a smaller diff; option (a) (export+import) is two lines and removes the foot-gun. Worth reconsidering when next touching either file.

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
