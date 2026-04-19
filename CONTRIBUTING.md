# Contributing

## Branch strategy

- `main` is protected. All work lands via PR.
- Feature branches: `feature/module-<NN>-<short-name>` (e.g.
  `feature/module-02-auth`).
- Fix branches: `fix/<short-name>`.

## Commit convention

We enforce [Conventional Commits](https://www.conventionalcommits.org/) via
`commitlint` at commit time.

### Allowed types

`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `build`, `ci`, `perf`,
`style`, `revert`.

### Allowed scopes

`web`, `api`, `database`, `shared-types`, `eslint-config`, `tsconfig`, `infra`,
`ci`, `repo`, `docker`, `deps`.

### Examples

```
feat(web): add status refresher client component
fix(api): handle redis disconnect gracefully in readiness probe
chore(deps): bump next to 15.2.0
```

## Pre-commit

Husky runs `lint-staged` (Prettier on staged files) before every commit.
The `commit-msg` hook runs `commitlint` against the draft message.

To skip hooks in an emergency: `git commit --no-verify` — **but** the same
checks run in CI, so the PR will fail.

## Running locally

See [`README.md`](./README.md#quickstart).

## Pull request checklist

- [ ] CI green (lint, type-check, test, audit)
- [ ] New behavior covered by tests
- [ ] No secrets, keys, or env files staged
- [ ] Updated docs (README, SECURITY) if behavior changed
- [ ] Conventional-commit PR title
