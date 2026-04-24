# Phase 02 — Deferred Items

Items discovered during plan execution that are out of scope for the current task per Rule 3 SCOPE BOUNDARY.

## From 02-03 (login route resolveByEmail wiring)

### Pre-existing build failure: missing OPENAI_API_KEY

- **Where:** `app/api/report-assist/caption/route.ts` (Next page-data collection step)
- **Symptom:** `npm run build` fails at "Collecting page data" with `Missing credentials. Please pass an apiKey, or set the OPENAI_API_KEY environment variable.`
- **Why deferred:** Pre-existing environment / Vercel-only configuration concern. Not introduced by Plan 02-03 (the login route does not depend on OpenAI). Verified via `git stash + npm run build` is the proper triage but `npx tsc --noEmit` confirms our route.ts has zero TypeScript errors.
- **Suggested follow-up:** add `.env.local.example` documentation OR mark `OPENAI_API_KEY` optional with a runtime guard at the caption route boundary.

### Pre-existing test-file type warnings: `vi.spyOn(globalThis, 'fetch' as never)`

- **Where:** `app/api/auth/login/route.test.ts` (lines 95, 107, 123, 141, 155, 164, 175); `lib/audit.test.ts:117` (and likely the session-route test once landed)
- **Symptom:** `npx tsc --noEmit` reports `TS2339: Property 'mockResolvedValueOnce' does not exist on type 'never'` for each `vi.spyOn(globalThis, 'fetch' as never)` call site.
- **Why deferred:** Authored in Wave 0 (the RED test scaffolds shipped with the chained TS-as-`never` cast pattern). Tests still execute and PASS at runtime — vitest does not run tsc. Plan 02-03 inherits this pattern; rewriting it would be Wave 0 rework.
- **Suggested follow-up:** swap to typed `vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(...)` (no `as never` cast) once a parent agent has the bandwidth to revisit Wave 0 test scaffolds. Functional behaviour is unaffected.
