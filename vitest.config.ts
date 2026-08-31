import { defineConfig } from 'vitest/config';
import path from 'path';

const srcPath = path.resolve(__dirname, './src');

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@': srcPath,
      'sonner@2.0.3': 'sonner',
      'react-hook-form@7.55.0': 'react-hook-form',
    },
  },
  test: {
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    environment: 'jsdom',
    server: {
      deps: {
        inline: [/./],
      },
    },
    // PASS 10 FIX: Rules tests need @firebase/rules-unit-testing (not in deps)
    // and a running Firestore emulator. They are intentionally run via the
    // separate `npm run test:rules` script (firebase emulators:exec). Including
    // them here made `npm run test` fail in CI on a clean install. Excluded
    // here; tsconfig.json already excludes them from typecheck.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/__tests__/rules/**',
    ],
    environmentMatchGlobs: [
      ['src/services/policies/__tests__/**', 'node'],
    ],
    // vmForks pool: patches BOTH import() AND require() to return vi.mock'd modules
    // This is what makes require() in test bodies return the same mock instances
    // as cutoffPolicy.ts's ESM import received.
    pool: 'vmForks',
    poolOptions: {
      vmForks: {
        interopDefault: true,
      },
    },
  },
});
