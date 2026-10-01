/**
 * Vitest config for the Firestore security-rules tests (src/__tests__/rules).
 *
 * Separate from vitest.config.ts on purpose: these tests talk to the real
 * Firestore emulator, so they must NOT load src/tests/setup.ts (which mocks
 * firebase/firestore) and they run in Node, not jsdom.
 *
 * Run with: npm run test:rules   (starts the emulator via firebase-tools)
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/rules/**/*.test.ts'],
    environment: 'node',
    // One emulator, shared state: run files and tests sequentially.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
