
## Pre-existing TS errors observed during 03-04 execution
- `app/api/auth/login/route.test.ts` 8 errors: `mockResolvedValueOnce` on `never` (lines 93,105,120,137,150,162,177,188)
- `lib/audit.test.ts` 1 error: `mockResolvedValueOnce` on `never` (line 117)
- Also exist on the clean base commit (1fbfefe). Out of scope for plan 03-04. Tests still execute via vitest.
