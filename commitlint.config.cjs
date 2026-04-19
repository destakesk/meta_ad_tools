/**
 * Conventional Commits with metaflow scope enumeration.
 * Examples:
 *   feat(web): add status refresher
 *   fix(api): handle redis disconnect in health indicator
 *   chore(infra): bump postgres to 16.6
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'chore',
        'refactor',
        'test',
        'build',
        'ci',
        'perf',
        'style',
        'revert',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'web',
        'api',
        'database',
        'shared-types',
        'eslint-config',
        'tsconfig',
        'infra',
        'ci',
        'repo',
        'docker',
        'deps',
      ],
    ],
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'always', ['lower-case', 'sentence-case']],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0],
  },
};
