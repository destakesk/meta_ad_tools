import base from '@metaflow/eslint-config/base';

export default [
  ...base,
  {
    ignores: ['generated/**', 'dist/**'],
  },
];
