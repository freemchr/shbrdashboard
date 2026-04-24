# Phase 02 — Deferred Items

Items discovered during plan execution that are out of scope for the current task per Rule 3 SCOPE BOUNDARY.

## Pre-existing build failure: missing OPENAI_API_KEY

Surfaced independently by 02-02 and 02-03 — confirmed pre-existing.

- **Where:** `app/api/report-assist/caption/route.ts` (Next page-data collection step)
- **Symptom:** `npm run build` fails at "Collecting page data" with `Missing credentials. Please pass an apiKey, or set the OPENAI_API_KEY environment variable.`
- **Verified pre-existing:** `git stash` + `npm run build` reproduces the same error against base commit `6ce3cc1` before the Phase 2 edits. Cause: the OpenAI client is instantiated at module-load time, which `next build` triggers during static page-data collection. The worktree env doesn't carry `OPENAI_API_KEY`.
- **TypeScript validation passes:** `npx tsc --noEmit` is clean for both `app/api/auth/session/route.ts` (02-02) and `app/api/auth/login/route.ts` (02-03). `npm run build` reports `Compiled successfully` + `Linting and checking validity of types ...` clean before the page-data step fails on the OpenAI module.
- **Suggested fix (separate plan):** lazy-init the OpenAI client (`new OpenAI()` inside the handler, not at module top-level) OR set `OPENAI_API_KEY=dummy` for build-only environments. Add `.env.local.example` documentation OR mark `OPENAI_API_KEY` optional with a runtime guard at the caption route boundary.

## Pre-existing test-file type warnings: `vi.spyOn(globalThis, 'fetch' as never)`

Surfaced by 02-03 — inherited from Wave 0 test scaffolds.

- **Where:** `app/api/auth/login/route.test.ts` (lines 95, 107, 123, 141, 155, 164, 175); `lib/audit.test.ts:117`; likely also `app/api/auth/session/route.test.ts`.
- **Symptom:** `npx tsc --noEmit` reports `TS2339: Property 'mockResolvedValueOnce' does not exist on type 'never'` for each `vi.spyOn(globalThis, 'fetch' as never)` call site.
- **Why deferred:** Authored in Wave 0 (the RED test scaffolds shipped with the chained TS-as-`never` cast pattern). Tests still execute and PASS at runtime — vitest does not run tsc. Rewriting the pattern would be Wave 0 rework.
- **Suggested follow-up:** swap to typed `vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(...)` (no `as never` cast) once a parent agent has the bandwidth to revisit Wave 0 test scaffolds. Functional behaviour is unaffected.
