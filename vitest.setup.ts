// Vitest setup — registers per-test DOM cleanup for @testing-library/react.
// Without `globals: true`, the library's auto-cleanup (which guards on
// `typeof afterEach === 'function'`) is a no-op, so DOM nodes from prior
// `render()` calls accumulate across tests and `screen.getByRole(...)`
// throws "Found multiple elements". This setup file installs an explicit
// afterEach hook to invoke testing-library's cleanup() between tests.
//
// Wave 0 (Plan 03-01) intentionally avoided `setupFiles` per its summary;
// Wave 1 (this plan) reintroduces a single setup file because the picker's
// test scaffold runs >1 render() per file. Convention waiver justified by
// Rule 3 (blocking issue: tests cannot pass without DOM cleanup).
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
