# Module 02 — handoff notes

Everything Module 02 (Auth & User Management) needs on top of the Module 01 bootstrap.

## What's already wired

| Primitive                       | Where                                              | Notes |
|---------------------------------|----------------------------------------------------|-------|
| AES-256-GCM encrypt/decrypt     | `apps/api/src/crypto/crypto.service.ts`            | Versioned `v1.` prefix, 12-byte IV, optional AAD. Use for OAuth/Meta token storage. |
| Constant-time equality          | `CryptoService.constantTimeEquals`                 | For CSRF / webhook signature comparison. |
| Prisma client (lifecycle aware) | `apps/api/src/prisma/prisma.service.ts`            | Extend PrismaService with repository classes. |
| Redis client + timeout-aware ping| `apps/api/src/redis/redis.service.ts`              | Use for session cache, rate-limit counters. |
| Passport module skeleton        | `apps/api/src/auth/auth.module.ts`                 | Registered with default strategy `jwt`. Add concrete `JwtStrategy` / `LocalStrategy` here. |
| BullMQ connection factory       | `apps/api/src/queue/queue.module.ts`               | `bullConnectionFactory` is injectable; `BullModule.forRootAsync({ useFactory: …, inject: [ConfigService] })`. |
| Global throttler guard          | `apps/api/src/app.module.ts` (APP_GUARD)           | Per-route `@Throttle({ default: { limit, ttl } })` works. `@SkipThrottle()` on health. |
| Global validation pipe          | `apps/api/src/main.ts`                             | `forbidNonWhitelisted` on. DTOs must be class-validator decorated. |
| Global exception filter         | `apps/api/src/common/filters/global-exception.filter.ts` | Uniform `{success, error:{code,message,details}}`. Throw `HttpException` with snake_case `error` to customise `code`. |
| Request-ID logger               | `apps/api/src/common/logging/logger.module.ts`     | `x-request-id` propagates through Pino child loggers. |
| Shared types barrel             | `packages/shared-types/src/index.ts`               | Add `user.ts`, `session.ts` next to `health.ts` / `common.ts`. |
| Zod schemas in shared-types     | same                                               | Frontend + backend import identical contracts. |
| shadcn/ui primitives            | `apps/web/src/components/ui/{card,badge}.tsx`      | Add `button`, `form`, `input`, `label`, `skeleton`, `dialog` via shadcn CLI. |
| TanStack Query provider         | `apps/web/src/app/providers.tsx`                   | Already global; wrap mutations for login/logout here. |
| Zustand store                   | `apps/web/src/stores/use-ui-store.ts`              | Add `use-auth-store.ts` for current user, or keep auth in TanStack cache. |

## Files you will touch / create

### Database

- `packages/database/prisma/schema.prisma` — add `User`, `Session`, `Account`, `VerificationToken` (if NextAuth), `Organization`, `Membership`, `Workspace`, `Invitation`. Keep the existing `HealthCheck`.
- New migration: `pnpm db:migrate --name auth_user_session_org`.

### API

- `apps/api/src/auth/` — `jwt.strategy.ts`, `auth.service.ts`, `auth.controller.ts`, DTOs, guards.
- `apps/api/src/user/` — repository + service, exposed via controller for profile reads.
- `apps/api/src/org/` — organization + membership endpoints.
- `apps/api/src/app.module.ts` — already imports `AuthModule`; you may need to register `UserModule` and `OrgModule`.

### Web

- `apps/web/src/app/(auth)/` — route group: `login/`, `signup/`, `verify/`, `reset/`.
- `apps/web/src/middleware.ts` — extend current CSP-nonce middleware with session-cookie-based route protection (allowlist public routes, redirect unauthenticated requests to `/login`).
- `apps/web/src/lib/auth.ts` — NextAuth v5 config OR Clerk client, whichever you pick.
- `apps/web/src/app/layout.tsx` — wrap `Providers` with a `SessionProvider` (NextAuth) or `<ClerkProvider>`.

### Infra

- `.env.example` already has `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `JWT_SECRET`. If you pick Clerk, replace with `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`.

## Open decisions for Module 02 kickoff

1. **NextAuth v5 vs Clerk.** Recommended: NextAuth v5 with the Prisma adapter, so all user data stays in your own Postgres (compliance-friendly, no vendor data sync). Clerk is faster to ship but adds a hard dependency and data lives at Clerk.
2. **Session storage.** If NextAuth: `strategy: 'database'` (rows in `sessions`) or `'jwt'` (stateless). DB-backed is easier to revoke but hits the DB on every request. Recommended: start with `'database'` to keep the audit trail.
3. **First BullMQ job.** `expireStaleSessions` every 15 minutes is the natural Module 02 smoke test.
4. **Password reset transport.** Resend is already in `.env.example`. Wire it in Module 03 (Notifications) unless you want a minimal reset flow in Module 02.

## Smoke tests to add

- Integration: `POST /auth/login` with valid creds → 200 + cookie set; invalid creds → 401.
- Integration: `GET /user/me` without session → 401; with session → 200 + PII scrubbed body.
- E2E (Playwright): sign up → verify → log in → log out. Gate on CI.

## Don't regress

- Keep CSP `strict-dynamic` — don't add `unsafe-inline`. If a library needs inline scripts, switch to its data-attribute API or load through `next/script` with `strategy="afterInteractive"`.
- Don't stuff user emails into Sentry contexts. `sendDefaultPii: false` and the `beforeSend` scrubber are the canonical path.
- Never write a `.env` file into the repo. `setup.sh` generates secrets locally; CI uses GitHub environment secrets.
- Throttler stays global. If you need to relax it for a hot path (e.g. `/auth/login`), use `@Throttle` with a tighter limit — do not `@SkipThrottle`.
