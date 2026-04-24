# Deferred Items — Phase 02

## 02-02 (Plan)

**`npm run build` fails at page-data collection stage with `OPENAI_API_KEY` missing** (pre-existing).

- **Out of scope:** Plan 02-02 only modifies `app/api/auth/session/route.ts`.
- **Verified pre-existing:** `git stash` + `npm run build` reproduces the same error against the base commit (6ce3cc1) before my edit. Cause: `/api/report-assist/caption/route.js` instantiates the OpenAI client at module-load time, which `next build` triggers during static page-data collection. The worktree env doesn't carry `OPENAI_API_KEY`.
- **TypeScript validation passes:** `npm run build` reports `Compiled successfully` + `Linting and checking validity of types ...` clean — the type check that the plan's acceptance criterion targets (against my route.ts edit) is GREEN.
- **Recommended fix (separate plan):** lazy-init the OpenAI client (`new OpenAI()` inside the handler, not at module top-level) OR set `OPENAI_API_KEY=dummy` for build-only environments. NOT addressed by Plan 02-02.
