---
phase: 02-session-auth-context
plan: 04
subsystem: ui
tags: [auth, ui, topbar, react-context, audit-display, identity-label]

# Dependency graph
requires:
  - phase: 01-prime-user-directory
    provides: PrimeUser type (type-only import into client bundle, blob-cache stripped at build)
  - phase: 02-session-auth-context (Wave 1 — Plan 02-02)
    provides: /api/auth/session response carries `primeUser: PrimeUser | null` per D-07
  - phase: 02-session-auth-context (Wave 1 — Plan 02-03)
    provides: Login route writes 'prime_user_miss' audit rows that this plan's ActionBadge now renders
provides:
  - AuthContext extended with `primeUser: PrimeUser | null` at all three Pitfall-4 touchpoints (interface, createContext default, AuthGuard useState default)
  - AuthGuard hydrates AuthContext.primeUser from `data.primeUser ?? null` (defensive coercion against partial-deploy)
  - Single-fetch-site invariant (D-09) preserved — TopBar reads identity from AuthContext synchronously, no /api/auth/session second call introduced
  - TopBar renders Prime fullName with email fallback per D-10 cascade `primeUser?.fullName?.trim() || userEmail`
  - UI-SPEC binding fully applied — `text-gray-300 max-w-[200px] truncate`, leftmost slot before weather, no icon, no tooltip, no division/region/role
  - ActionBadge renders amber "Miss" badge for `prime_user_miss` audit rows (Pitfall 3 closed)
affects:
  - "03 (Admin Picker & Identity-Rich Display) — picker / group rows / audit-actor display can now consume `useAuth().primeUser` without further plumbing (D-12)"
  - "Future identity-aware client surfaces — AuthContext is the canonical client identity contract"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Type-only import for client-bundle safety — `import type { PrimeUser } from '@/lib/prime-users'` erases at build, keeping `@/lib/blob-cache` and other server-only deps out of the browser bundle (T-02-Bundle mitigation)"
    - "Three-touchpoint additive AuthContext widening — interface + createContext default + AuthGuard useState default updated atomically to prevent Pitfall 4 default-state drift; existing `<AuthProvider value={authCtx}>` wrappers untouched (no signature edit)"
    - "Defensive ?? null coercion at the AuthContext hydration boundary — guards against the partial-deploy window where the session route may transiently omit `primeUser`"
    - "Whitespace-defensive D-10 cascade — `primeUser?.fullName?.trim() || userEmail` treats whitespace-only Prime names as missing per Pitfall 5; one-liner per CONTEXT.md, no helper extracted"
    - "UI-SPEC class-string binding — exact `max-w-[200px] truncate text-gray-300` enforced via grep acceptance criterion; brand red explicitly disallowed on the identity label (UI-SPEC §Color)"

key-files:
  created:
    - .planning/phases/02-session-auth-context/02-04-SUMMARY.md
  modified:
    - lib/auth-context.tsx (+5 lines: 1 type-only import, 1 interface field, 1 createContext default field; 32→35 lines)
    - components/ui/AuthGuard.tsx (+2 lines: 1 useState default field, 1 setAuthCtx hydration field; 113→114 lines net incl. comments)
    - components/ui/TopBar.tsx (+13 lines: 1 import, 4 lines of destructure+derive+comment, 8 lines JSX block; 115→128 lines)
    - app/admin/page.tsx (+3 lines: third ActionBadge branch for `prime_user_miss`; 5-line block to 8-line block)

key-decisions:
  - "Type-only PrimeUser import in `lib/auth-context.tsx` — uses `import type` so TypeScript erases the binding at build, preventing `@/lib/prime-users.ts` (which transitively imports `@/lib/blob-cache`, a server-only module) from ending up in the client bundle. T-02-Bundle threat mitigated and asserted via grep `resolveByEmail` count = 0 in client modules."
  - "Defensive `?? null` in AuthGuard's setAuthCtx — even though Plan 02 always returns `primeUser` (PrimeUser | null), the coercion guards a partial-deploy window where browsers cached against the old shape briefly fetch from a new server (or vice versa). Costs nothing; eliminates a class of `undefined` bugs."
  - "Identity label is leftmost in the flex row, NOT after the weather widget — UI-SPEC §Component Inventory binding. The existing weather divider sits BETWEEN weather and clock; identity needs no own divider per UI-SPEC §Spacing."
  - "ActionBadge fix shipped in same plan as the rest of Wave 2 — 5-line edit, prevents Plan 03's `prime_user_miss` audit rows from rendering as misleading 'Logout' badges. Planner judgement per RESEARCH Pitfall 3."
  - "No new fetch site, no new useState/useEffect for identity in TopBar — value flows through AuthContext synchronously from AuthGuard's existing fetch. D-09 single-fetch-site invariant preserved (asserted via grep `fetch(` = 1 in TopBar, only the existing weather call)."

patterns-established:
  - "Pattern: Three-touchpoint AuthContext widening — adding any field to AuthContext requires updating (1) the interface in lib/auth-context.tsx, (2) the createContext default in the same file, (3) the useState default in components/ui/AuthGuard.tsx — and (4) the post-fetch setAuthCtx hydration with a `?? null` defensive coercion. Acceptance criteria assert all four explicitly."
  - "Pattern: Single-fetch-site identity propagation — /api/auth/session is the sole identity delivery channel; consumers (TopBar, Sidebar, admin pages) read via `useAuth()` synchronously. Adding a new identity-aware UI surface should NEVER introduce a second fetch."
  - "Pattern: UI-SPEC class-string binding via grep — visual contracts (color, max-width, truncate) are enforced as exact-match grep acceptance criteria, not as 'looks right'. Survives refactors and prevents accidental brand-red drift."

requirements-completed: [SESSION-04, DISPLAY-04]

# Metrics
duration: ~9 min
completed: 2026-04-24
---

# Phase 02 Plan 04: AuthContext + TopBar Identity Wiring Summary

**Threaded `primeUser` through `lib/auth-context.tsx` → `components/ui/AuthGuard.tsx` → `components/ui/TopBar.tsx` (leftmost slot, `text-gray-300 max-w-[200px] truncate`, D-10 fallback cascade) and added an amber "Miss" badge for `prime_user_miss` audit rows in `app/admin/page.tsx` — closes SESSION-04 and DISPLAY-04 plumbing in 4 modified files / ~23 net lines.**

## Performance

- **Duration:** ~9 min (500 s)
- **Started:** 2026-04-24T05:07:39Z
- **Completed:** 2026-04-24T05:15:59Z
- **Tasks:** 3 of 4 implementation tasks; Task 4 is human-verify checkpoint (this SUMMARY ships the plumbing; manual smoke owned by orchestrator)
- **Files modified:** 4

## Accomplishments

- AuthContext extended with `primeUser: PrimeUser | null` at all three Pitfall-4 touchpoints (interface + createContext default + AuthGuard useState) plus the setAuthCtx hydration with `?? null` defensive coercion. Type-only `PrimeUser` import keeps the client bundle free of `@/lib/blob-cache` (T-02-Bundle mitigation, asserted via grep).
- TopBar renders the identity label as the leftmost slot in its existing `flex items-center gap-4` row using the exact UI-SPEC class string `max-w-[200px] truncate text-gray-300`. D-10 cascade `primeUser?.fullName?.trim() || userEmail` is whitespace-defensive (Pitfall 5). No icon, no tooltip, no division/region/role rendering.
- Single-fetch-site invariant (D-09) preserved — TopBar adds zero new fetch sites; identity flows through AuthContext synchronously from AuthGuard's existing `/api/auth/session` call.
- ActionBadge in `app/admin/page.tsx` now renders an amber "Miss" badge for `prime_user_miss` audit rows (RESEARCH Pitfall 3 closed) — same `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium` shell as the other branches; only the color triplet differs.

## Task Commits

Each task was committed atomically with `--no-verify` (worktree convention from parallel-execution context):

1. **Task 1: Extend AuthContext interface + createContext default + AuthGuard hydration** — `f10ec6a` (feat)
2. **Task 2: Add TopBar identity label per UI-SPEC** — `f4cb141` (feat)
3. **Task 3: Add ActionBadge third branch for `prime_user_miss`** — `8cd9017` (feat)
4. **Task 4: Human-verify SESSION-04 + DISPLAY-04 surfaces in browser** — checkpoint pending; orchestrator-managed (Wave-2 worktree returns the standard checkpoint structure; orchestrator handles auto-approval and ships the SUMMARY commit on merge)

**Plan metadata:** Pending — orchestrator owns the final docs commit on worktree merge.

## Files Created/Modified

- `lib/auth-context.tsx` — type-only `import type { PrimeUser } from '@/lib/prime-users'`; `AuthContext` interface gains 5th field `primeUser: PrimeUser | null`; createContext default gains `primeUser: null`. `AuthProvider` and `useAuth` exports unchanged.
- `components/ui/AuthGuard.tsx` — initial `useState<AuthContext>({...})` default gains `primeUser: null`; post-fetch `setAuthCtx({...})` gains `primeUser: data.primeUser ?? null`. The `fetch('/api/auth/session')` call is unchanged (single-fetch-site invariant). Both `<AuthProvider value={authCtx}>` wrappers (kiosk + full-shell) untouched.
- `components/ui/TopBar.tsx` — `import { useAuth } from '@/lib/auth-context'`; inside `TopBar()` destructure `{ primeUser, userEmail }` and derive `displayName = primeUser?.fullName?.trim() || userEmail`; render identity `<div className="max-w-[200px] truncate text-gray-300">{displayName}</div>` as the LEFTMOST child of the existing flex row, before the weather block. No new state/effect/fetch.
- `app/admin/page.tsx` — `ActionBadge` gains a third branch for `action === 'prime_user_miss'` rendering amber styling (`bg-amber-900/50 text-amber-400 border border-amber-800`) labelled "Miss". Placed between the existing 'login' and gray-fallback branches. CSV export, audit-tab filter, and other call sites untouched.

## Decisions Made

- Type-only `import type` for `PrimeUser` in `lib/auth-context.tsx` — TypeScript erases at build so `@/lib/prime-users` (transitively `@/lib/blob-cache`) does NOT enter the client bundle. T-02-Bundle threat mitigated; asserted via grep `resolveByEmail` count = 0 in `lib/auth-context.tsx`, `components/ui/AuthGuard.tsx`, and `components/ui/TopBar.tsx`.
- Defensive `?? null` coercion in AuthGuard's `setAuthCtx` even though Plan 02's session route always returns `primeUser: PrimeUser | null` — guards the partial-deploy window where browser-cached old client meets new server (or vice versa). Cost-free, eliminates an `undefined` class of bugs.
- Identity label is the leftmost slot in TopBar's flex row (NOT after weather) per UI-SPEC §Component Inventory + §Implementation Reference. No own divider needed — UI-SPEC §Spacing rules say the existing parent `gap-4` provides sufficient separation; the existing weather divider sits between weather and clock.
- Pitfall 3 fix (ActionBadge `prime_user_miss` branch) shipped in this plan rather than deferred to Phase 3 — 5-line edit that prevents Plan 03's new audit rows from rendering as misleading "Logout" badges from the moment they appear. Planner judgement per RESEARCH.
- No new fetch site, no new useState/useEffect for identity in TopBar — value flows through AuthContext synchronously from AuthGuard's existing fetch (D-09). Asserted via grep `fetch(` count = 1 in TopBar (the pre-existing weather fetch only).

## Deviations from Plan

None — plan executed exactly as written. All three implementation tasks shipped the prescribed edits to the exact files in the prescribed shape; every acceptance grep criterion passed without auto-fix.

## Issues Encountered

- **`npm run build` fails on `/api/report-assist/caption/route.ts` due to missing `OPENAI_API_KEY` env var.** Pre-existing environment-config concern, already documented in `deferred-items.md` by Plan 02-03. The TypeScript validity check (`npx tsc --noEmit` excluding the documented Wave-0 test scaffolds) passes cleanly for all four files modified by this plan. Build result is unchanged from prior plans in this phase — not an issue introduced by 02-04.
- **`npx tsc --noEmit` reports 8 pre-existing errors in `app/api/auth/login/route.test.ts` and `lib/audit.test.ts`** (Wave-0 `vi.spyOn(globalThis, 'fetch' as never)` pattern). Already in `deferred-items.md`. None of the errors touch this plan's modified files.
- **`PreToolUse:Edit` hook reminders fired several times** asking for re-Read before editing. Each affected file had been Read earlier in this session (verified by checking conversation context) and each Edit succeeded on first attempt — verified by Read-after-Edit confirming the change landed. No actual editor failures; reminders are advisory.

## Self-Check: PASSED

**Created files exist:**
- `.planning/phases/02-session-auth-context/02-04-SUMMARY.md` — FOUND (this file)

**Modified files contain expected diffs:**
- `lib/auth-context.tsx` — `import type { PrimeUser } from '@/lib/prime-users'` FOUND; `primeUser: PrimeUser | null;` FOUND; `primeUser: null,` FOUND
- `components/ui/AuthGuard.tsx` — `primeUser: null,` FOUND (initial useState); `primeUser: data.primeUser ?? null,` FOUND (setAuthCtx); `fetch('/api/auth/session')` count = 1 FOUND
- `components/ui/TopBar.tsx` — `import { useAuth } from '@/lib/auth-context'` FOUND; `const { primeUser, userEmail } = useAuth();` FOUND; `primeUser?.fullName?.trim() || userEmail` FOUND; `max-w-[200px] truncate text-gray-300` FOUND; `text-red-` count = 0 FOUND; `title=` count = 0 FOUND; `resolveByEmail` count = 0 FOUND; identity-label JSX positionally before weather (line 102 < line 109) FOUND
- `app/admin/page.tsx` — `action === 'prime_user_miss'` FOUND; `bg-amber-900/50 text-amber-400 border border-amber-800` FOUND; `>Miss<` FOUND; ordering login (509) < prime_user_miss (512) < Logout fallback (515) FOUND

**Commits exist:**
- `f10ec6a` (Task 1: AuthContext + AuthGuard plumbing) — FOUND in `git log`
- `f4cb141` (Task 2: TopBar identity label) — FOUND in `git log`
- `8cd9017` (Task 3: ActionBadge prime_user_miss branch) — FOUND in `git log`

## Manual Smoke Results

**Status:** PENDING — Task 4 is a `checkpoint:human-verify` returned to the orchestrator. Per the parallel-execution prompt, the worktree does NOT auto-approve internally; it returns the standard checkpoint structure so the orchestrator can manage the gate (auto-approve under `_auto_chain_active` / `auto_advance` semantics, or surface to the human if neither flag is set).

**Verification surface enumerated (for the orchestrator / human verifier):**

1. **SESSION-04 — AuthContext carries primeUser**
   - Log in with a Prime-resolved account (e.g., `chris.freeman@techgurus.com.au`).
   - Chrome DevTools → React DevTools → find `<AuthProvider>` (rendered by `components/ui/AuthGuard.tsx`); inspect `value` prop. Expected: `value.primeUser` is a populated PrimeUser object (id, email, fullName, status, …), NOT null.
   - Network tab: exactly ONE `/api/auth/session` request fires after login. No second `/api/auth/prime-user` or duplicate session call (single-fetch-site invariant per D-09).
   - Inspect the `/api/auth/session` response body: `primeUser` field present alongside `userName`, `userEmail`, `expiresAt`, `isAdmin`, `hiddenPaths`.

2. **DISPLAY-04 — TopBar renders Prime display name**
   - On the same login, TopBar shows the Prime fullName (e.g., `Chris Freeman`) as the LEFTMOST slot, BEFORE the weather widget.
   - Visual: `text-gray-300` (#D1D5DB) — neutral muted gray, NOT brand red, NOT pure white.
   - Hover: NO tooltip (UI-SPEC Accessibility — `truncate` keeps full string in DOM for screen readers without a `title` attribute).
   - Resize narrow (<400px): identity label remains visible; weather description hides as before.

3. **DISPLAY-04 fallback — non-Prime email**
   - Log in with an account whose email is NOT in the SHBR Prime user directory (or temporarily wipe the directory blob to force `cache_empty`).
   - Expected: TopBar shows the email address verbatim as the leftmost slot.
   - React DevTools: `value.primeUser` is `null`.

4. **Pitfall 3 fix — audit Miss badge**
   - As an admin, /admin → Audit tab.
   - Any `prime_user_miss` row from step 3 above renders with an amber badge labelled "Miss" (NOT a gray "Logout" badge).
   - If no miss rows exist yet, defer this verification to the next admin-account smoke.

5. **No console errors during navigation**
   - DevTools Console while navigating. Expected: no errors mentioning `primeUser`, `useAuth`, `resolveByEmail`, or `[session]` (the `[session]` prefix is server-only).

6. **Single-fetch-site invariant**
   - Refresh the dashboard. Expected: only ONE `/api/auth/session` request per page mount.

## Next Phase Readiness

- **Phase 3 (Admin Picker & Identity-Rich Display) is unblocked at the AuthContext layer.** Picker / group rows / audit-actor display can read `useAuth().primeUser` synchronously without further plumbing (D-12 — primeUser is exposed everywhere even though only TopBar renders it in Phase 2).
- **Live-read Prime identity is the canonical client identity contract** — any new client surface needing identity should destructure from `useAuth()`, never re-fetch `/api/auth/session`, never import `resolveByEmail` (server-only).
- **No deferred work added for Phase 3.** All Wave 2 obligations from CONTEXT.md (D-08, D-09, D-10, D-11, D-13) are satisfied. The Pitfall 3 ActionBadge fix is shipped — Phase 3's DISPLAY-03 (audit-actor display) only needs to render the rich identity columns; the badge styling is already correct.
- **Pre-existing concerns carried forward (NOT introduced by 02-04):** `OPENAI_API_KEY` build failure and Wave-0 test-scaffold tsc errors remain documented in `deferred-items.md`.

---
*Phase: 02-session-auth-context*
*Plan: 04*
*Completed: 2026-04-24*
