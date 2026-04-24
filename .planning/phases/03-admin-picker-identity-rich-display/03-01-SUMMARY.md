---
phase: 03-admin-picker-identity-rich-display
plan: 01
subsystem: testing
tags: [vitest, jsdom, testing-library, react-testing-library, jest-dom, red-scaffolds, wave-0, test-infra]

# Dependency graph
requires:
  - phase: 01-prime-user-directory
    provides: PrimeUser / PrimeUserDirectoryBlob type contracts; lib/prime-users.test.ts module-boundary mock pattern; getCached() blob-cache API
  - phase: 02-session-auth-context
    provides: app/api/auth/session/route.test.ts module-boundary mock harness; AuthContext / useAuth() consumer convention; TopBar `.trim() ||` cascade pattern
provides:
  - Vitest harness extended to .tsx + JSDOM (per-file directive strategy)
  - jsdom@29.0.2 + @testing-library/react@16.3.2 + @testing-library/jest-dom@6.9.1 dev deps
  - components/ui/PrimeUserPicker.test.tsx — RED scaffold (8 describe blocks, 220 lines) pinning D-04..D-22 + Pitfall 2 + ARIA
  - app/api/admin/prime-users/route.test.ts — RED scaffold (5 describe blocks, 142 lines) pinning D-15 + D-20 + Pitfall 5
  - app/admin/page.test.tsx — RED scaffold (2 describe / 6 it blocks, 190 lines) pinning D-11/D-12/D-13 audit cascade + filter dropdown extension
affects: [03-02-prime-user-picker, 03-03-prime-directory-context-and-route, 03-04-admin-page-cascade]

# Tech tracking
tech-stack:
  added:
    - jsdom@^29.0.2 (Vitest JSDOM provider)
    - "@testing-library/react@^16.3.2 (render/screen/fireEvent/waitFor for React 18)"
    - "@testing-library/jest-dom@^6.9.1 (toBeInTheDocument/toHaveClass/toHaveAttribute matchers)"
  patterns:
    - "Per-file `// @vitest-environment jsdom` directive for opting into DOM tests (default 'node' preserved for speed)"
    - "Module-boundary mocking for context-consuming components (vi.mock('@/lib/prime-directory-context') → vi.mocked(usePrimeDirectory) drives state)"
    - "RED-scaffold-first execution (test files reference unimplemented exports; failure mode is 'Failed to resolve import' — flips GREEN when Wave 1+2 ship the modules)"
    - "React.createElement(React.Fragment, ...) inside vi.mock factories instead of JSX fragment (avoids Vite import-analysis parse rejection of `<>` in hoisted factories)"

key-files:
  created:
    - components/ui/PrimeUserPicker.test.tsx (220 lines, RED — 8 describe blocks, JSDOM env)
    - app/api/admin/prime-users/route.test.ts (142 lines, RED — 5 describe blocks, node env)
    - app/admin/page.test.tsx (190 lines, RED — 2 describe / 6 it blocks, JSDOM env)
  modified:
    - vitest.config.ts (12 → 16 lines; include glob now {ts,tsx} across lib/, app/, components/)
    - package.json (+3 devDeps)
    - package-lock.json (+546 transitive packages locked)

key-decisions:
  - "Per-file `// @vitest-environment jsdom` directive over global config (PATTERNS 'Recommended' choice — keeps node tests at full speed; only the 2 .tsx test files pay the JSDOM startup cost)"
  - "No `setupFiles` / `vitest.setup.ts` — each .tsx test imports `'@testing-library/jest-dom/vitest'` explicitly (PATTERNS recommendation for the small Phase 3 test count)"
  - "PrimeDirectoryProvider mock factory uses React.createElement instead of JSX fragment — Vite import-analysis plugin rejects `<>{children}</>` inside hoisted vi.mock factories even in .tsx files"
  - "All 3 RED files use `vi.resetAllMocks()` in `beforeEach` (PATTERNS canonical pattern from Phase 1 lib/prime-users.test.ts)"

patterns-established:
  - "Wave 0 (test infra) → Wave 1 (implementations) → Wave 2 (admin page edits) execution order — RED scaffolds become the executable Definition of Done for downstream waves"
  - "Locked-string assertions bind tests verbatim to UI-SPEC + RESEARCH (tooltip 'Not in current directory snapshot — refresh to recheck'; aria-label 'Search Prime users'; option label 'Prime miss'; blob namespace /^shbr-admin\\//) — Wave 1+2 cannot pass these tests by accident"
  - "Module-boundary mocking convention: mock the import path the SUT imports from (e.g., '@/lib/prime-directory-context'), NEVER the underlying transitive module — established Phase 1, reapplied verbatim Phase 3"

requirements-completed: []

# Metrics
duration: 14 min
completed: 2026-04-24
---

# Phase 03 Plan 01: Wave 0 Test-Harness Extension + RED Scaffolds Summary

**Vitest harness widened to .tsx + JSDOM (per-file directive strategy) and three RED test scaffolds committed — 15 describe blocks across 552 lines binding the picker, GET endpoint, and AuditTab cascade to UI-SPEC + RESEARCH locked strings before any source code exists.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-04-24T10:25:13Z (worktree base)
- **Completed:** 2026-04-24T10:39:57Z
- **Tasks:** 5/5
- **Files modified:** 5 (2 modified + 3 created)

## Accomplishments

- `vitest.config.ts` widened to discover `.test.tsx` files in `lib/`, `app/`, AND `components/` (Pitfall 7 closed); default `environment: 'node'` preserved
- 3 dev dependencies installed and locked: `jsdom@^29.0.2`, `@testing-library/react@^16.3.2`, `@testing-library/jest-dom@^6.9.1` (zero leakage to production `dependencies`)
- `components/ui/PrimeUserPicker.test.tsx` — 220-line RED scaffold pinning D-22 tri-state loading, D-18 substring filter (3 fields), D-19 keyboard nav, D-04/D-05 chip add/remove + alphabetical, D-07/D-08 historical detection, D-20 empty cache, Pitfall 2 onMouseDown.preventDefault, UI-SPEC ARIA wiring
- `app/api/admin/prime-users/route.test.ts` — 142-line RED scaffold pinning D-15 auth gating (401/403/getCached-not-called), response shape, D-20 cache empty, Pitfall 5 (blob key matches `/^shbr-admin\//`)
- `app/admin/page.test.tsx` — 190-line RED scaffold pinning D-11/D-12 audit cascade (live-hit / live-miss-saved-hit / live-miss-saved-miss / whitespace-trim) + D-13 filter dropdown extension (`prime_user_miss`)
- Phase 1+2 vitest suite still passes: **43/43 tests green, zero regression** from glob widening or dev-dep install

## Task Commits

Each task committed atomically (parallel-executor `--no-verify` per worktree convention):

1. **Task 1: Widen vitest.config.ts** — `64ce3e6` (chore)
2. **Task 2: Install jsdom + @testing-library devDeps** — `67c350b` (chore)
3. **Task 3: RED scaffold for `<PrimeUserPicker>`** — `bc21a04` (test)
4. **Task 4: RED scaffold for GET /api/admin/prime-users** — `d28dfcc` (test)
5. **Task 5: RED scaffold for AuditTab cascade + filter** — `e1c9036` (test)

(Plan-metadata commit will follow this SUMMARY write.)

## Files Created/Modified

**Created:**
- `components/ui/PrimeUserPicker.test.tsx` — RED test scaffold (220 lines, JSDOM env via line-1 directive); 8 describe blocks; locked strings: `'Not in current directory snapshot — refresh to recheck'`, `'Prime directory unavailable.'`, `'Try refreshing.'`, `'Search Prime users'`, `'Refresh Prime directory'`
- `app/api/admin/prime-users/route.test.ts` — RED test scaffold (142 lines, node env); 5 describe blocks; module-boundary mocks for `@/lib/session`, `@/lib/page-visibility`, `@/lib/blob-cache`; blob-key regex `/^shbr-admin\//` and `/prime-users\.json$/`
- `app/admin/page.test.tsx` — RED test scaffold (190 lines, JSDOM env via line-1 directive); 2 describe blocks / 6 it blocks; module-boundary mocks for `@/lib/prime-directory-context`, `@/lib/auth-context`, `next/navigation`; locked option label `'Prime miss'` + value `prime_user_miss`

**Modified:**
- `vitest.config.ts` — `include` glob widened from `['lib/**/*.test.ts', 'app/**/*.test.ts']` to `['lib/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}']`; default `environment: 'node'` preserved; no `setupFiles` / `environmentMatchGlobs` (per-file directive strategy)
- `package.json` — added `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` to `devDependencies`; production `dependencies` block unchanged (verified zero leakage)
- `package-lock.json` — 546 transitive packages locked (npm install ran in worktree, NOT main, so worktree branch carries the lockfile delta cleanly)

## Decisions Made

- **Per-file `// @vitest-environment jsdom` directive over `environmentMatchGlobs`** — PATTERNS.md "Recommended" choice. Default `environment: 'node'` is preserved; only the 2 `.tsx` test files pay the JSDOM startup cost (Phase 1+2 node tests stay at ~7s for 43 tests). Lower blast radius and explicit per-file opt-in.
- **No `setupFiles` / `vitest.setup.ts`** — each `.tsx` test imports `'@testing-library/jest-dom/vitest'` directly. PATTERNS.md "Recommend per-file for explicitness given the small number of `.tsx` tests." Avoids a phantom global side-effect file.
- **`React.createElement(React.Fragment, null, children)` instead of `<>{children}</>` inside `vi.mock` factories** — discovered during Task 5 RED-state verification (see Deviations). This keeps the JSX-free factory body parseable by Vite's import-analysis plugin, which rejects fragment syntax inside hoisted mock factories even in `.tsx` files.
- **All RED scaffolds use `vi.resetAllMocks()` in `beforeEach`** — canonical Phase 1 `lib/prime-users.test.ts` and Phase 2 `app/api/auth/session/route.test.ts` pattern. Consistent across the codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Vite import-analysis plugin rejects JSX fragment inside `vi.mock` factory**
- **Found during:** Task 5 RED-state verification
- **Issue:** Initial `app/admin/page.test.tsx` followed PLAN.md verbatim with `PrimeDirectoryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>`. Vitest run failed with `Failed to parse source for import analysis because the content contains invalid JS syntax. ... `<>{children}</>``. This violated Task 5 acceptance criterion: *"the failure mode is 'Cannot find module @/lib/prime-directory-context' or AdminPage source resolution issue — NOT a parse/syntax error."*
- **Root cause:** Vite's `vite:import-analysis` plugin parses `vi.mock` factory bodies in a stricter mode than top-level JSX; the JSX-fragment shorthand `<>` (without a leading React import or namespace) is rejected even with a `.tsx` extension. Identical-shape inline arrows with named JSX components (e.g., `<PrimeUserPicker ...>` in Task 3) parse fine — fragment shorthand is the specific trigger.
- **Fix:** Added `import * as React from 'react'` (already needed for the `React.ReactNode` type reference at line 14) and changed the factory return to `React.createElement(React.Fragment, null, children)`. Equivalent runtime behavior; eliminates parser ambiguity.
- **Files modified:** `app/admin/page.test.tsx` (lines 3 + 12-16)
- **Verification:** `npx vitest run app/admin/page.test.tsx` now fails with `Failed to resolve import "@/lib/prime-directory-context"` — the intended RED state per acceptance criterion.
- **Committed in:** `e1c9036` (Task 5 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Fix was necessary for Task 5's acceptance criterion to be satisfied (RED via import resolution, not parse error). No scope creep — same test surface, equivalent factory semantics, +1 import line, +3 line factory body. PLAN.md prose suggested the JSX shorthand but didn't constrain it.

## Issues Encountered

- **Worktree base mismatch on startup:** `git merge-base HEAD <expected>` reported worktree base at `27450e9` instead of expected `3466d72`. Hard-reset to expected base per `<worktree_branch_check>` protocol; verified `HEAD === 3466d72` before proceeding. No work lost (was a stale worktree pointer, not divergent commits).
- **`npm install` ran for ~2 minutes** — slower than typical due to 546 transitive packages (jsdom pulls a deep tree: cssstyle, parse5, whatwg-encoding, etc.). Within budget; no timeout. 7 audit warnings reported (1 moderate, 6 high) — all in transitive devDeps, not production-runtime; out of scope per CLAUDE.md "edit existing patterns" guidance and the plan's "no production runtime impact" invariant.

## Next Phase Readiness

**Ready for Wave 1 (parallel execution — Plans 02 + 03 are file-disjoint):**

- **Plan 02 (`<PrimeUserPicker>` component)** — flips `components/ui/PrimeUserPicker.test.tsx` GREEN by creating `components/ui/PrimeUserPicker.tsx`. Test currently fails at `import { PrimeUserPicker } from './PrimeUserPicker'` resolution (verified). Implementation must satisfy 8 describe blocks; locked strings bind verbatim to UI-SPEC.
- **Plan 03 (Provider + GET endpoint)** — flips `app/api/admin/prime-users/route.test.ts` GREEN by creating `app/api/admin/prime-users/route.ts` (5 describe blocks; blob key namespace asserted). Also creates `lib/prime-directory-context.tsx` which `PrimeUserPicker.test.tsx` and `app/admin/page.test.tsx` mock. Test currently fails at `import { GET } from './route'` and `Failed to resolve import "@/lib/prime-directory-context"`.

**Wave 2 (sequential after Wave 1) — Plan 04 (`app/admin/page.tsx` modifications):**
- Flips `app/admin/page.test.tsx` GREEN once `lib/prime-directory-context.tsx` exists AND the AuditTab cascade + filter dropdown are wired into `app/admin/page.tsx` per UI-SPEC Surface 12 + 13.

**No blockers.** Vitest harness is complete: any future Phase 3 RED file can drop in with `// @vitest-environment jsdom` (for DOM tests) or no directive (for node/route tests). The 43-test Phase 1+2 baseline still passes — guaranteeing no harness widening regression.

## Self-Check: PASSED

**Files claimed as created — all verified present in worktree:**
- `components/ui/PrimeUserPicker.test.tsx` — FOUND (220 lines, md5 3071816e5da1732cc226d29c21205747)
- `app/api/admin/prime-users/route.test.ts` — FOUND (142 lines, md5 62c8f331dfb38a15cf4581944f89e694)
- `app/admin/page.test.tsx` — FOUND (190 lines, md5 efa5feb1edcc606a234e1cbe982bcb2c)

**Files claimed as modified — all verified present + diffed:**
- `vitest.config.ts` — FOUND (16 lines; `lib/`, `app/`, `components/` globs present; `environment: 'node'` preserved)
- `package.json` — FOUND (3 new devDeps; zero leakage to dependencies block)
- `package-lock.json` — FOUND (modified, +651 lines)

**All 5 commit hashes verified in `git log`:**
- `64ce3e6` chore(03-01): widen vitest include glob — FOUND
- `67c350b` chore(03-01): install jsdom + RTL devDeps — FOUND
- `bc21a04` test(03-01): RED scaffold PrimeUserPicker — FOUND
- `d28dfcc` test(03-01): RED scaffold GET prime-users — FOUND
- `e1c9036` test(03-01): RED scaffold AuditTab — FOUND

**Verification claim audit:**
- Phase 1+2 suite passes 43/43 — verified via `npx vitest run lib/ app/api/auth/` (4 files passed, 43 tests passed, 0 failed)
- All 3 RED files fail with intended import-resolution error — verified per-file via `npx vitest run`

---
*Phase: 03-admin-picker-identity-rich-display*
*Plan: 01*
*Completed: 2026-04-24*
