import base from '@metaflow/eslint-config/base';

export default [
  ...base,
  {
    ignores: ['generated/**', 'dist/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
];
