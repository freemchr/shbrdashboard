# Architecture

**Analysis Date:** 2026-04-24

## Pattern Overview

**Overall:** Next.js 14 App Router Dashboard with Client-Side Rendering (CSR) for Pages + Server-Side API Layer

**Key Characteristics:**
- Each dashboard page is a client component ("use client") that fetches data via dedicated API routes
- Authentication is session-based (iron-session) with Prime ERP OAuth integration
- Page visibility is admin-controlled and stored in Vercel Blob with in-memory caching
- All Prime ERP queries go through server-side helpers (`/lib/prime-auth.ts`) that manage OAuth token lifecycle
- Sidebar-driven navigation with hierarchical grouping (Weather & CAT, Operations, Reports, Estimators, Insights)
- Kiosk mode support (full-bleed display without sidebar for public/monitoring screens)

## Layers

**Presentation Layer:**
- Purpose: Render UI components and handle user interactions
- Location: `app/*/page.tsx` (all pages use "use client"), `components/ui/`, `components/charts/`
- Contains: React client components, page implementations, reusable UI building blocks (KpiCard, DataTable, Sidebar, TopBar)
- Depends on: API routes, utility functions (formatters, helpers)
- Used by: Browser/HTTP clients

**API Layer:**
- Purpose: Handle HTTP requests and coordinate between Prime ERP backend and frontend
- Location: `app/api/` (organized by domain: prime, auth, admin, audit, weather, report-assist, etc.)
- Contains: Next.js API route handlers that validate input, call Prime API helpers, format responses
- Depends on: Prime auth helpers, Vercel Blob for persistence, audit/page-visibility libraries
- Used by: Client components, external webhooks/cron jobs

**Authentication & Authorization:**
- Purpose: Manage user sessions, validate credentials, and control access
- Location: `lib/session.ts` (iron-session wrapper), `app/api/auth/` (login/logout/session endpoints), `lib/page-visibility.ts` (group-based access)
- Contains: Session management, OAuth token handling, admin/group membership checks
- Depends on: iron-session library, Prime OAuth endpoint, Vercel Blob config storage
- Used by: AuthGuard component, API routes, admin page

**Data Access Layer:**
- Purpose: Fetch and transform data from Prime ERP
- Location: `lib/prime-auth.ts` (token management + HTTP client), `lib/prime-helpers.ts` (formatters), `lib/job-snapshots.ts` (periodic snapshots)
- Contains: `primeGet()` (single request), `primeGetAllPages()` (pagination with rate limiting), token caching, retry logic
- Depends on: Prime ERP API, environment variables for credentials
- Used by: API routes, backend services

**Infrastructure Libraries:**
- Purpose: Cross-cutting utilities for caching, auditing, blob storage
- Location: `lib/` (cache.ts, blob-cache.ts, audit.ts, page-visibility.ts, rate-limit.ts, export-csv.ts)
- Contains: Blob storage wrappers, audit log appending, CSV export, rate limit checks
- Depends on: Vercel Blob, native Node APIs
- Used by: API routes, admin features

## Data Flow

**User Login:**

1. User submits email/password on `/login` page
2. `POST /api/auth/login` validates credentials against Prime OAuth
3. If valid, stores accessToken/refreshToken in iron-session cookie (8-hour TTL)
4. Client redirects to `/` (homepage)

**Page Access:**

1. `AuthGuard` component (wraps all app content in `layout.tsx`) fetches `/api/auth/session`
2. Session endpoint returns user email, admin status, and hidden page paths
3. AuthGuard sets up `AuthProvider` context for downstream components
4. Sidebar filters nav items based on hidden page paths from context
5. Client-side page renders with auth context available

**Data Fetch (Example: Aging page):**

1. `app/stalled/page.tsx` mounts (client component)
2. `useEffect` calls `fetch('/api/prime/jobs/aging')`
3. API route handler at `app/api/prime/jobs/aging/route.ts` receives request
4. Calls `primeGet()` from `lib/prime-auth.ts` with Prime endpoint
5. `primeGet()` gets cached OAuth token from `getPrimeToken()` or refreshes if expired
6. Returns formatted data to client; client updates state
7. Page renders table/KPIs from fetched data

**Admin Config Update (Page Visibility):**

1. Admin user navigates to `/admin` and opens "Page Visibility" tab
2. Modifies group membership or page restrictions in form
3. Clicks "Save"
4. POST request to `/api/admin/page-visibility/route.ts`
5. Endpoint validates user is admin, saves config to Vercel Blob
6. Clears in-memory cache (MEM_TTL = 1 minute)
7. Returns success; client refetches auth session to get updated hiddenPaths
8. Other users' next page load picks up new restrictions from blob

**State Management:**

- Session state: iron-session cookie (secure, httpOnly)
- Auth context: React Context for current user info + page visibility
- Page data: React component state (useState) — no global store
- Visibility config: In-memory cache (1-min TTL) + Vercel Blob source-of-truth

## Key Abstractions

**AuthGuard (Presentation + Auth):**
- Purpose: Wraps all app routes; enforces authentication, renders splash screen during auth check, handles kiosk mode
- Examples: `components/ui/AuthGuard.tsx`
- Pattern: Client component wrapping `children`; layout-time auth validation before any child renders

**Page (Presentation):**
- Purpose: Dashboard page implementation for a single domain (e.g., Aging, Pipeline, Reports)
- Examples: `app/stalled/page.tsx`, `app/reports/page.tsx`, `app/aging/page.tsx`
- Pattern: "use client" component with multiple state variables (data, loading, error); fetches from `/api/prime/*` on mount; renders headers + tables/charts

**API Route (HTTP Handler):**
- Purpose: Single endpoint for a specific data request; validates, fetches from Prime, transforms response
- Examples: `app/api/prime/jobs/aging/route.ts`, `app/api/prime/jobs/trends/route.ts`
- Pattern: `export async function GET(req: NextRequest)` → validate params → call `primeGet()` → catch/format errors → `NextResponse.json(data)`

**Prime Auth Client:**
- Purpose: Encapsulates OAuth token lifecycle and rate-limited HTTP requests to Prime ERP
- Examples: `lib/prime-auth.ts` exports `primeGet()`, `primeGetAllPages()`, `getPrimeToken()`
- Pattern: Token cache stored in module scope; `getPrimeToken()` refreshes if expired; `primeGet()` retries on 429/401; paginated endpoint walks through pages with sleep(1100) between calls

**Page Visibility Config:**
- Purpose: Store/retrieve admin-controlled access rules per user group
- Examples: `lib/page-visibility.ts` exports `getVisibilityConfig()`, `isAdminEmail()`, `canSeePage()`, `getHiddenPaths()`
- Pattern: In-memory cache (1 min) backed by Vercel Blob; config defines admin emails, groups (with member email lists), and page restrictions (path + hiddenFrom group ids)

## Entry Points

**Root Layout:**
- Location: `app/layout.tsx`
- Triggers: All requests to the app
- Responsibilities: Sets up Next.js metadata, imports global CSS, wraps all routes in AuthGuard

**AuthGuard Component:**
- Location: `components/ui/AuthGuard.tsx`
- Triggers: On first client-side render (useLayoutEffect in browser)
- Responsibilities: Fetches session, determines if authenticated, renders splash or dashboard shell, sets auth context

**Login Page:**
- Location: `app/login/page.tsx`
- Triggers: Unauthenticated users redirected here by AuthGuard
- Responsibilities: Collects email/password, calls POST /api/auth/login, redirects to / on success

**Dashboard Pages (Wildcard):**
- Location: `app/[slug]/page.tsx` (e.g. `/stalled`, `/reports`, `/financial`)
- Triggers: Authenticated users navigate via sidebar
- Responsibilities: Fetch domain-specific data from `/api/prime/[domain]/*`, render page content (KPIs, tables, charts)

**API Routes:**
- Location: `app/api/[domain]/[endpoint]/route.ts`
- Triggers: Client fetch() or external webhooks/cron jobs
- Responsibilities: Validate auth, fetch/transform data, handle errors, return JSON

## Error Handling

**Strategy:** Try-catch at API route level with generic user-facing messages; internal console logging for debugging

**Patterns:**

- **Prime API Errors:** `primeGet()` logs full error text internally, throws generic message "Prime API request failed". Retries 3 times for transient errors.
- **Auth Errors:** Return 401 with generic "Invalid credentials" message. API logs actual Prime OAuth error to console.
- **Client Errors (400/422):** Return NextResponse with specific message (e.g., "Email and password are required").
- **Rate Limit (429):** `primeGet()` extracts Retry-After header, sleeps, then retries.
- **Token Expired (401 on Prime API):** `primeGet()` clears token cache and refreshes automatically.
- **Page Data Fetch Errors (client):** Page component catches error, sets error state, displays `<ErrorMessage>` component.

## Cross-Cutting Concerns

**Logging:** 
- Approach: Console.error for internal diagnostics, no external logging service
- Examples: Auth failures, Prime API errors, token refresh attempts

**Validation:**
- Input: API routes validate query params/body against allowed list (whitelist approach). Example: `/api/prime/jobs?status=open&region=VIC` only allows `status`, `region`, `page`, `per_page`, `q`, `order`, `sort`.
- Authorization: `canSeePage()` checks if user email is in any blocked group; admins bypass all checks; AuthGuard prevents unauthenticated access to protected pages.

**Authentication:**
- Approach: iron-session cookie (httpOnly, secure in prod, sameSite=lax) with 8-hour TTL; manual session refresh on each API call
- Token Refresh: Prime OAuth tokens cached in memory; `getPrimeToken()` auto-refreshes if within 30 seconds of expiry

**Rate Limiting:**
- Login attempts: 10 per 15 minutes per IP (in-memory, resets on process restart)
- Prime API: Managed by `primeGetAllPages()` with sleep(1100) between paginated requests (60 req/min limit)

---

*Architecture analysis: 2026-04-24*
