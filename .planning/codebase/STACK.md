# Technology Stack

**Analysis Date:** 2026-04-24

## Languages

**Primary:**
- TypeScript 5 - Full codebase (`.ts`, `.tsx` files)
- JavaScript - Configuration files (`.mjs`, `.ts` for Next.js setup)

## Runtime

**Environment:**
- Node.js - Backend API routes and Vercel deployment
- Browser (React 18) - Frontend client-side rendering

**Package Manager:**
- npm - Version locked via `package-lock.json`
- Lockfile: Present (`package-lock.json`)

## Frameworks

**Core:**
- Next.js 14.2.35 - Full-stack React framework with App Router
  - `next dev` - Development server
  - `next build` - Production build
  - `next start` - Production server
  - `next lint` - ESLint validation

**Frontend:**
- React 18 - UI component library
- React DOM 18 - DOM rendering

**Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS framework
- PostCSS 8 - CSS transformation pipeline

**UI Components & Visualization:**
- Recharts 3.8.0 - React charting library (bar, pie, line charts)
- Lucide React 0.577.0 - Icon library
- Leaflet 1.9.4 - Interactive maps
- @types/leaflet 1.9.21 - TypeScript definitions for Leaflet

**Testing:**
- ESLint 8 - JavaScript/TypeScript linting
- eslint-config-next 14.2.35 - Next.js linting preset

## Key Dependencies

**Critical:**
- openai 6.29.0 - OpenAI API client for GPT-4o vision and text generation
  - Used in: `/app/api/report-assist/` (caption, enhance, polish, score, validate-scope)
  - Model: `gpt-4o` with vision capabilities for image analysis
- @vercel/blob 2.3.1 - Vercel blob storage for caching and file uploads
  - Reduces Prime API calls through persistent blob-backed cache
  - Free tier: 2,000 operations/month

**Infrastructure & Data:**
- iron-session 8.0.4 - Encrypted cookie-based session management
  - Encrypted session data in `shbr_session` cookie (httpOnly, sameSite=lax)
  - Session duration: 8 hours
  - Uses environment variable `SESSION_SECRET` for encryption

**Document Processing:**
- pdf-lib 1.17.1 - PDF generation and manipulation library
- pdf-parse 2.4.5 - PDF text extraction
- form-data 4.0.5 - Multipart form data handling for file uploads

**Utilities:**
- clsx 2.1.1 - Conditional CSS class composition

**Type Definitions:**
- @types/node 20 - Node.js type definitions
- @types/react 18 - React type definitions
- @types/react-dom 18 - React DOM type definitions
- @types/pdf-parse 1.1.5 - PDF parse type definitions

## Configuration

**Environment:**
- `.env.local.example` template defines required variables:
  - `PRIME_BASE_URL` - Prime CRM API base URL
  - `PRIME_USERNAME`, `PRIME_PASSWORD` - Prime API credentials
  - `PRIME_CLIENT_ID`, `PRIME_CLIENT_SECRET` - OAuth credentials
  - `SESSION_SECRET` - Iron-session encryption key
  - `BLOB_READ_WRITE_TOKEN` - Vercel Blob access token
  - `BLOB_BASE_URL`, `BLOB_CACHE_BASE_URL` - Blob storage URLs
  - `OPENAI_API_KEY` - OpenAI API key for GPT-4o
  - `CRON_SECRET` - Vercel cron job authorization
  - `ADMIN_EMAIL` - Controls audit log and cache flush access
  - `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX` - Email submission (support channel)

**Build:**
- `tsconfig.json` - TypeScript compiler options
  - Path alias: `@/*` maps to project root
  - Strict mode enabled, noEmit (type-checking only)
  - JSX preservation for Next.js
- `next.config.mjs` - Next.js configuration
  - ESLint enabled in builds (not ignored)
  - TypeScript errors not ignored in builds
- `.eslintrc.json` - ESLint configuration
  - Extends: `next/core-web-vitals`, `next/typescript`
- `tailwind.config.ts` - Tailwind configuration
  - Dark mode via class selector
  - Brand colors: black (#111111), red (#DC2626)
  - Custom animation: shimmer effect
- `postcss.config.mjs` - PostCSS configuration
  - Tailwind CSS plugin

## Platform Requirements

**Development:**
- Node.js 18+ (inferred from type definitions)
- npm or compatible package manager
- Next.js 14.2.35 compatible environment

**Production:**
- Vercel (primary deployment platform)
- Node.js 18+ runtime
- Environment variables configured in Vercel dashboard
- Vercel Cron Jobs enabled (configured in `vercel.json`)

## Deployment & Execution

**Vercel Cron Jobs:**
- Configured in `vercel.json`:
  - `/api/cron/client-analytics-refresh` - Fridays 8:00 AM AEDT
  - `/api/cron/location-analytics-refresh` - Fridays 8:00 AM AEDT
  - `/api/prime/jobs/geocode-auto` - Daily 3:00 PM AEDT
  - `/api/prime/jobs/timeline` - Daily 8:00 PM AEDT
  - `/api/weather/bom-warnings` - Mondays 1:00 AM AEDT
  - `/api/prime/jobs/sla-predict` - Daily 7:00 PM AEDT

---

*Stack analysis: 2026-04-24*
