/**
 * ESLint config — Pass 8
 *
 * Minimal config that doesn't fight the existing code style. Designed to
 * complement (not duplicate) what TypeScript's full strict mode (Pass 6)
 * already catches.
 *
 * Rules enabled here are the ones TypeScript can't enforce:
 *   - no-console (warn): nudges devs toward the structured logger
 *   - react-hooks/rules-of-hooks: catches hook calls inside conditionals
 *   - react-hooks/exhaustive-deps: warns on stale closures in deps arrays
 *
 * Rules disabled deliberately:
 *   - @typescript-eslint/no-explicit-any: Pass 5+ already documented why
 *     ~300 explicit `: any` are legitimate (FieldValue/Timestamp boundaries,
 *     modal dispatch). The `any` count is gated by code review, not lint.
 *   - @typescript-eslint/no-unused-vars: Pass 6 deferred unused-locals
 *     cleanup; tsconfig's noUnusedLocals stays off until that pass.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // PASS 11: Migration complete — `console.log` and `console.warn` are
    // now banned in src/. `console.error` is still allowed because the
    // structured logger's `logger.error` is a thin wrapper around it
    // and the existing 355 call sites are all production-correct
    // (errors should always be logged in any environment).
    //
    // To log a development-only message, use `logger.log` / `logger.warn`
    // / `logger.debug` (all stripped from production via build config).
    // To log a structured event for the error reporter, use
    // `logger.event(name, level, ctx)` or `logger.exception(name, err, ctx)`.
    'no-console': ['error', { allow: ['error'] }],

    // React hooks correctness
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Deliberately disabled — see header comment
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'no-empty': 'off',

    // Prefer const but don't fail builds on it
    'prefer-const': 'warn',
  },
  ignorePatterns: [
    'dist',
    'build',
    'node_modules',
    'src/functions/lib',
    'src/seed',
    '*.config.js',
    '*.config.ts',
    'src/__tests__/**',
  ],
  overrides: [
    {
      // The structured logger itself uses console internally — that's the point
      files: ['src/utils/logger.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
