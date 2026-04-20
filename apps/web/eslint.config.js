import next from '@metaflow/eslint-config/next';

export default [
  ...next,
  {
    ignores: ['.next/**', 'coverage/**', 'dist/**', 'next-env.d.ts'],
  },
];
