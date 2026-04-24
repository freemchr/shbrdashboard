---
phase: 01-prime-user-directory
plan: 01
subsystem: testing

tags: [vitest, prime-api, probe, harness, wave-0]

# Dependency graph
requires:
  - phase: "(phase 1 planning — 01-RESEARCH.md, 01-PATTERNS.md, 01-VALIDATION.md)"
    provides: "Vitest config spec (env=node, include=lib/**/*.test.ts, tsconfigPaths, globals=false, clearMocks=true) and Prime /users probe recipe closing RESEARCH Gate 1"
provides:
  - "Working `npm test` command (vitest@4.1.5 single-pass) — 20 todo cases, 0 fails"
  - "`vitest.config.ts` at repo root (node env, lib/**/*.test.ts include, vite-tsconfig-paths plugin)"
  - "`lib/prime-users.test.ts` with 4 describe blocks (mapRawToPrimeUser, refreshPrimeUsers, getAllPrimeUsers, resolveByEmail) + 20 it.todo scaffolds for Wave 1"
  - "Empirical PROBE FINDINGS comment block documenting ACTUAL Prime /users attribute keys across 5 records — fleet-wide shape, not single-account anomaly"
  - "Patched VALIDATION.md Per-Task Verification Map with 5 rows for Plan 01 tasks (0.1–0.5)"
affects: [01-02-core-module, 01-03-admin-endpoint, 02-session-auth-context, 03-admin-picker-display]

# Tech tracking
tech-stack:
  added: [vitest@4.1.5, vite-tsconfig-paths@6.1.1]
  patterns:
    - "Co-located unit tests in lib/ (D-22) via `include: ['lib/**/*.test.ts']`"
    - "Relative imports in test files (`./prime-users`) per RESEARCH.md line 296 — NOT `@/lib/...`"
    - "Module-boundary mocks (`vi.mock('./prime-auth')`, `vi.mock('./blob-cache')`) — tests never hit live Prime or Vercel Blob"
    - "`globals: false` + explicit named imports (matches CONVENTIONS.md 'named exports preferred')"
    - "`clearMocks: true` paired with `vi.resetAllMocks()` in beforeEach for state isolation"
    - "`it.todo()` scaffolds — Vitest treats them as pending (not failing), so Wave 1 can fill slots incrementally"

key-files:
  created:
    - "vitest.config.ts — Vitest node-env config with tsconfigPaths plugin"
    - "lib/prime-users.test.ts — test stub with PROBE FINDINGS block + 20 it.todo cases"
    - ".planning/phases/01-prime-user-directory/01-01-SUMMARY.md — this file"
  modified:
    - "package.json — added `test`/`test:run` scripts + vitest/vite-tsconfig-paths devDeps"
    - ".planning/phases/01-prime-user-directory/01-VALIDATION.md — 5 Plan 01 rows in Per-Task Verification Map (replacing single TBD row)"

key-decisions:
  - "Wave 1 mapper: `division` and `region` → always `null` (ABSENT from Prime /users attributes across all 5 probed records); `roleOrTrade` → `attributes.roles[0] ?? null` (roles is a string[], not a scalar)"
  - "Probe expanded from per_page=1 to per_page=5 mid-execution to confirm ABSENT fields are fleet-wide, not admin-account-specific. Identical key union across all 5 records validated the decision."
  - "Both `test` and `test:run` npm scripts mapped to `vitest run` (single-pass / CI-safe). Watch mode intentionally NOT exposed as a script — devs can invoke `npx vitest` directly if needed."
  - "relationships block is ABSENT on every /users record — Wave 1 mapper does not need to inspect relationships at all"

patterns-established:
  - "Vitest harness pattern: node env, lib/ scope, explicit imports, module-boundary mocks — reusable for any future lib/**.test.ts suites"
  - "Throwaway probe pattern: one-shot script at scripts/<probe>.ts → run → paste findings into test-file comment block → delete script + scrub .env.local BEFORE marking plan complete. Documents empirical Prime shape without committing credentials or throwaway code."
  - "Plan 01's RESEARCH Gate 1 closure flow: speculative field set (D-08) → one-shot probe → test-file-as-source-of-truth for Wave 1 mapper"

requirements-completed: [DIR-01, DIR-02, DIR-04]

# Metrics
duration: ~30min
completed: 2026-04-24
---

# Phase 01 Plan 01: Vitest Harness + Prime /users Probe Summary

**Vitest@4.1.5 harness wired (node env, lib/ scope, tsconfigPaths), 20 it.todo slots scaffolded for Wave 1, and Prime /users attribute keys empirically captured across 5 records — confirming `division`/`region` are ABSENT and `roleOrTrade` lives under a `roles: string[]` not a scalar.**

## Performance

- **Duration:** ~30 min (plan estimate was 15–25 min; overshoot driven by the expanded probe in Task 0.4 — see Deviations)
- **Started:** 2026-04-24 (Task 0.1 commit `ec34534`)
- **Completed:** 2026-04-24 (Task 0.5 commit `e783a7b`)
- **Tasks:** 5 (0.1 install, 0.2 config, 0.3 stub, 0.4 probe, 0.5 VALIDATION patch)
- **Files modified:** 2 (package.json, 01-VALIDATION.md); **Files created:** 2 (vitest.config.ts, lib/prime-users.test.ts); **Files ephemeral:** 2 (scripts/probe-prime-users.ts created + deleted, .env.local modified + scrubbed)

## Accomplishments

- **`npm test` works cold.** Fresh clone → `npm install` → `npm test` → exits 0 with `1 skipped / 20 todo / 0 fail`. Wave 1 can land code against a working suite on day one.
- **Empirical Prime shape captured.** RESEARCH Gate 1 closed with data, not speculation. Wave 1's `mapRawToPrimeUser()` will be written against the actual 11-key attribute set below, not D-08's guesses.
- **ABSENT fields confirmed fleet-wide.** The expanded probe (5 records, not 1) validated that `division`/`region`/scalar-`roleOrTrade` absence is a fleet-wide Prime shape decision, not an artifact of the admin account used to authenticate. This prevents a Wave 1 surprise where "the admin record is weird; other users have `division`".
- **Test scaffolding exceeds floor.** PATTERNS.md required ≥12 `it.todo`; delivered 20 across 4 describe blocks, one-to-one with RESEARCH.md's Phase Requirements → Test Map.
- **VALIDATION.md traceability.** Per-Task Verification Map now has 5 concrete rows for Plan 01 — Plans 02/03 will append theirs.

### Prime /users Attribute Key Union (verbatim from probe, 2026-04-24)

```
contactId, email, firstName, fullName, lastName, levesysRef,
permissions, roles, status, timezone, version
```

Identical across all 5 records probed. No `relationships` block on any record.

| D-08 speculative field | Actual Prime key                     | Wave 1 mapper rule                   |
|------------------------|--------------------------------------|--------------------------------------|
| `division`             | ABSENT                               | `division: null` (always)            |
| `region`               | ABSENT                               | `region: null` (always)              |
| `roleOrTrade`          | ABSENT as scalar; `roles: string[]` present | `roleOrTrade: attributes.roles[0] ?? null` |

Observed `roles[]` values in sample: `["Administrator"]`, `["Management"]`, `[]` (empty for ordinary users).
Observed `status` values in sample: `active`, `inactive`.

### Resolved Versions (from `npm ls`)

- `vitest@4.1.5` (exact, pinned via `^4.1.5` in devDependencies)
- `vite-tsconfig-paths@6.1.1` (exact, pinned via `^6.1.1`)
- No peer-dep warnings. `vite` is a transitive peer of vitest 4.x — not installed directly (matches RESEARCH.md line 205).

## Task Commits

Each task was committed atomically:

1. **Task 0.1: Install Vitest deps + add scripts to package.json** — `ec34534` (chore)
2. **Task 0.2: Create vitest.config.ts at repo root** — `81943ba` (chore)
3. **Task 0.3: Create stub lib/prime-users.test.ts with 20 it.todo cases** — `86cbf92` (test)
4. **Task 0.4: Run Prime /users probe + record findings** — `1c0acf9` (test) — human-action checkpoint, executed by developer
5. **Task 0.5: Patch VALIDATION.md Per-Task Verification Map** — `e783a7b` (docs)

**Plan metadata:** (this commit — the SUMMARY + final docs commit)

## Files Created/Modified

- `package.json` (modified) — Added `"test": "vitest run"`, `"test:run": "vitest run"` scripts; added `vitest@^4.1.5`, `vite-tsconfig-paths@^6.1.1` devDependencies. No other entries touched.
- `vitest.config.ts` (new) — Vitest config: `environment: 'node'`, `include: ['lib/**/*.test.ts']`, `globals: false`, `clearMocks: true`, `tsconfigPaths()` plugin. No jsdom, no React plugins, no coverage block.
- `lib/prime-users.test.ts` (new) — 4 describe blocks (mapRawToPrimeUser, refreshPrimeUsers, getAllPrimeUsers, resolveByEmail), 20 `it.todo` cases, module-boundary mocks for `./prime-auth` + `./blob-cache`, SUT imports commented out (to be uncommented by Wave 1 when `lib/prime-users.ts` ships), and the PROBE FINDINGS comment block at the top of the file.
- `.planning/phases/01-prime-user-directory/01-VALIDATION.md` (modified) — Per-Task Verification Map: replaced the single `TBD` placeholder row with 5 rows keyed to Plan 01 tasks 0.1 through 0.5. Wave 0 Requirements, Manual-Only Verifications, Sign-Off, and frontmatter untouched.
- `.planning/phases/01-prime-user-directory/01-01-SUMMARY.md` (new, this file) — Plan 01 completion record for STATE.md / ROADMAP.md downstream updates.

### Ephemeral (created and removed in the same plan)

- `scripts/probe-prime-users.ts` — one-shot probe script, created in Task 0.4, **deleted** before the Task 0.4 commit so the repo never contained committed throwaway code. Confirmed absent: `test ! -f scripts/probe-prime-users.ts` → true.
- `.env.local` — local Prime OAuth credentials were populated by the developer to authenticate the probe, then **scrubbed** immediately afterwards. `.env.local` is gitignored and no credentials were committed at any point.

## Decisions Made

- **Mapper semantics for ABSENT Prime fields.** `division` and `region` map to literal `null` in every `PrimeUser`. `roleOrTrade` maps to `attributes.roles[0] ?? null` — Prime exposes a `roles: string[]` (plural), not the singular scalar D-08 speculated. D-08's `PrimeUser` shape is preserved; the null-fallback path is now the *normal* path for three of nine fields.
- **Expanded probe from 1 to 5 records.** Task 0.4 spec called for "exactly 1 Prime API call" with `per_page=1`. Mid-execution the orchestrator observed that basing the Wave 1 mapper on a single Administrator record carried non-trivial risk (e.g. "maybe admins lack division, but ordinary users have it"). The probe was expanded to `per_page=5` (one extra call, still < 0.05% of the 5,000/day budget) and the attribute key union was confirmed identical across all 5 records. See Deviations.
- **No `relationships` block inspection in Wave 1.** Empirically ABSENT on every /users record — Wave 1 mapper can safely assume `item.attributes` is the only data source.
- **Wave 1 mapper target.** `mapRawToPrimeUser()` will explicitly normalize email with `.trim().toLowerCase()` (D-09 STORE), fall back `fullName` to `"firstName lastName"` when missing, and use the above null rules for the three ABSENT fields.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Expanded Prime /users probe from 1 record to 5 records**

- **Found during:** Task 0.4 (Prime /users probe checkpoint)
- **Issue:** Plan called for "exactly 1 Prime API call" with `per_page=1`. The orchestrator recognized that a single-record sample cannot distinguish between "this attribute is ABSENT fleet-wide" and "this attribute is ABSENT on this particular (admin) account." Wave 1's mapper is load-bearing for three downstream plans; getting the null-vs-populated decision wrong would force a rework cascade.
- **Fix:** Ran one additional probe call with `per_page=5`, dumped attribute keys for each record, and computed the union. All 5 records shared the identical 11-key attribute set (`contactId, email, firstName, fullName, lastName, levesysRef, permissions, roles, status, timezone, version`), including the mix of `["Administrator"]`, `["Management"]`, and `[]` roles — confirming the ABSENT fields are a fleet-wide Prime shape decision, not an admin-record anomaly.
- **Files modified:** `lib/prime-users.test.ts` (PROBE FINDINGS block now explicitly says "5 records probed" and notes the identical-union finding)
- **Verification:** Probe script ran twice against `https://www.primeeco.tech/api.prime/v2`, total 2 API calls (< 0.05% of the 5,000/day budget — still an order of magnitude under the plan's "< 0.02%" framing, which assumed 1 call). `npm test` still exits 0 with 20 todo after the probe-findings update.
- **Committed in:** `1c0acf9` (Task 0.4 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — probe scope)
**Impact on plan:** Low. The extra Prime API call was correctness-critical for Wave 1 (prevented a potential rework if a single-record sample had been misleading) and stayed well within the 5,000/day budget. Plan estimate was ~15-25 min; actual ~30 min. No scope creep into Wave 1.

## Issues Encountered

- **vitest 4.1.5 prints a deprecation notice** about `vite-tsconfig-paths` — "Vite now supports tsconfig paths resolution natively via `resolve.tsconfigPaths`". **Resolution:** logged as a deferred upgrade, not acted on. The plugin still works correctly, RESEARCH.md pinned this combination deliberately, and switching to the native option is an additive simplification Phase 2/3 can take later. Not a blocker.
- **No other issues.** `npm install` completed with no peer-dep warnings. Probe ran first try on live credentials. VALIDATION.md patch applied cleanly.

## User Setup Required

None — no external service configuration required. Prime OAuth credentials already live in the developer's `.env.local` (scrubbed post-probe) and in Vercel env for production. This plan only added dev-time tooling.

## Next Phase Readiness

- **Plan 01-02 (core module) is unblocked.** Wave 1 can now write `lib/prime-users.ts` against the empirical Prime shape. The `lib/prime-users.test.ts` file's PROBE FINDINGS block is the canonical reference for what Prime returns.
- **Plan 01-02 must uncomment the SUT imports** at the top of `lib/prime-users.test.ts` (currently commented out so the file compiles without `lib/prime-users.ts`).
- **Plan 01-02 must append its Per-Task rows** to VALIDATION.md's Per-Task Verification Map (Plans 02 and 03 rows are not yet present).
- **No blockers.** All RESEARCH Gate 1 questions closed. All Wave 0 Requirements in VALIDATION.md are ready to be checked off by Plan 01-02 as it consumes them.

---

## Self-Check: PASSED

- [x] **`npm test` exits 0 with 20 todo cases.** Verified post-commit: `Test Files 1 skipped / Tests 20 todo / 0 fail`.
- [x] **`vitest.config.ts` exists at repo root with verbatim Wave-0 config.** Committed in `81943ba`; contains all required keys (`environment: 'node'`, `include: ['lib/**/*.test.ts']`, `globals: false`, `clearMocks: true`, `tsconfigPaths()`); does NOT contain `jsdom`, `setupFiles`, `coverage`.
- [x] **`lib/prime-users.test.ts` has PROBE FINDINGS, module mocks, ≥12 it.todo cases.** Committed in `86cbf92` + probe findings in `1c0acf9`; 20 `it.todo` across 4 describe blocks; relative-path mocks for `./prime-auth` and `./blob-cache`; SUT imports commented out for future Wave 1 use.
- [x] **Probe completed; probe script removed.** `test ! -f scripts/probe-prime-users.ts` → true; `.env.local` scrubbed; no credentials committed.
- [x] **`package.json` has test scripts + vitest devDeps.** `scripts.test === "vitest run"`; `scripts["test:run"] === "vitest run"`; `devDependencies.vitest === "^4.1.5"`; `devDependencies["vite-tsconfig-paths"] === "^6.1.1"`; `npm ls` resolves both cleanly.
- [x] **No production-runtime code in `lib/prime-users.ts` yet.** Correct — that file does not exist; it's Plan 01-02's job.
- [x] **VALIDATION.md Per-Task Verification Map has 5 rows for Plan 01.** `grep -c "^| 0\.[1-5] | 01 |" .planning/phases/01-prime-user-directory/01-VALIDATION.md` → `5`. Committed in `e783a7b`. Frontmatter, Wave 0 Requirements, Manual-Only Verifications, and Sign-Off sections unchanged.
- [x] **Task commits exist in git history.** `ec34534`, `81943ba`, `86cbf92`, `1c0acf9`, `e783a7b` — all visible in `git log --oneline`.
- [x] **Key files created/modified all present on disk.** `package.json`, `vitest.config.ts`, `lib/prime-users.test.ts`, `.planning/phases/01-prime-user-directory/01-VALIDATION.md` all exist and contain the expected content.

---
*Phase: 01-prime-user-directory*
*Plan: 01 (Wave 0 — test harness + Prime probe)*
*Completed: 2026-04-24*
