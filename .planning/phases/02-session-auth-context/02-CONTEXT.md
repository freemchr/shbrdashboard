# Phase 2: Session & Auth Context Integration - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Thread Prime identity (`fullName`, `division`, `region`, `roleOrTrade`, plus `id` and `status`) through the session layer so any server or client surface that asks "who is this user?" gets a Prime-sourced answer — not just their email. Three specific touchpoints:

1. Login route (`app/api/auth/login/route.ts`) — resolves the authenticated email against the Phase 1 directory exactly once and writes an audit entry if the user isn't in Prime.
2. Session API (`app/api/auth/session/route.ts`) — returns a fresh `primeUser` (or null) on every call by calling `resolveByEmail()` live from the Phase 1 cached blob.
3. AuthContext + TopBar — AuthContext exposes `primeUser` to client components; TopBar becomes the first surface to render Prime display name (today TopBar has no identity display at all — it's clock + weather only).

In-scope requirements: **SESSION-01, SESSION-02, SESSION-03, SESSION-04, DISPLAY-04**.

Out of scope, explicitly deferred to Phase 3:
- Admin picker UI (`ADMIN-01..05`)
- Group/admin list identity rendering (`DISPLAY-01..02`)
- Audit-log actor display (`DISPLAY-03`)

</domain>

<decisions>
## Implementation Decisions

### Attribute freshness & storage shape

- **D-01:** **Prime attributes are derived at session-check time via `resolveByEmail()`, not stored in the iron-session cookie.** `/api/auth/session` calls `resolveByEmail(session.userEmail)` on every request and returns the result. Cost: one extra blob read per session check — but this route already reads the visibility config blob, so the shape/cost is symmetric. Benefit: zero staleness within the Phase 1 cache's own (admin-controlled) staleness window, no cookie bloat, no 8h-stale display name if an admin updates a Prime record mid-session.
- **D-02:** **REQUIREMENT AMENDMENT — SESSION-01 and ROADMAP Phase 2 SC #1 are updated** to replace "stored in the iron-session cookie" with "derived at session-check time via `resolveByEmail()` and exposed through `/api/auth/session`". This phase-gathering deliberately reconciles the locked text with the chosen implementation; the amendment is committed alongside this CONTEXT.md so downstream research/planning/verification see the updated text as authoritative.
- **D-03:** **`SessionData` is not extended with Prime fields.** The iron-session cookie keeps its current shape (`accessToken, refreshToken, expiresAt, userName, userEmail`). In-flight 8h cookies from pre-deploy users are fully forward-compatible — they already have `userEmail`, which is all the session-check path needs to derive Prime attrs live.

### Login-time resolution + audit log

- **D-04:** **Login calls `resolveByEmail()` exactly once** (after successful Prime OAuth + email normalisation) for the **sole purpose of writing the audit-log entry** on a miss. The resolved `PrimeUser` is NOT stored in the cookie (per D-01/D-03). Session-check-time continues to call `resolveByEmail()` for delivery freshness. First-miss bootstrap (Phase 1 D-03) — acceptable: login is a reasonable trigger for the first Prime fetch on a fresh deploy.
- **D-05:** **`/api/auth/session` does NOT write audit entries** for unresolved users — only login does. This avoids log spam (session is polled per page navigation). If a user is unresolved at login, one audit entry fires; session checks silently return `primeUser: null` forever after.
- **D-06:** **New audit event type `PRIME_USER_MISS`** added to `lib/audit.ts`. Entry shape matches existing audit rows (timestamp, actor email, event type, optional detail). Detail field records cache state at login: `"cache_hit: no match"` vs `"cache_empty"` (distinguishes a real miss from a Phase 1 cache-down per D-16) — so an admin reviewing the log can tell "Jane isn't in Prime" apart from "Prime was unreachable when Jane logged in". Event is surfaced through whatever admin UI reads `lib/audit.ts` today.

### API response + AuthContext shape

- **D-07:** **`/api/auth/session` response is extended** with a nested `primeUser: PrimeUser | null` field, placed alongside the existing `userName`, `userEmail`, `expiresAt`, `isAdmin`, `hiddenPaths`. The `PrimeUser` type is imported from `lib/prime-users.ts` (Phase 1) verbatim — no Phase-2-only variant.
- **D-08:** **`AuthContext` (`lib/auth-context.tsx`) is extended** with `primeUser: PrimeUser | null`. The provider receives the value from the root layout's session fetch and passes it through unchanged. Existing consumers (`isAdmin`, `hiddenPaths`) are untouched; `primeUser` is additive.
- **D-09:** **Root layout / session provider plumbing** — wherever the AuthContext provider is currently wired, Phase 2 threads `primeUser` through the same path. No new fetch calls added; the existing session fetch is extended to carry the new field. Researcher should identify the exact file in the RSC tree that calls `/api/auth/session` or equivalent.

### Display name fallback + TopBar surface

- **D-10:** **Display-name fallback cascade is defensive:** `primeUser?.fullName?.trim() || session.userEmail`. Treats empty / whitespace-only Prime strings as missing (cheap guardrail against Prime data quirks — probe showed fullName always populated, but defensive `.trim()` is free insurance). The cascade is a one-liner; no utility function needed.
- **D-11:** **TopBar adds a compact user-identity surface** where there is none today. Current TopBar is clock + weather only. Phase 2 introduces the first user-identity render — a minimal text label (name with email fallback), visual/positional details left to planner per existing TopBar visual conventions. No avatar, no admin badge (Sidebar already implies admin via the "Admin" nav item).
- **D-12:** **Phase 2 renders user-identity in TopBar only.** AuthContext exposes `primeUser` so Phase 3 components (picker, group rows, audit-log actor) can consume it without additional plumbing — but Phase 2 does NOT build those surfaces. Tight scope prevents Phase 2 from bleeding into DISPLAY-01/02/03 and ADMIN-01..05 territory.
- **D-13:** **Division, region, role/trade are NOT rendered in Phase 2 UI.** Probe confirmed these are always `null` in the current SHBR tenant — any UI that shows them would be dead code. AuthContext still carries them (so Phase 3 can decide what to do if the tenant ever populates them), but no TopBar / login-page / etc. surface references them.

### Test strategy

- **D-14:** **Continue the Vitest harness from Phase 1.** New test files follow the co-located `*.test.ts` pattern. Test targets:
  - `app/api/auth/login/route.ts` — calls `resolveByEmail` with normalised email; writes `PRIME_USER_MISS` audit entry on null result; distinguishes cache-empty from match-miss in detail field.
  - `app/api/auth/session/route.ts` — returns `primeUser` from `resolveByEmail`; returns `primeUser: null` when resolveByEmail returns null; does NOT write audit entries on miss (spam guard).
  - `lib/audit.ts` — new `PRIME_USER_MISS` event type serialises correctly.
- **D-15:** **No integration tests for AuthContext/TopBar in this phase** (Phase 1 D-21 stands: no browser/RSC test harness this milestone). AuthContext plumbing is covered at the API response level (D-14); TopBar rendering is covered by manual smoke (same model as Phase 1's deferred Task 2.2).
- **D-16:** **Contract tests first, implementation second** — for the two API route handlers, write the Vitest cases before the handler changes (matches Phase 1 plan 01-02 ordering: test scaffold first, fill in implementation, tests go green).

### Operational / observability

- **D-17:** **`[session]` log prefix** — any `console.error` or `console.warn` emitted from the session route or login route for Phase-2-specific reasons uses the `[session]` prefix (follows Phase 1 D-18 convention). Audit log entries are the structured channel for admin-reviewable misses; console is for runtime errors.
- **D-18:** **No per-request `resolveByEmail` failure logging.** If the blob-cache read throws (Prime cache unreachable), the session route returns `primeUser: null` silently — same fallback as a match-miss. Phase 1's `[prime-users]` module already owns cache-error logging; Phase 2 doesn't double-log.
- **D-19:** **No telemetry on Prime attr churn.** If Phase 1's admin refresh changes a user's display name mid-session, the next `/api/auth/session` call silently returns the new value. No event, no notification — by design.

### Scope guardrails

- **D-20:** **No changes to Prime OAuth flow, cookie TTL, or session destroy behavior.** Phase 2 is strictly additive: adds one `resolveByEmail` call to login, adds one `resolveByEmail` call to session, adds a field to the session response, adds a field to AuthContext, adds an identity surface to TopBar. Everything else in the auth stack stays as-is.
- **D-21:** **No iron-session cookie shape migration.** D-03 locks this — the cookie is unchanged, so there's nothing to migrate.
- **D-22:** **No `/api/auth/logout` changes.** Phase 2 doesn't touch logout — the session destroy behavior is untouched.

</decisions>

<deferred>
## Deferred Ideas (Surfaced but Out-of-Scope)

- **Division / region / role rendering anywhere in the UI** — Probe showed these are always null in this tenant. AuthContext carries them (future-proofing), but no current surface renders them. If Prime tenant ever populates them, Phase 3 picker is the natural first consumer.
- **Eagerly pre-build Phase 3 scaffolding** — Rejected. Phase 3 plans will cover picker, group rows, audit-log actor display cleanly on their own.
- **Per-request audit log on session check misses** — Rejected as spam; login-time miss log is sufficient.
- **Session cookie schema evolution** — Not needed. Live-read via blob keeps cookie shape stable.
- **Telemetry on Prime attr change mid-session** — Not worth the complexity; silent refresh is the desired behavior.
- **Cache for `resolveByEmail` results at the session-route layer** (in-memory memoization per hot function instance) — Premature optimization. The Phase 1 blob-cache in-memory layer already sits in front; adding another cache in the session route would add cache-invalidation complexity for no measurable win.

</deferred>

<open_questions>
## Open Questions for Research / Planning

- **Where exactly in the RSC tree does the AuthProvider get its value?** Researcher should confirm the file that fetches `/api/auth/session` and passes it into `<AuthProvider value={...}>`. Phase 2 extends that same fetch path with the new `primeUser` field.
- **Does `lib/audit.ts` already have a generic event-type registry, or do we add `PRIME_USER_MISS` to an enum/union?** Researcher should read the audit module shape and confirm.
- **TopBar visual placement for the identity label.** Left/right/center alignment, typography, responsive breakpoint behavior — planner decides per existing TopBar visual style. No specific UI contract from requirements.
- **Do login-time Prime cache misses retry?** Phase 1 D-03 says first-miss auto-bootstraps once (one Prime call). If the first-miss fetch itself fails mid-login, do we write the `PRIME_USER_MISS` audit entry anyway? Lean: yes, with `detail: "cache_empty"` — admin can distinguish from match-miss.

</open_questions>
