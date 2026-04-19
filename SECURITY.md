# Security policy

## Reporting a vulnerability

Email **security@metaflow.app** with a description and, if possible, a proof of
concept. Please do not open public GitHub issues for security reports.

We aim to acknowledge within 48 hours and ship a fix or mitigation within 7
days for critical findings.

## Baseline security posture (Module 01)

### Authentication & authorization

- No auth surface is exposed yet — Module 02 ships NextAuth / Clerk and
  Passport strategies.
- Crypto service (AES-256-GCM, versioned ciphertext prefix) is wired and unit
  tested so it is ready for Meta BISU token storage in Module 04.

### Secrets management

- `.env*` is gitignored; only `.env.example` with `CHANGEME_` placeholders is
  tracked.
- `ENCRYPTION_KEY` is 32 raw bytes base64-encoded; `@nestjs/config` Joi schema
  rejects any other length at startup.
- GitHub Actions pin third-party actions by commit SHA to mitigate
  supply-chain attacks.

### Transport & headers

- Nest API sets Helmet defaults plus HSTS `max-age=15552000; includeSubDomains;
  preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Next.js `middleware.ts` emits a per-request CSP nonce
  (`script-src 'self' 'nonce-<>' 'strict-dynamic'`) — no `unsafe-inline`.
- CORS on the API restricts origins to `CORS_ORIGINS` allowlist.

### Input validation

- `class-validator` + `class-transformer` via a global `ValidationPipe` with
  `transform`, `whitelist`, and `forbidNonWhitelisted`.
- Body size cap of `10mb`.
- `@nestjs/throttler` rate-limits all routes (100 req / 60s default).

### Logging

- `nestjs-pino` with redact paths for `req.headers.authorization`,
  `req.headers.cookie`, `*.password`, `*.token`, `*.apiKey`.
- Request-ID correlation header (`x-request-id`) propagates across logs.
- Sentry captures errors only (no tracing in Module 01) with PII scrubbing
  in `beforeSend`.

### Dependency hygiene

- CI runs `pnpm audit --audit-level=high --prod` on every PR — build fails on
  HIGH or CRITICAL findings.
- Dependabot sends weekly PRs for npm, docker, and GitHub Actions updates.
- CodeQL runs weekly on JS/TS.

### Container security

- Multi-stage Dockerfiles rooted at `node:20-alpine`.
- Final stage runs as non-root (`USER nestjs` / `USER nextjs`, UID 1001).
- Trivy scans every image in CI before push to GHCR.

## Known limitations (accepted for Module 01)

- No WAF in front of Nginx yet — track in Module 06 (Infra Hardening).
- No Dependabot alerts triage rotation — ownership assigned in Module 02.
