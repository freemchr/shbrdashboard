# Testing Patterns

**Analysis Date:** 2026-04-24

## Test Framework

**Runner:**
- Not detected - No test framework is configured or in use

**Assertion Library:**
- Not applicable - No tests found

**Run Commands:**
```bash
npm run lint              # Linting only (no test runner)
npm run build             # TypeScript/ESLint validation
npm run dev               # Development server
npm run start             # Production server
```

**Current State:**
- No test files (`.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`) detected in the codebase
- No test configuration (jest.config.*, vitest.config.*) present
- No testing dependencies in `package.json`
- Linting and TypeScript strict mode serve as primary code quality checks

## Test File Organization

**Location:**
- Not applicable - No test infrastructure in place

**Naming:**
- Not applicable - No tests exist

**Structure:**
- Not applicable - No tests exist

## Test Coverage

**Requirements:**
- Not enforced - No coverage tooling configured

**Current Coverage:**
- Zero - No automated tests running

---

## Testing Gaps & Observations

**Critical Areas Without Tests:**

1. **API Routes (62 route files)**
   - Files: `/app/api/**/*.ts`
   - Untested: All POST/GET handlers for auth, data fetching, external API calls
   - Risk: Login flow, session management, Prime API integration, rate limiting logic all lack coverage
   - Example: `app/api/auth/login/route.ts` - brute-force protection, OAuth token handling, session persistence untested

2. **Data Transformation & Helpers**
   - Files: `lib/prime-helpers.ts`, `lib/job-snapshots.ts`, `lib/audit.ts`
   - Untested: Date formatting, currency formatting, job status classification, data aggregation
   - Risk: Silent bugs in data presentation to users; high-risk given heavy reliance on date math and status logic

3. **Cache Management**
   - Files: `lib/cache.ts`, `lib/blob-cache.ts`
   - Untested: TTL expiration logic, cache invalidation, concurrent access patterns
   - Risk: Stale data served to users; cache not being properly cleared on updates

4. **UI Components**
   - Files: `components/ui/*.tsx`
   - Untested: All 14 UI components (KpiCard, DataTable, Sidebar, etc.) have no interaction tests
   - Risk: Broken sorting, pagination, form submission, modal interactions
   - Example: `DataTable.tsx` - sorting algorithm, pagination state, export CSV logic untested

5. **Authentication Context & Guards**
   - Files: `lib/auth-context.tsx`, `components/ui/AuthGuard.tsx`
   - Untested: Session validation, redirect logic, admin role checks, page visibility filtering
   - Risk: Unauthorized access to protected content; admin controls may not enforce properly

6. **Error Handling**
   - Untested: All error scenarios in API routes (network failures, invalid JSON, malformed data)
   - Risk: Error handling paths never validated; unexpected behavior in degraded conditions

## Mocking

**Framework:**
- Not applicable - No testing framework present to enable mocking

**Current State:**
- No mock libraries configured (jest, vitest, or similar)
- External API calls (Prime, OpenAI, weather services) made directly in production code with no mock layer
- Session management uses real iron-session without test doubles
- Database access (Vercel Blob, file I/O) not abstracted for testing

## Fixtures and Factories

**Test Data:**
- Not applicable - No test infrastructure

**Location:**
- None - Data is fetched live from Prime API in all code paths

---

## Recommended Testing Approach (For Future Implementation)

**Suggested Stack:**
- Test runner: Vitest (lightweight, Vite-compatible, Fast)
- Component testing: React Testing Library (for UI components)
- API testing: Supertest or built-in fetch in Vitest (for route handlers)
- Mocking: Vitest built-in mocks + MSW (Mock Service Worker) for external APIs
- Coverage: Vitest coverage with C8

**Priority Test Areas (in order):**
1. **Authentication flow** - login, session validation, rate limiting
2. **API endpoint stability** - route handlers for data fetching, error responses
3. **Data transformation** - date math, status classification, aggregation logic
4. **UI interactions** - sorting, pagination, form submission
5. **Cache behavior** - TTL expiration, invalidation

**Example Test Structure (for future):**

```typescript
// Example: lib/prime-helpers.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency, daysSince, isOpenJob } from './prime-helpers';

describe('prime-helpers', () => {
  describe('formatCurrency', () => {
    it('formats AUD currency correctly', () => {
      expect(formatCurrency(1234.5)).toBe('$1,234.50');
    });
    
    it('returns $0.00 for null/undefined', () => {
      expect(formatCurrency()).toBe('$0.00');
    });
  });
  
  describe('daysSince', () => {
    it('returns 0 for undefined date', () => {
      expect(daysSince()).toBe(0);
    });
    
    it('calculates days correctly', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(daysSince(yesterday.toISOString())).toBe(1);
    });
  });
  
  describe('isOpenJob', () => {
    it('returns true for open status type', () => {
      expect(isOpenJob({
        id: '123',
        type: 'job',
        attributes: { statusType: 'open' }
      })).toBe(true);
    });
  });
});
```

```typescript
// Example: components/ui/DataTable.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from './DataTable';

describe('DataTable', () => {
  const mockData = [
    { id: '1', name: 'Job A', status: 'open' },
    { id: '2', name: 'Job B', status: 'closed' },
  ];
  
  const mockColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status' },
  ];
  
  it('renders data rows', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        keyFn={(item) => item.id}
      />
    );
    expect(screen.getByText('Job A')).toBeInTheDocument();
  });
  
  it('sorts by column on click', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        keyFn={(item) => item.id}
      />
    );
    const nameHeader = screen.getByRole('button', { name: /name/i });
    fireEvent.click(nameHeader);
    // Assert sort order changed
  });
});
```

```typescript
// Example: app/api/auth/login/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

describe('/api/auth/login', () => {
  it('rejects with 400 if email/password missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
  
  it('enforces rate limiting (10 attempts per 15 min)', async () => {
    // Test rate limit logic with simulated requests
  });
  
  it('logs auth failure internally, returns generic message', async () => {
    // Mock failed OAuth response
    // Assert console.error called
    // Assert response says "Invalid credentials" (generic, not leaking info)
  });
});
```

---

## Validation Without Tests

**Current approach to quality:**
- TypeScript strict mode (`strict: true` in `tsconfig.json`) catches type errors at compile time
- ESLint with Next.js rules enabled (`eslint-config-next`) enforces code standards
- Build-time checks: both ESLint and TypeScript errors must pass before deployment
- Manual testing during development (`npm run dev`)
- Code review via git commits (evidenced by structured commit messages)

**Limitations:**
- No runtime validation of API contracts
- No regression detection across refactors
- No proof that UI interactions work as intended
- No verification of error handling paths in production scenarios

---

*Testing analysis: 2026-04-24*
