import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Phase 3 Plan 03-03: components/ui/PrimeUserPicker.test.ts imports from
  // PrimeUserPicker.tsx (a JSX module). The React plugin teaches Vite how to
  // load JSX (Next's tsconfig.json sets `jsx: "preserve"`, so the bundled
  // esbuild loader otherwise refuses .tsx). No tests render JSX themselves —
  // the plugin only enables import-analysis of the source module so the test
  // file can resolve its pure helper exports.
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts', 'components/**/*.test.ts'],
    globals: false,
    clearMocks: true,
  },
});
