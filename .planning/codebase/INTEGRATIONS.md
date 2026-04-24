# External Integrations

**Analysis Date:** 2026-04-24

## APIs & External Services

**Prime CRM System:**
- Prime API - Core job management and operational data
  - SDK/Client: Fetch-based (custom OAuth wrapper in `lib/prime-auth.ts`)
  - Auth: OAuth 2.0 (password flow)
    - Credentials: `PRIME_BASE_URL`, `PRIME_USERNAME`, `PRIME_PASSWORD`, `PRIME_CLIENT_ID`, `PRIME_CLIENT_SECRET`
    - Token endpoint: `{PRIME_BASE_URL}/oauth/token`
    - Token cache: In-memory with automatic refresh on 401
    - Retry strategy: 3 attempts with rate-limit handling (Retry-After header)
  - Rate limit: 60 requests/minute (enforced in `lib/prime-auth.ts`)
  - Used by: Open jobs, KPIs, trends, client analytics, location analytics, job timeline, SLA predictions
  - Implementations: `lib/prime-auth.ts`, `lib/prime-open-jobs.ts`, `app/api/prime/*`

**OpenAI (GPT-4o):**
- GPT-4o Vision - Image analysis for insurance assessment captions
- GPT-4o Text - Report enhancement, polish, scoring, validation
  - SDK/Client: `openai` package v6.29.0
  - Auth: API key via `OPENAI_API_KEY`
  - Model: `gpt-4o` (vision and text variants)
  - Max image size: 5MB (enforced in caption route)
  - Used by report-assist endpoints:
    - `/api/report-assist/caption` - Image-to-caption (vision)
    - `/api/report-assist/enhance` - Report text enhancement
    - `/api/report-assist/polish` - Report text refinement
    - `/api/report-assist/score` - Quality scoring
    - `/api/report-assist/validate-scope` - Scope validation
  - Temperature: 0.3 (deterministic)
  - Max tokens: 200 (captions), varies by task

**Nominatim (OpenStreetMap):**
- Geocoding service - Address to lat/lng conversion for job location mapping
  - Endpoint: `https://nominatim.openstreetmap.org/search`
  - Rate limit: 1 request/second (enforced in `app/api/prime/jobs/geocode-auto/route.ts`)
  - Parameters: `q=address, Australia&format=json&limit=1&countrycodes=au`
  - Used by: Auto-geocoding cron job
  - Implementation: `app/api/prime/jobs/geocode-auto/route.ts` (processes 50 jobs/run)

**AgentMail:**
- Email delivery service - Support ticket submission
  - Endpoint: `https://api.agentmail.to/v0/inboxes/{inbox}/messages/send`
  - Auth: Bearer token via `AGENTMAIL_API_KEY`
  - Configuration: `AGENTMAIL_INBOX` (target inbox ID)
  - Used by: `/api/support/submit` (bug reports, feature requests, automation requests)
  - Implementation: `app/api/support/submit/route.ts`

**Public Weather & Emergency Data:**
- NSW RFS (Rural Fire Service) - Real-time incidents (GeoJSON)
  - Endpoint: `https://www.rfs.nsw.gov.au/feeds/majorIncidents.json`
  - Format: GeoJSON
  - Cache: 5 minutes (Next.js fetch cache)
  - Used by: `/api/weather/incidents`

- VicEmergency - Real-time incidents (GeoJSON)
  - Endpoint: `https://emergency.vic.gov.au/public/events-geojson.json`
  - Format: GeoJSON
  - Cache: 5 minutes
  - Used by: `/api/weather/incidents`

- WA DFES (Disaster Management) - Real-time incidents (REST API)
  - Endpoint: `https://api.emergency.wa.gov.au/v1/incidents`
  - Format: JSON
  - Cache: 5 minutes
  - Used by: `/api/weather/incidents`

- ACT ESA (Emergency Services Agency) - Real-time incidents (XML/RSS)
  - Endpoint: `http://www.esa.act.gov.au/feeds/currentincidents.xml`
  - Format: XML/RSS
  - Cache: 5 minutes
  - Used by: `/api/weather/incidents`

- QLD QFES (Fire & Emergency Services) - Real-time incidents (cached from Blob)
  - Source: Public S3 bucket (via local script, 2-hour updates)
  - Storage: Blob cache via `lib/blob-cache.ts`
  - Used by: `/api/weather/incidents`

- BOM (Bureau of Meteorology) - Weather forecast and warnings
  - Endpoint: TBD (referenced in `vercel.json` cron)
  - Used by: `/api/weather/forecast`, `/api/weather/bom-warnings`
  - Implementation: `app/api/weather/bom-warnings/route.ts`, `app/api/weather/forecast/route.ts`

## Data Storage

**Databases:**
- None detected - No traditional database (Postgres, MySQL, MongoDB, etc.)
- All data sourced from Prime CRM API

**File Storage:**
- Vercel Blob - Primary file storage
  - Client: `@vercel/blob` package v2.3.1
  - Connection: `BLOB_READ_WRITE_TOKEN` (authorization header)
  - Base URL: `BLOB_BASE_URL`, `BLOB_CACHE_BASE_URL`
  - Access level: Private (credentials required)
  - Used by:
    - Cache layer for analytics data (`lib/blob-cache.ts`)
    - Report PDFs storage (`/api/report-assist/save-report`)
    - Draft reports (`/api/report-assist/load-report`)
    - Report history listing
    - Social media post images (`/api/socials/posts`)
  - Operations budget: 2,000/month free tier
    - Optimised to max 1 op per read, 1 op per write
    - In-memory layer absorbs repeated reads

**Caching:**
- Vercel Blob-backed persistent cache (`lib/blob-cache.ts`)
  - TTL: Configurable per entry (typically 2-4 hours)
  - Stale-while-revalidate: 80% of TTL (serves stale data, refreshes in background)
  - In-memory layer: Per-instance, zero Blob ops
  - Keys cached:
    - `all-open-jobs-v3` - Full open jobs dataset
    - `geocoded-jobs-v6` - Job locations with lat/lng
    - `incidents-qld-v1` - QLD emergency incidents
    - `client-analytics-*` - Client performance metrics
    - `location-analytics-*` - Location performance metrics

## Authentication & Identity

**Auth Provider:**
- Prime CRM OAuth (custom implementation)
  - Flow: Password grant (user email/password)
  - Token storage: Encrypted cookie-based session via iron-session
  - Session key: `shbr_session`
  - Encryption: `SESSION_SECRET` environment variable
  - Duration: 8 hours
  - Cookie flags: httpOnly, sameSite=lax, secure in production
  - Implementation: `lib/session.ts`, `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`

**Admin Access Control:**
- Email-based (hardcoded check against `ADMIN_EMAIL` env var)
  - Controls: Audit log access, cache flush permissions
  - Implementation: `app/admin/page.tsx`, `lib/page-visibility.ts`

## Monitoring & Observability

**Error Tracking:**
- Not detected - Errors logged to console only
  - Implementation: `console.error()` in API routes and auth flows

**Logs:**
- Console logging (server-side only)
  - Format: `[context] message: details`
  - Examples:
    - `[prime-auth] Token request failed: status, response`
    - `[blob-cache] Failed to write to Blob: error`
    - `[incidents] {STATE} fetch failed: reason`
  - Implementation: Across `lib/prime-auth.ts`, `lib/blob-cache.ts`, `app/api/weather/incidents/route.ts`

## CI/CD & Deployment

**Hosting:**
- Vercel (inferred from:
  - `@vercel/blob` dependency
  - `vercel.json` configuration
  - Environment variable patterns
  - Next.js native deployment)

**CI Pipeline:**
- Not detected - No GitHub Actions, CircleCI, etc. configuration
- Builds likely triggered by Vercel on push to main branch

**Cron Jobs:**
Vercel Cron (configured in `vercel.json`):
| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/client-analytics-refresh` | Fridays 08:00 AEDT | Cache client KPI analytics |
| `/api/cron/location-analytics-refresh` | Fridays 08:00 AEDT | Cache location performance data |
| `/api/prime/jobs/geocode-auto` | Daily 15:00 AEDT | Auto-geocode pending jobs (50/run) |
| `/api/prime/jobs/timeline` | Daily 20:00 AEDT | Update job timeline cache |
| `/api/weather/bom-warnings` | Mondays 01:00 AEDT | Fetch BOM weather warnings |
| `/api/prime/jobs/sla-predict` | Daily 19:00 AEDT | SLA prediction model |

## Environment Configuration

**Required env vars (from `.env.local.example`):**

**Prime CRM:**
- `PRIME_BASE_URL` - OAuth/API base URL
- `PRIME_USERNAME` - Service account username
- `PRIME_PASSWORD` - Service account password
- `PRIME_CLIENT_ID` - OAuth client ID
- `PRIME_CLIENT_SECRET` - OAuth client secret

**Session & Security:**
- `SESSION_SECRET` - Iron-session encryption key (32+ chars recommended)
- `CRON_SECRET` - Vercel cron authorization (Bearer token)

**Storage:**
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob API token
- `BLOB_BASE_URL` - Blob storage URL (e.g., `https://xxxx.blob.vercel-storage.com`)
- `BLOB_CACHE_BASE_URL` - Private Blob cache URL (e.g., `https://xxxx.private.blob.vercel-storage.com`)

**AI:**
- `OPENAI_API_KEY` - GPT-4o API key (sk-...)

**Admin:**
- `ADMIN_EMAIL` - Email address with audit log + cache flush access

**Email:**
- `AGENTMAIL_API_KEY` - AgentMail API token
- `AGENTMAIL_INBOX` - Target inbox ID for support submissions

**Secrets location:**
- Development: `.env.local` (git-ignored)
- Production: Vercel Environment Variables dashboard
- `.env.local.example` provides template

## Webhooks & Callbacks

**Incoming:**
- None detected - All data pulls are request-based (Vercel Cron initiates)

**Outgoing:**
- Prime CRM - Job attachment uploads
  - Endpoint: `{PRIME_BASE_URL}/attachments`
  - Method: POST multipart/form-data
  - Used by: `/api/report-assist/upload-to-prime`
  - Implementation: FormData with PDF binary + metadata
- AgentMail - Support email submission
  - Endpoint: `https://api.agentmail.to/v0/inboxes/{inbox}/messages/send`
  - Method: POST JSON
  - Used by: `/api/support/submit`

---

*Integration audit: 2026-04-24*
