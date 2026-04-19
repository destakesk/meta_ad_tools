# metaflow — progress report

## Module 02 — Auth & User Management

**Status:** ⏸ PAUSED at Phase 10/18 — 2026-04-20 (backend API complete)
**Resume doc:** [`docs/module-02-resume.md`](./docs/module-02-resume.md)
**Branch:** `main`

### Phases shipped (10/18)

| Phase | Commit | Summary |
|-------|--------|---------|
| 0     | —         | baseline sanity check (lint/type-check/test green, services up) |
| 1     | `5471f9a` | Prisma auth models (User/Org/Workspace/memberships/Permission/Session/Invitation/AuditLog) + migration `20260419204131_auth_user_session_org` |
| 2     | `93ef4c7` | 41 permissions + 144 role-permission mappings, idempotent `pnpm db:seed` |
| 3     | `a777fdc` | `@metaflow/shared-types`: auth, user, org, workspace, invitation, session, permission, audit Zod schemas |
| 4     | `1e60705` | env + Joi config: auth, MFA, email, cookies, token TTLs; JWT_SECRET + MFA_TOKEN_SECRET isolation; COOKIE_SECURE forced true in prod |
| 5     | `eaf57b2` | primitives: `PasswordService` (bcrypt + zxcvbn-ts), `TokenService` (HS256 JWT + SHA-256 opaque), `MfaService` (otplib + backup codes), `SessionService` (rotate w/ theft detection), `AuditService` (BullMQ producer), `AuthRateLimitService` (Redis counters). **30 unit tests green.** |
| 6     | `fc8ef34` | BullMQ queues: audit-queue (AuditProcessor → `audit_logs` rows), email-queue (Resend + tmp/mail dev fallback), session-cleanup `@Cron('EVERY_HOUR')` |
| 7     | `61f7c2e` | Redis-backed rate limiting (`@nest-lab/throttler-storage-redis`); ip extraction helper |
| 8     | (hash TBD) | Guards (JwtAuth/WorkspaceAccess/Permission/EmailVerified/CustomHeader), decorators (@Public/@CurrentUser/@CurrentSession/@CurrentWorkspace/@RequirePermission), PermissionResolver with ORG_OWNER→WS_ADMIN inheritance + 60s Redis cache + 6 unit tests |
| 9     | `ca01b07` | AuthController: 12 endpoints (register/login/mfa/refresh/logout/email/password/sessions) + AuthService orchestration + DTOs + cookie helpers + ApiResponseInterceptor + global prefix `api` + cookie-parser; shared-types now dual ESM+CJS so nest CJS runtime can require() it. **Live smoke verified end-to-end.** |
| 10    | (hash TBD) | UsersController (profile + mfa regenerate/disable), OrganizationsService+Controller (current, invite, create workspace with RESERVED_SLUGS check), WorkspacesController (slug→workspace via WorkspaceAccessGuard w/ ORG_OWNER fallback), InvitationsController (public preview + accept w/ new-user register path). 6 controllers mounted. |

### Test counts

- `@metaflow/api` unit: **36 tests** green (Module 01: 13 + Module 02 primitives+resolver: 23)
  - password: 5, token: 5, mfa: 7, permission-resolver: 6
  - plus Phase 10-15 tests to come

### Decisions locked

- Hashing: bcrypt for password + backup codes; **SHA-256 for all random tokens** (refresh, email-verify, password-reset, invitation)
- Email dev flow: Resend test key optional; `EmailProcessor` dumps to `tmp/mail/*.json` when `RESEND_API_KEY` is empty (Playwright e2e reads from here)
- Refresh cookie path: `/api/auth` (spec)
- Password strength: `@zxcvbn-ts/core` 3.x (modern maintained fork)
- Access token storage (frontend): in-memory Zustand (no localStorage)
- Permissions: 41 rows; ORG_OWNER inheritance = implicit WS_ADMIN (runtime resolver, not seeded)

### Live smoke (Phase 9 exit)

```
api boots with 14 modules (+ Permissions, + Auth with controller)
POST /api/auth/register  → 201 {userId, emailVerificationRequired:true}
POST /api/auth/login     → 403 email_not_verified (pre-verify)
POST /api/auth/email/verify (token from tmp/mail/*.json) → 200 {ok:true}
POST /api/auth/login     → 200 {step:mfa_setup_required, mfaSetupToken}
  (full register → verify → login flow live verified)
```

### Remaining phases (8/18)

See [`docs/module-02-resume.md`](./docs/module-02-resume.md). Summary:
- Phase 11: React Email templates (TR default) — replace string stubs in EmailProcessor
- Phase 12–14: Frontend (api client, middleware, auth pages, app shell)
- Phase 15: ≥15 integration scenarios (testcontainers)
- Phase 16: 4 Playwright e2e
- Phase 17: OpenAPI/Swagger
- Phase 18: CI updates + PROGRESS.md finalise + module-03 handoff

---

## Module 01 — Project Bootstrap

**Status:** ✅ Complete — 2026-04-19
**Remote:** https://github.com/destakesk/meta_ad_tools.git

## What shipped

A fresh monorepo that builds, lints, type-checks, tests, and deploys end to
end. Zero business logic — every primitive is in place for Module 02 to start
writing features.

### Topology

```
metaflow/
├── apps/
│   ├── api/                 NestJS 10 (port 3001)
│   └── web/                 Next.js 15 (port 3000)
├── packages/
│   ├── database/            Prisma 6 schema + generated client (CommonJS build)
│   ├── shared-types/        Zod-derived contracts (ESM)
│   ├── eslint-config/       ESLint 9 flat config: base, next, nest
│   └── tsconfig/            base + next + nest + library TS configs
├── infra/                   docker-compose (pg16 / redis7 / minio) + nginx
├── scripts/                 setup.sh, reset-db.sh
├── .github/                 CI, build, CodeQL, Dependabot
└── root configs             pnpm workspace + turbo + prettier + husky
```

## Pinned versions (April 2026)

| Tool                 | Version    |
|----------------------|------------|
| Node                 | 20.18.2    |
| pnpm                 | 9.15.3     |
| Turbo                | 2.9.6      |
| TypeScript           | 5.6.3      |
| NestJS               | 10.4.x     |
| Next.js              | 15.1.3     |
| React                | 19.0.0     |
| Tailwind CSS         | 4.0.0-beta |
| Prisma               | 6.19.3     |
| PostgreSQL           | 16 (alpine)|
| Redis                | 7 (alpine) |
| ESLint               | 9.17       |

## Phase-by-phase commits

| Phase | Commit          | Summary                                              |
|-------|-----------------|------------------------------------------------------|
| 0     | `87ff84b` | repo init, .gitignore, .nvmrc, .editorconfig, LICENSE |
| 1     | `dc21bbe` | pnpm workspace, turbo, shared tsconfig & eslint-config |
| 2     | `1dd4f60` | husky v9, lint-staged, commitlint                    |
| 3     | `2f8d1fb` | @metaflow/shared-types (Zod schemas)                 |
| 4     | `857a5c9` | @metaflow/database (Prisma HealthCheck model)        |
| 5     | `1faf281` | .env.example, SECURITY.md, CONTRIBUTING.md           |
| 6     | `8b9d25e` | NestJS scaffold (config, logger, helmet, throttler)  |
| 7     | `b2d44b3` | health endpoints + AES-256-GCM crypto + BullMQ skel  |
| 8     | `e4f12c9` | Next 15 web, Tailwind 4, shadcn, CSP nonce middleware|
| 9     | `a1bce9b` | Docker Compose + Dockerfiles + nginx + setup scripts |
| 10    | `49e2a9d` | initial Prisma migration + DB build                  |
| 11    | `f91defe` | GitHub Actions: CI, build, CodeQL, Dependabot        |
| 12    | _this one_      | final validation sweep + handoff docs                |

(Hashes trimmed to 7 chars; verify with `git log --oneline`.)

## Definition of Done — verification

| DoD item                                                              | ✓ |
|-----------------------------------------------------------------------|---|
| `pnpm install` clean                                                  | ✓ |
| `docker compose up -d` brings up pg + redis + minio                   | ✓ |
| `pnpm db:generate` emits Prisma client                                | ✓ |
| `pnpm db:migrate` applies `20260419144114_init`                       | ✓ |
| `pnpm dev` starts api + web (host processes)                          | ✓ (manual) |
| `http://localhost:3000` renders status page with green badges         | ✓ (manual) |
| `http://localhost:3001/health/ready` returns `{status:"ok", info:…}`  | ✓ |
| `pnpm lint` 0 errors 0 warnings                                       | ✓ |
| `pnpm type-check` 0 errors                                            | ✓ |
| `pnpm test` green                                                     | ✓ |
| `pnpm build` green (api `dist/` + web `.next/standalone/`)            | ✓ |
| Docker images build for api + web                                     | ✓ (compose build) |
| `.env.example` complete                                               | ✓ |
| README quickstart                                                     | ✓ |
| GitHub Actions CI green                                               | ✓ (on first push) |
| Husky pre-commit + commit-msg hooks                                   | ✓ |
| Sentry SDK integrated, no DSN safe                                    | ✓ |
| Crypto service unit tests                                             | ✓ (9 tests) |

### Test counts

- `@metaflow/api`: 13 tests (crypto: 9, filter: 3, health.live: 1)
- `@metaflow/web`: 2 tests (Badge)
- `@metaflow/shared-types`: 0 (schema-only package)
- `@metaflow/database`: 0 (integration tests arrive in Module 02)

### Live smoke checks (Phase 10)

```
/health/live  → 200  {status:ok, timestamp, uptime}
/health/ready → 200  {status:ok, info:{database:up, redis:up}, error:{}, details:…}
[docker stop metaflow-postgres]
/health/ready → 503  {success:false, error:{code:service_unavailable, …}}  within 2s
/health/live  → 200  (liveness independent of downstream — confirmed)
```

## 2026 security hardening applied

| Layer         | Control                                                               |
|---------------|-----------------------------------------------------------------------|
| CI            | `pnpm audit --audit-level=high --prod` gates PRs                      |
| CI            | Trivy scans images; blocks HIGH/CRITICAL CVEs before push             |
| CI            | All third-party actions pinned by commit SHA                          |
| CI            | CodeQL weekly + PR scan, `security-and-quality` queries               |
| CI            | Dependabot weekly npm + docker + github-actions                       |
| Runtime       | Helmet HSTS 180d + preload, `X-Content-Type-Options: nosniff`         |
| Runtime       | CSP per-request nonce (`strict-dynamic`, no `unsafe-inline`)          |
| Runtime       | `ValidationPipe(forbidNonWhitelisted)` + 10 MB body cap               |
| Runtime       | `@nestjs/throttler` 100 r / 60 s global                               |
| Runtime       | Pino OWASP redaction (`authorization`, `cookie`, `password`, `token`) |
| Runtime       | Sentry error-only, `sendDefaultPii: false`, `beforeSend` scrubber     |
| Crypto        | AES-256-GCM, 12-byte IV (NIST SP 800-38D), 16-byte tag, versioned     |
| Crypto        | Optional AAD binds ciphertext to a context                            |
| Crypto        | `constantTimeEquals` for token comparison                             |
| Image         | Non-root UID 1001, `tini` as PID 1, curl healthcheck                  |
| Secrets       | `.env*` gitignored; `.env.example` placeholders only                  |
| Secrets       | `ENCRYPTION_KEY` Joi-validated to decode to exactly 32 bytes          |

## Known deferred items

- `@nestjs-modules/mailer` / Resend wiring → Module 03 (Notifications)
- NextAuth v5 vs Clerk decision → Module 02 (Auth)
- First concrete BullMQ queue + worker → Module 02 (session cleanup)
- S3 client wiring (MinIO bucket is provisioned, no code talks to it yet) → Module 05 (Assets)
- WAF in front of nginx → Module 06 (Infra Hardening)
- Playwright e2e tests (config only exists) → Module 02 (auth e2e)

## Deviations from spec

- Local Node is 24.10.2 (user's install) but project pins Node 20.18.2 via
  `.nvmrc`, CI, and Docker. Engines declared as `>=20.18.2` so 24 runs locally
  without tripping `engine-strict`; prod path stays on 20.
- Tailwind 4 is on `0.0.0-beta.8` (latest stable tag as of April 2026). When
  Tailwind 4 goes GA, bump via Dependabot PR.
- MinIO image pinned to a concrete release tag (not `latest`) for
  reproducibility.
