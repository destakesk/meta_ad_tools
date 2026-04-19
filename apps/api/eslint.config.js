import nest from '@metaflow/eslint-config/nest';

export default [
  ...nest,
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
];
