import base from './base.js';

/**
 * ESLint config for NestJS 10 backend apps.
 * Relaxes decorator-related rules that collide with Nest patterns.
 */
export default [
  ...base,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'import-x/no-default-export': 'off',
    },
  },
];
