# Phase 01 — Deferred Items (Out-of-Scope Discoveries)

Items found during plan execution that are pre-existing and unrelated to the
current phase's scope. Do NOT fix here — these are logged for future-milestone
triage.

---

## 1. `npm run build` fails when `OPENAI_API_KEY` is not set in the build shell

**Discovered during:** Plan 01-02 post-implementation `npm run build` check.

**Observation:** `next build` performs static-analysis page-data collection on
`app/api/report-assist/enhance/route.ts`, which instantiates the OpenAI SDK at
module top level. Without `OPENAI_API_KEY` in the build environment, it throws
`Missing credentials` and the whole build aborts.

**Root cause file:** `app/api/report-assist/enhance/route.ts` (introduced in
commit `1e83f0c` — Report Assist feature — months before this milestone).

**Why out-of-scope here:**
- Pre-existing by many commits — not caused by Plan 01-02's
  `lib/prime-users.ts` or test file.
- `npx tsc --noEmit` passes clean; the type layer is healthy.
- Vercel prod builds succeed because the env var is set in Vercel project
  settings — this only affects local `npm run build` when `.env.local`
  doesn't include `OPENAI_API_KEY`.

**Suggested future fix (v2+):** Either (a) lazy-initialize the OpenAI client
inside the route handler so build-time page-data collection doesn't trigger
the constructor, or (b) document `OPENAI_API_KEY` as a required local build
env var in README/CLAUDE.md.

**Evidence that Plan 01-02 code compiles cleanly:**
- `npx tsc --noEmit` exits 0 on the full project.
- `npm test` (Vitest) passes 20/20 — exercises `lib/prime-users.ts` end-to-end
  with mocked boundaries.
