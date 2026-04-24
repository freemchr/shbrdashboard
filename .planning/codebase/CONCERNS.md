# Codebase Concerns

**Analysis Date:** 2026-04-24

## Tech Debt

**Monolithic Page Components:**
- Issue: Multiple page components exceed 1000 lines, mixing state management, rendering, and API calls
- Files: 
  - `app/report-assist/[jobId]/page.tsx` (1358 lines)
  - `app/report-assist/polish/page.tsx` (1092 lines)
  - `app/command-centre/page.tsx` (927 lines)
  - `app/sla/page.tsx` (898 lines)
  - `app/socials/page.tsx` (879 lines)
  - `app/cat-forecast/page.tsx` (807 lines)
  - `app/admin/page.tsx` (793 lines)
- Impact: Difficult to test, maintain, and refactor. Cognitive load high. Changing one feature risks breaking another.
- Fix approach: Extract smaller components, separate data fetching logic, split UI into reusable pieces

**Sleep Functions Duplicated Across Routes:**
- Issue: `sleep()` utility implemented in 6+ API route files instead of centralized
- Files:
  - `app/api/cron/client-analytics-refresh/route.ts:44-45`
  - `app/api/cron/location-analytics-refresh/route.ts:54`
  - `app/api/prime/jobs/client-analytics/route.ts:142-143`
  - `app/api/prime/jobs/geocode/route.ts:52-53`
  - `app/api/prime/jobs/geocode-auto/route.ts:33`
  - `app/api/prime/jobs/location-analytics/route.ts:88`
  - `app/api/prime/whs/refresh/route.ts:56-57`
- Impact: Code duplication, inconsistent rate-limiting behavior, harder to adjust sleep times globally
- Fix approach: Move to `lib/prime-auth.ts` (already has `sleep()` at line 137) or `lib/rate-limit.ts`

**Magic Numbers in PDF Generation:**
- Issue: Hardcoded page geometry, color values, and layout constants scattered throughout route
- Files: `app/api/report-assist/generate-pdf/route.ts:15-40`
  - Page width (595), height (842), margins (50 each)
  - Column widths: C1W=109, C2W=139, C3W=109, C4W=139
  - Color values (RGB tuples)
  - Footer geometry: FOOTER_TOP=82, FOOTER_BOTTOM=5
- Impact: Difficult to adjust layout; changes require searching and understanding purpose of each constant
- Fix approach: Create config object or separate constants file, document meanings

**Hard-to-Test PDF Generation:**
- Issue: `app/api/report-assist/generate-pdf/route.ts` (632 lines) mixes complex logic with side effects (file I/O, blob upload)
- Impact: No unit tests observed; refactoring is risky
- Fix approach: Extract core PDF layout logic into separate functions, mock file I/O, add unit test suite

**Polish PDF Generation Duplicates PDF Logic:**
- Issue: `app/api/report-assist/polish/generate-pdf/route.ts` (276 lines) duplicates much of `generate-pdf/route.ts`
- Impact: Any bug fix or feature in one doesn't propagate to the other; maintenance burden
- Fix approach: Extract shared PDF functions into `lib/pdf-builder.ts` or similar

## Known Bugs

**Session Expiry Not Enforced in Public APIs:**
- Issue: Several API endpoints lack session validation but should require authentication
- Files: These endpoints have no `getSession()` check:
  - `app/api/report-assist/generate-pdf/route.ts` - No auth check before processing PDF
  - `app/api/report-assist/enhance/route.ts` - AI enhancement with no user validation
  - `app/api/report-assist/polish/route.ts` - Polish with no auth
  - `app/api/report-assist/caption/route.ts` - Caption generation unprotected
  - `app/api/weather/*` - Weather APIs lack session validation
- Impact: Any authenticated user can generate PDFs, enhance reports, call OpenAI APIs for others
- Workaround: Browser-side session check in pages, but not enforced server-side
- Fix approach: Add `getSession()` check at start of each endpoint, return 401 if missing/expired

**Rate Limit Vulnerable to Distributed Attacks:**
- Issue: Rate limiter in `lib/rate-limit.ts` is per-instance, in-memory only
- Files: `lib/rate-limit.ts`, `app/api/auth/login/route.ts:16`
- Trigger: Multiple Vercel instances + distributed attacks bypass rate limit
- Impact: Brute-force protection on login is ineffective at scale
- Workaround: IP-based limiting provides some protection, but instances don't share state
- Fix approach: Move rate limiting to Redis or Vercel KV, or use third-party service (Arcjet, Cloudflare)

**Email Normalization Inconsistency:**
- Issue: User emails normalized to lowercase in auth but admin checks don't always normalize
- Files: 
  - `app/api/auth/login/route.ts:78` - Normalizes email to lowercase
  - `lib/page-visibility.ts:126` - Hardcoded admin email `chris.freeman@techgurus.com.au` needs normalization
  - `lib/page-visibility.ts:128` - Admin list normalized, but env var may not be
- Impact: Admin checks could fail if env var uses mixed case
- Fix approach: Always normalize env vars on load (see `lib/session.ts` pattern)

**Hardcoded Admin Email in Code:**
- Issue: Default admin email hardcoded instead of using env var only
- Files: `lib/page-visibility.ts:126`
  ```typescript
  const envAdmin = (process.env.ADMIN_EMAIL || 'chris.freeman@techgurus.com.au').toLowerCase();
  ```
- Impact: If ADMIN_EMAIL not set, falls back to specific user; unclear in prod if intended
- Fix approach: Make env var required, fail at startup if missing

## Security Considerations

**API Endpoint Access Control Gaps:**
- Risk: Public API endpoints accessible without session validation
- Files: Listed above under "Known Bugs - Session Expiry Not Enforced"
- Current mitigation: Session check in browser layer (iron-session cookie), but not enforced server-side
- Recommendations:
  1. Add `getSession()` + 401 check to all protected endpoints
  2. Document which endpoints are public vs. private
  3. Consider middleware for enforcing auth (e.g., `middleware.ts`)

**Rate Limiting Insufficient for Production:**
- Risk: In-memory rate limiter bypassed by load balancer distribution
- Files: `lib/rate-limit.ts:40-43` - Prunes old entries but doesn't persist across instances
- Current mitigation: Per-IP limiting helps, but not foolproof
- Recommendations:
  1. Use Vercel KV for distributed rate limiting
  2. Add CAPTCHA after N failed login attempts
  3. Monitor logs for brute-force patterns

**Password Sent in Request Body Over HTTPS Only:**
- Risk: If TLS broken, password exposed in login POST
- Files: `app/api/auth/login/route.ts:32-34`
- Current mitigation: Hardcoded HTTPS requirement (`secure: true` in session), POST not GET
- Recommendations:
  1. Add `X-Content-Type-Options: nosniff` header
  2. Ensure `Strict-Transport-Security` header set
  3. Consider OAuth-only login (no password) in future

**API Secret Validation Incomplete:**
- Risk: Some cron endpoints check secret, others don't
- Files: 
  - `app/api/cron/client-analytics-refresh/route.ts:171-172` - Checks `x-refresh-secret` ✓
  - `app/api/prime/jobs/location-analytics/route.ts:307-308` - Checks ✓
  - `app/api/weather/bom-warnings/route.ts` - No auth check ✗
  - `app/api/weather/forecast/route.ts` - No auth check ✗
  - `app/api/weather/incidents/route.ts` - No auth check ✗
  - `app/api/prime/jobs/timeline/route.ts` - No auth check ✗
- Impact: Weather and timeline endpoints callable by anyone, could trigger rate limit abuse
- Recommendations:
  1. Require `CRON_SECRET` or bearer token for all cron endpoints
  2. Document which endpoints are safe to expose

**OpenAI API Key in Frontend-Accessible Code:**
- Risk: If API key stored in environment accessible to client, it's exposed
- Files: `app/api/report-assist/caption/route.ts:8`, `enhance/route.ts:11`, etc.
- Current mitigation: Keys only in `process.env` (server-side)
- Recommendations:
  1. Ensure no client-side bundles reference `OPENAI_API_KEY`
  2. Add build-time check for leaked secrets
  3. Consider API key rotation after any deployment

## Performance Bottlenecks

**Pagination Slowdown in Analytics Routes:**
- Problem: Multiple pagination loops with per-page sleeps
- Files: `app/api/cron/client-analytics-refresh/route.ts:83`, `location-analytics-refresh/route.ts:102`
  - Each page followed by 1200ms sleep (rate limiting)
  - If 100 pages, ~2 minutes for full refresh
- Impact: Cron jobs may timeout or take too long to complete
- Improvement path:
  1. Batch requests where API allows
  2. Implement concurrent page fetches with queue (already done in `pipeline/route.ts` with `pMap`)
  3. Cache results more aggressively

**Blob Cache One-Minute TTL May Be Too Short:**
- Problem: Visibility config reloads from blob every 60s
- Files: `lib/page-visibility.ts:88`
- Impact: Under load, repeated blob fetches create latency
- Improvement path:
  1. Increase TTL to 5-10 minutes (changes don't need immediate effect)
  2. Add cache invalidation endpoint for manual refresh
  3. Monitor blob fetch response times

**Full Admin Page Load Time Unknown:**
- Problem: `app/admin/page.tsx` (793 lines) loads visibility config + audit logs + changelog + system health
- Impact: Page may be slow to load; no optimization observed
- Improvement path:
  1. Profile load time with DevTools
  2. Consider lazy-loading tabs
  3. Paginate changelog and audit logs

**Large Photo Arrays in PDF Generation:**
- Problem: Up to 30 photos (max in code) embedded in PDF sequentially
- Files: `app/api/report-assist/generate-pdf/route.ts:12` (MAX_PHOTOS=30)
- Impact: Memory usage and generation time grow with photo count
- Improvement path:
  1. Profile memory with 30 large photos
  2. Consider streaming response or chunking
  3. Compress photos before embedding

## Fragile Areas

**Prime API Integration — No Fallback:**
- Files: `lib/prime-auth.ts` (all calls), `app/api/prime/jobs/*.ts`
- Why fragile: Prime OAuth token expiry, API rate limits (60 req/min), network errors
  - If Prime down, entire dashboard fails (no fallback data)
  - Retry logic exists but limited to 3 attempts (line 61)
  - Cache helps but may serve stale data
- Safe modification:
  1. Always check `getCached()` before `primeGet()`
  2. Implement exponential backoff, not fixed retries
  3. Add circuit breaker for cascading failures
  4. Test with Prime offline
- Test coverage: No unit tests observed for failure scenarios

**PDF Layout Calculations — Fragile to Text Changes:**
- Files: `app/api/report-assist/generate-pdf/route.ts:43-68` (wrap, widthOfText)
- Why fragile: `wrap()` function is heuristic-based; long words or unusual fonts break layout
  - try/catch on `font.widthOfTextAtSize` masks errors (line 45)
  - Fallback to `0.5 * char_count * size` is rough estimate
- Safe modification:
  1. Add PDF font metric tests for actual fonts used
  2. Test with real claim data (long addresses, descriptions)
  3. Validate page breaks don't split tables or photos
- Test coverage: No unit tests for wrap, widthOfText

**Hardcoded Admin Email — Single Point of Failure:**
- Files: `lib/page-visibility.ts:126`
- Why fragile: If env var missing, fallback email is hardcoded to one person's email
  - If that person leaves or email changes, admin access is broken until code update
- Safe modification:
  1. Make ADMIN_EMAIL required (fail fast on startup)
  2. Add validation in logger
  3. Test with env var unset (should fail)

**Weather API Fetch URLs — External Dependency:**
- Files: `app/api/weather/incidents/route.ts:119, 231, 289, 337` (hardcoded URLs)
  - NSW: `https://www.rfs.nsw.gov.au/feeds/majorIncidents.json`
  - VIC: `https://emergency.vic.gov.au/public/events-geojson.json`
  - WA: `https://api.emergency.wa.gov.au/v1/incidents`
  - ACT: `http://www.esa.act.gov.au/feeds/currentincidents.xml`
- Why fragile: If any URL changes, that state's incidents silently fail
  - No monitoring of stale data
  - Fallback is empty array (line 439)
- Safe modification:
  1. Add health check endpoint for each data source
  2. Log and alert if fetch fails for 3+ consecutive calls
  3. Version URLs in config (not code)
  4. Test each URL monthly

## Scaling Limits

**In-Memory Rate Limiter — Can't Scale Horizontally:**
- Current capacity: 1000 entries max per instance, reset after pruning
- Limit: Distributed attacks across 5+ Vercel instances bypass protection
- Scaling path:
  1. Migrate to Vercel KV (Redis-compatible)
  2. Implement sliding-window rate limiting
  3. Add metrics logging for monitoring

**Blob Cache — Vercel Blob Quota:**
- Current capacity: Unclear; files cached include analytics, visibility config, social media posts
- Limit: If Vercel Blob quota exceeded, `put()` calls fail
- Scaling path:
  1. Monitor Vercel Blob usage monthly
  2. Implement TTL-based cleanup (already in `blob-cache.ts`)
  3. Consider moving large blobs (social media) to separate storage

**PDF Generation Timeout — 30s in Vercel:**
- Files: `app/api/report-assist/generate-pdf/route.ts` (no maxDuration set)
- Current limit: Default Vercel timeout is 30s for serverless
- Scaling path:
  1. Add `export const maxDuration = 60;` to increase to 60s
  2. Profile PDF generation time with complex reports
  3. If >60s, consider worker process or pre-generation

**Admin Page Analytics Queries — No Pagination:**
- Files: `app/admin/page.tsx` fetches audit logs + changelog without limit
- Scaling path:
  1. Add pagination (show 50 recent, load-more button)
  2. Add date range filter
  3. Move historical queries to separate page

## Dependencies at Risk

**OpenAI API Dependency:**
- Risk: openai@6.29.0 is relatively new; no pinning observed in package.json
- Impact: New major version could break caption, enhance, polish, score endpoints
- Migration plan:
  1. Pin OpenAI version in package.json
  2. Test new versions in staging before updating
  3. Monitor OpenAI API changes via their releases

**iron-session@8.0.4:**
- Risk: Session library may have security updates; no SLA on updates observed
- Impact: If vulnerability found, need to update and redeploy
- Migration plan:
  1. Monitor iron-session GitHub for security advisories
  2. Keep Node.js/npm dependencies updated
  3. Use `npm audit` in CI

**Vercel Blob API:**
- Risk: Proprietary service; no fallback if Vercel down
- Impact: All cached data becomes unavailable; generate-pdf fails to upload
- Migration plan:
  1. Add fallback to local filesystem for failed uploads
  2. Implement retry-with-backoff for blob operations
  3. Consider AWS S3 as alternative

## Missing Critical Features

**No Audit Trail for Generated PDFs:**
- Problem: PDFs generated but no log of who generated what when
- Blocks: Can't trace report history, security audit, or usage patterns
- Fix: Add audit log entry in generate-pdf route (already have `appendAuditLog()`)

**No Mechanism to Revoke Session Tokens:**
- Problem: If user leaves company, their session persists until expiry (8 hours)
- Blocks: Immediate access revocation on termination
- Fix: Add admin endpoint to invalidate specific user's sessions (requires session store)

**No Input Validation Schema:**
- Problem: API endpoints accept request bodies with weak validation
- Files: Most POST routes use runtime checks instead of schema validation
- Blocks: Hard to catch invalid input early, inconsistent error messages
- Fix: Implement Zod or similar schema validation library

**No Visibility into Rate Limit Metrics:**
- Problem: Rate limiting is silent; can't see which IPs are hitting limits
- Files: `lib/rate-limit.ts` has no logging
- Blocks: Can't monitor for attacks
- Fix: Add metrics endpoint, log repeated hits

## Test Coverage Gaps

**No Unit Tests for PDF Generation:**
- What's not tested: `wrap()` function, page breaks, table layout, image embedding
- Files: `app/api/report-assist/generate-pdf/route.ts`
- Risk: Changes to text wrapping or layout break reports silently
- Priority: **High** - PDF is revenue-critical

**No Unit Tests for Rate Limiting:**
- What's not tested: Token bucket logic, expiry, pruning
- Files: `lib/rate-limit.ts`
- Risk: Rate limit can be bypassed or become ineffective
- Priority: **High** - Security-critical

**No Integration Tests for Prime API:**
- What's not tested: Token refresh on 401, retry logic, pagination
- Files: `lib/prime-auth.ts`, `app/api/prime/**`
- Risk: Prime integration failures discovered in production
- Priority: **High** - Core functionality depends on it

**No E2E Tests Observed:**
- What's not tested: Full user workflows (login → create report → generate PDF → upload)
- Risk: Multi-step workflows fail silently
- Priority: **Medium** - Important for user-facing features

**No Tests for Page Visibility Logic:**
- What's not tested: Group membership, admin override, hidden paths
- Files: `lib/page-visibility.ts`
- Risk: Access control logic changes break silently
- Priority: **Medium** - Security-relevant

---

*Concerns audit: 2026-04-24*
