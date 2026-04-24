# Codebase Structure

**Analysis Date:** 2026-04-24

## Directory Layout

```
shbrdashboard/
├── app/                       # Next.js App Router — pages, API routes, layout
│   ├── layout.tsx             # Root layout (metadata, AuthGuard wrapper)
│   ├── globals.css            # Global styles (Tailwind imports)
│   ├── page.tsx               # Homepage / overview (KPIs, job trends)
│   ├── favicon.ico            # App icon
│   ├── fonts/                 # Custom font files
│   ├── login/                 # Login page (email/password)
│   ├── admin/                 # Admin hub (visibility, audit, changelog tabs)
│   ├── api/                   # API routes (grouped by domain)
│   │   ├── auth/              # Authentication (login, logout, session)
│   │   ├── prime/             # Prime ERP data (jobs, financial, ops, team)
│   │   ├── admin/             # Admin endpoints (page-visibility)
│   │   ├── audit/             # Audit log (entries, log)
│   │   ├── changelog/         # Changelog tracking
│   │   ├── cron/              # Scheduled tasks (location/client analytics refresh)
│   │   ├── report-assist/     # AI report features (scope, score, polish, etc.)
│   │   ├── weather/           # Weather API (forecast, warnings, incidents)
│   │   ├── socials/           # Social media posts
│   │   └── support/           # Support request submission
│   │
│   ├── stalled/               # Jobs stalled >7 days (aging, bottlenecks)
│   ├── financial/             # Financial overview (invoices, p&l)
│   ├── search/                # Job search with filters
│   ├── map/                   # Interactive job map (Leaflet)
│   ├── pipeline/              # Sales pipeline
│   ├── command-centre/        # Command centre dashboard
│   ├── reports/               # Report status and tracking
│   ├── report-assist/         # AI report polisher (main + [jobId] nested routes)
│   ├── socials/               # Social media feed
│   ├── whs/                   # WHS (workplace health & safety)
│   ├── weather/               # Weather forecast
│   ├── cat-forecast/          # CAT demand forecast
│   ├── clients/               # Client analytics dashboard
│   ├── locations/             # Jobs by location map
│   ├── ops/                   # Job board (operations)
│   ├── team/                  # Team performance metrics
│   ├── sla/                   # SLA tracker
│   ├── sla-predict/           # SLA predictor
│   ├── estimators/            # Estimator workload
│   ├── timeline/              # Timeline tracking
│   ├── bottlenecks/           # Job bottleneck analysis
│   ├── aging/                 # Aging report (redirects to stalled)
│   ├── audit/                 # Audit redirect (→ admin?tab=audit)
│   ├── flagged/               # Flagged jobs
│   ├── vulnerable/            # Vulnerable customer jobs
│   ├── eol/                   # EOL tracker
│   ├── flexi-calc/            # Flexi ROI calculator
│   ├── changelog/             # Changelog redirect (→ admin?tab=changelog)
│   └── support/               # Support page stub
│
├── components/                # Reusable React components
│   ├── ui/                    # UI building blocks (KpiCard, DataTable, Sidebar, etc.)
│   │   ├── AuthGuard.tsx      # Auth wrapper, splash screen, layout mode selector
│   │   ├── Sidebar.tsx        # Main navigation sidebar (hierarchical menu)
│   │   ├── TopBar.tsx         # Top bar with user menu, logout
│   │   ├── PageHeader.tsx     # Page title + subtitle component
│   │   ├── KpiCard.tsx        # Single KPI display (value + icon)
│   │   ├── DataTable.tsx      # Sortable table component with custom rendering
│   │   ├── LoadingSpinner.tsx # Loading state + error message displays
│   │   ├── StatusBadge.tsx    # Job type and status badges
│   │   ├── JobMap.tsx         # Leaflet map for job locations
│   │   ├── AuditTracker.tsx   # Audit log tracking (background)
│   │   ├── DataRefreshButton.tsx # Manual data refresh button
│   │   ├── EmptyState.tsx     # Empty result state display
│   │   ├── Logo.tsx           # SHBR logo component
│   │   └── *.tsx              # Other UI components
│   └── charts/                # Chart components
│       └── BarChartComponent.tsx # Recharts wrapper for bar charts
│
├── lib/                       # Shared utilities and helpers
│   ├── prime-auth.ts          # Prime ERP OAuth client (token mgmt, primeGet, primeGetAllPages)
│   ├── prime-helpers.ts       # Formatters (currency, date, etc.)
│   ├── prime-open-jobs.ts     # Job snapshot caching helper
│   ├── job-snapshots.ts       # Periodic job data snapshots for trends
│   ├── page-visibility.ts     # Admin-controlled page access (groups, restrictions)
│   ├── auth-context.tsx       # React Context for user auth state
│   ├── session.ts             # iron-session wrapper (getSession, sessionOptions)
│   ├── audit.ts               # Audit log appending to Vercel Blob
│   ├── blob-cache.ts          # Vercel Blob read/write utilities
│   ├── cache.ts               # Basic cache utilities
│   ├── rate-limit.ts          # In-memory rate limiting (login brute-force)
│   ├── export-csv.ts          # CSV download helper
│   └── sanitize.ts            # HTML/string sanitization
│
├── public/                    # Static assets
│   ├── shbr-logo.png          # SHBR Group logo
│   └── ...                    # Other images, icons
│
├── scripts/                   # Utility scripts
│
├── .planning/                 # GSD documentation (auto-generated)
│   └── codebase/              # This directory (ARCHITECTURE.md, STRUCTURE.md, etc.)
│
├── next.config.mjs            # Next.js configuration (ESLint/TS checks enabled)
├── tsconfig.json              # TypeScript config (strict mode, path alias @/*)
├── package.json               # Dependencies (Next.js 14, React 18, Recharts, Leaflet, etc.)
└── .env*                      # Environment variables (secrets, API endpoints) — DO NOT COMMIT
```

## Directory Purposes

**`app/`:**
- Purpose: Next.js App Router — all pages, API routes, and layout
- Contains: Client pages ("use client"), API route handlers, nested dynamic routes
- Key files: `layout.tsx` (root wrapper), `page.tsx` (routes), `api/` (HTTP endpoints)

**`app/api/`:**
- Purpose: Backend HTTP API endpoints
- Contains: Request handlers grouped by domain (auth, prime, admin, audit, cron, etc.)
- Key patterns: `route.ts` files, middleware for auth/validation, error handling

**`app/api/prime/`:**
- Purpose: Proxy and transform Prime ERP API calls
- Contains: Endpoints for jobs (trends, aging, bottlenecks), financial data, team metrics
- Depends on: `lib/prime-auth.ts` for OAuth token management and HTTP client

**`app/api/auth/`:**
- Purpose: User authentication (login, logout, session retrieval)
- Contains: `login/route.ts` (credential validation), `logout/route.ts`, `session/route.ts` (return current user)
- Key behavior: Session storage via iron-session, audit logging

**`components/ui/`:**
- Purpose: Reusable UI building blocks
- Contains: AuthGuard (auth wrapper), Sidebar (nav), TopBar (user menu), KpiCard, DataTable, etc.
- Pattern: All components are client components; receive props for data/callbacks

**`components/charts/`:**
- Purpose: Chart visualization components
- Contains: Recharts wrappers and custom chart implementations
- Example: `BarChartComponent.tsx`

**`lib/`:**
- Purpose: Shared utilities and service layers
- Contains: Prime API client, formatters, auth context, audit logging, blob storage
- Key files: `prime-auth.ts` (critical for all data fetching), `page-visibility.ts` (admin access control)

## Key File Locations

**Entry Points:**

- `app/layout.tsx`: Root layout, wraps all pages in AuthGuard
- `app/page.tsx`: Homepage (overview with KPIs and trends) — 27KB, substantial implementation
- `components/ui/AuthGuard.tsx`: Auth validation and layout selector (splash screen, kiosk mode)
- `app/login/page.tsx`: Login form

**Configuration:**

- `next.config.mjs`: Disables TypeScript build errors and ESLint during build (see #10 FIX comment)
- `tsconfig.json`: Strict mode enabled, path alias `@/*` → root directory
- `.env*`: Environment variables (PRIME_BASE_URL, PRIME_CLIENT_ID, ADMIN_EMAIL, SESSION_SECRET, BLOB_READ_WRITE_TOKEN, etc.)

**Core Logic:**

- `lib/prime-auth.ts`: OAuth token caching and HTTP client (getPrimeToken, primeGet, primeGetAllPages)
- `lib/page-visibility.ts`: Admin-controlled page access (7.5KB, complex logic for groups + restrictions)
- `lib/auth-context.tsx`: React Context for user info and hidden page paths
- `app/api/auth/login/route.ts`: Credential validation, session creation, rate limiting (brute-force protection)

**Testing:**

- No test files found (Jest/Vitest not configured)

**Data & State:**

- Session: iron-session cookie (8-hour TTL)
- Auth context: React Context `AuthContext` in `lib/auth-context.tsx`
- Page data: Component-level `useState` (no global store like Redux)
- Config: Vercel Blob storage + in-memory cache (1-min TTL)

## Naming Conventions

**Files:**

- Page files: `page.tsx` (Next.js convention, one per route directory)
- API routes: `route.ts` (Next.js convention in `api/` subdirectories)
- Components: PascalCase, e.g., `AuthGuard.tsx`, `Sidebar.tsx`, `KpiCard.tsx`
- Utilities: camelCase, e.g., `prime-auth.ts`, `job-snapshots.ts`

**Directories:**

- Feature pages: kebab-case, e.g., `/stalled`, `/report-assist`, `/sla-predict`
- API domains: kebab-case, e.g., `/api/report-assist`, `/api/prime/jobs`, `/api/auth`
- Dynamic routes: Square brackets, e.g., `/api/prime/jobs/[id]`, `/report-assist/[jobId]`

**Components & Functions:**

- React components: PascalCase, e.g., `AuthGuard`, `KpiCard`, `StatusBadge`
- Hooks: camelCase, e.g., `useAuth()` (custom hook from `lib/auth-context.tsx`)
- API functions: camelCase, e.g., `primeGet()`, `primeGetAllPages()`, `getSession()`
- Types: PascalCase suffixed with Type or Interface, e.g., `SessionData`, `VisibilityConfig`, `AuthContext`

## Where to Add New Code

**New Page (Dashboard Feature):**

1. Create new directory under `app/` (e.g., `app/new-feature/`)
2. Add `page.tsx` with "use client" at top
3. Import UI components (`PageHeader`, `KpiCard`, `DataTable`, etc.) from `components/ui/`
4. Fetch data via `fetch('/api/prime/...')` in `useEffect`
5. Add entry to `lib/page-visibility.ts` `ALL_PAGES` array
6. Add sidebar menu item in `components/ui/Sidebar.tsx` under appropriate section

**New API Endpoint (Data Route):**

1. Create nested directory under `app/api/` reflecting the data domain
2. Add `route.ts` file exporting `GET`, `POST`, `PUT`, `DELETE` functions as needed
3. Use `primeGet()` from `lib/prime-auth.ts` to fetch Prime ERP data
4. Validate inputs, handle errors with try-catch, return `NextResponse.json()`
5. Example structure: `app/api/prime/jobs/new-endpoint/route.ts`

**New UI Component:**

1. Create `.tsx` file in `components/ui/` (PascalCase name)
2. Export as default or named export
3. Use "use client" if component needs client-side state/effects
4. Import from `lucide-react` for icons, Recharts for charts
5. Use Tailwind CSS for styling (dark theme via `bg-gray-950`, `text-gray-400`, etc.)

**New Utility Function:**

1. Add to existing `lib/` file or create new one (camelCase.ts)
2. Export functions as named exports
3. Use pure functions where possible; manage side effects (API calls, storage) at layer boundary
4. Document non-obvious behavior (e.g., `primeGet()` auto-retries, token caching, pagination)

**New API Integration (External Service):**

1. Create wrapper in `lib/` or as API route depending on complexity
2. If data-fetching only: Use from API routes (e.g., `lib/weather-api.ts` called by `app/api/weather/forecast/route.ts`)
3. If real-time or webhook: Create API route in `app/api/[service]/` to accept incoming requests
4. Store credentials in `.env` (never in code)

## Special Directories

**`app/fonts/`:**
- Purpose: Custom font files (e.g., Google Fonts downloaded locally)
- Generated: No (checked in)
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: GSD auto-generated documentation (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by `/gsd-map-codebase` agent)
- Committed: No (in `.gitignore`)

**`.env` files:**
- Purpose: Environment variables and secrets
- Generated: No (manually configured)
- Committed: No (in `.gitignore`)
- Required vars: `PRIME_BASE_URL`, `PRIME_USERNAME`, `PRIME_PASSWORD`, `PRIME_CLIENT_ID`, `PRIME_CLIENT_SECRET`, `ADMIN_EMAIL`, `SESSION_SECRET`, `BLOB_CACHE_BASE_URL`, `BLOB_READ_WRITE_TOKEN`

**`public/`:**
- Purpose: Static assets served at root (images, logos, etc.)
- Generated: No
- Committed: Yes
- Examples: `shbr-logo.png`

---

*Structure analysis: 2026-04-24*
