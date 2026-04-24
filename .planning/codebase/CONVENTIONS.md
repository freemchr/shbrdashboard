# Coding Conventions

**Analysis Date:** 2026-04-24

## Naming Patterns

**Files:**
- Component files: PascalCase (e.g., `KpiCard.tsx`, `DataTable.tsx`, `AuthGuard.tsx`)
- Pages: lowercase (e.g., `page.tsx`)
- Utility/helper files: camelCase (e.g., `prime-helpers.ts`, `auth-context.tsx`, `cache.ts`)
- Config files: lowercase with hyphens (e.g., `next.config.mjs`)

**Functions:**
- camelCase for all function names (e.g., `isOpenJob`, `formatCurrency`, `daysSince`)
- Exported utility/helper functions: camelCase (e.g., `getCached`, `setCached`, `downloadCSV`)
- React components: PascalCase (e.g., `KpiCard`, `DataTable`, `EmptyState`)
- React hooks: camelCase with `use` prefix (e.g., `useAuth`)

**Variables:**
- camelCase for local variables and constants (e.g., `sortKey`, `pageSize`, `authed`)
- UPPERCASE for environment variables and truly immutable constants (e.g., `PUBLIC_PATHS`, `CC_EMAIL`)
- Boolean variables often prefixed with `is` (e.g., `isAdmin`, `isKiosk`, `isLoginPage`)

**Types & Interfaces:**
- PascalCase for interface/type names (e.g., `KpiCardProps`, `PrimeJob`, `AuthContext`, `TrendDelta`)
- Props interfaces typically named `[ComponentName]Props` (e.g., `DataTableProps`, `EmptyStateProps`)
- Data model interfaces prefixed contextually (e.g., `PrimeJob`, `PrimeStatus`, `PrimeInvoice`)

## Code Style

**Formatting:**
- Tool: Tailwind CSS for styling (no separate formatter configured in repo)
- Indentation: 2 spaces (standard Next.js/React)
- Quotes: Single quotes preferred for strings (seen in imports and code)
- Line length: No strict limit observed, but code tends toward readable line wraps

**Linting:**
- Tool: ESLint with Next.js core web vitals config (`eslint-config-next`)
- Config file: `.eslintrc.json`
- TypeScript strict mode: Enabled in `tsconfig.json` (`"strict": true`)
- Build enforcement: Both ESLint and TypeScript errors must pass (`ignoreDuringBuilds: false`)
- Note: ESLint rules include suppressions for specific cases (e.g., `// eslint-disable-next-line @typescript-eslint/no-explicit-any` for generic components like `DataTable<T>`)

## Import Organization

**Order:**
1. React imports and Next.js framework imports (e.g., `import { useState } from 'react'`)
2. Next.js routing/navigation (e.g., `import { useRouter } from 'next/navigation'`)
3. External library imports (e.g., `import { ChevronUp, Download } from 'lucide-react'`)
4. Local absolute imports using `@/` alias (e.g., `import { KpiCard } from '@/components/ui/KpiCard'`)
5. Type imports when needed

**Path Aliases:**
- `@/*` → project root directory (configured in `tsconfig.json`)
- Used consistently across all files for absolute imports
- Common patterns: `@/components/...`, `@/lib/...`, `@/app/api/...`

## Error Handling

**Patterns:**
- Server-side errors logged to console with context prefix (e.g., `console.error('[audit/log] Error:', error)`)
- API routes return `NextResponse.json()` with explicit HTTP status codes
- Authentication errors return 401; validation errors return 400; server errors return 500; rate-limit return 429
- Generic error messages sent to client (e.g., "Invalid credentials") instead of internal details
- Delays added strategically on auth failures (e.g., 1000–1500ms) to slow credential stuffing attacks
- Try-catch blocks wrap async operations in API routes; errors gracefully escalate to client

**Specific examples:**
- `app/api/auth/login/route.ts` returns generic "Invalid credentials" message while logging actual OAuth error details
- `app/api/support/submit/route.ts` catches JSON parse errors with generic "Internal error" response
- Validation happens early with null/undefined checks before processing

## Logging

**Framework:** `console` methods (`console.log`, `console.error`, `console.warn`)

**Patterns:**
- No dedicated logging library; uses native console
- Prefixed with context tags in brackets for traceability (e.g., `[cron/client-analytics]`, `[download]`, `[scope]`)
- Used in API routes for:
  - Progress updates in paginated fetches (e.g., "Page 1/10")
  - Completion summaries with statistics
  - Error details with status codes or stack traces
- Not used in client-side components (client components are silent on errors, relay to users via UI)
- Error logs often include error objects directly for debugging

## Comments

**When to Comment:**
- Used sparingly; code is generally self-documenting
- Comments appear at important decision points or complex algorithms
- Markup comments use structured format (e.g., `// ── #3 FIX: Description` for fixes)
- Comments explain the "why", not the "what"

**Examples from codebase:**
- `// ── #3 FIX: Brute-force protection ──────────────────────────────────────────` in login route
- `// Normalise email — always lowercase + trimmed so admin checks are reliable` explains intent
- `// Compact single-line row for the Report/Quote Sent panel` describes component usage
- `// Friendly label for trigger type` explains data transformation

**JSDoc/TSDoc:**
- Not heavily used; types and interfaces are preferred for documentation
- Inline type definitions in interfaces serve as de facto documentation
- Sample from `sanitize.ts` shows JSDoc blocks for utility functions

## Function Design

**Size:** Functions tend to be 20–80 lines; larger ones (100+ lines) seen in data-heavy pages (e.g., `page.tsx`) where they handle charting and complex layouts

**Parameters:**
- Destructured props for React components (see `KpiCard`, `DataTable`, `AuthGuard`)
- Typed explicitly with interfaces (e.g., `KpiCardProps`, `DataTableProps<T>`)
- Optional parameters use `?:` in interfaces and destructuring defaults
- Generic type parameters used for reusable components (e.g., `DataTable<T>`)

**Return Values:**
- React components return JSX.Element or equivalent
- Utility functions return typed values (e.g., `boolean`, `string | null`, `T | null`)
- API routes return `NextResponse` with proper status codes
- Functions with multiple return paths use explicit null/undefined returns rather than implicit undefined

## Module Design

**Exports:**
- Named exports preferred (e.g., `export function KpiCard(...)`, `export interface TrendDelta`)
- Default exports used only for page files in Next.js app router
- All utility functions are named exports for clarity
- Interfaces exported alongside their consuming functions/components

**Barrel Files:**
- Not used in this codebase; imports reference specific files directly
- Each component/utility file is imported by its full path (e.g., `from '@/components/ui/KpiCard'`)
- Allows tree-shaking and clear dependency tracking

**Import Suppression:**
- ESLint disable comments used pragmatically for generic components: `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 
- Applied only when generics provide adequate type safety (e.g., `DataTable<T = any>` still has TypeScript inference on actual usage)

---

*Convention analysis: 2026-04-24*
