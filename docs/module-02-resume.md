# Module 02 — Resume Guide

**Current state:** Phase 7 of 18 complete (2026-04-20). Branch `main`. All commits pushed? Check `git log origin/main..HEAD` — push before starting a new session.

**Resume from:** Phase 8 (Guards + decorators + PermissionResolver).

---

## TL;DR for the next session

Open a fresh Claude Code session in `/Users/muratbeyhan/Desktop/meta_ad_tools` and paste the prompt at the bottom of this file. It re-briefs the model with:
- what's done
- what's committed and where
- the 11 decisions already locked (do NOT re-debate them)
- the 11 remaining phases
- exit criteria (DoD sweep + push)

---

## What shipped already

Full detail in `PROGRESS.md`. Highlights:

- **Prisma migration `20260419204131_auth_user_session_org`** — users, organizations, workspaces, memberships, permissions, role_permissions, sessions, invitations, audit_logs. `deletedAt` present on User/Organization/Workspace. Run `pnpm db:migrate` on a fresh DB to apply.
- **Seed** populates 41 permissions + 144 role-permission rows. Run `pnpm db:seed` after migrate. Idempotent.
- **`@metaflow/shared-types`** exports Zod schemas + TS types for every request/response Module 02 needs (auth, user, org, workspace, invitation, session, permission, audit). Frontend + backend import the same schemas.
- **Config** extended with `auth.*`, `mfa.*`, `email.*`, `cookies.*` sub-objects. All 32-byte base64 secrets validated by Joi.
- **Auth primitives** (`apps/api/src/auth/services/`):
  - `PasswordService` — bcrypt hash/compare + zxcvbn-ts strength validation with user-specific penalties (email local part, name substrings).
  - `TokenService` — HS256 access JWT (15m), HS256 MFA setup/challenge JWT (5m, separate secret), 48-byte opaque token generator, SHA-256 hasher.
  - `MfaService` — otplib TOTP (window 1), QR data URL, 10 XXXXX-XXXXX Crockford-base32 backup codes (bcrypt-hashed).
  - `SessionService` — creates sessions with SHA-256 refresh hashes, `rotate()` detects theft and revokes all; `touch`, `revoke`, `revokeAllForUser(except?)`, `listForUser`, `isActive`.
  - `AuditService` — BullMQ producer for audit-queue (fail-safe via @Optional).
  - `AuthRateLimitService` — Redis INCR + EXPIRE helper for auth-specific counters.
- **Queues**: audit-queue writes `AuditLog` rows; email-queue sends via Resend OR dumps rendered HTML + link to `tmp/mail/*.json` (dev fallback for e2e); session-cleanup `@Cron(EVERY_HOUR)`.
- **Rate limiting**: `ThrottlerGuard` backed by Redis storage via `@nest-lab/throttler-storage-redis` (URL-based, no RedisService lifecycle dependency). Custom per-route trackers deferred to Phase 9.

### Unit tests green: 43

Module 01 (13) + password(5) + token(5) + mfa(7).

---

## Decisions already locked (do NOT redebate)

1. Hashing: **bcrypt** for password + backup codes; **SHA-256** for refresh, email-verify, password-reset, invitation tokens (all 256-bit random).
2. Email dev flow: Resend test key if available, else `tmp/mail/*.json` dump.
3. Refresh cookie path: `/api/auth`.
4. Password strength: `@zxcvbn-ts/core` 3.x.
5. Access token on frontend: in-memory Zustand (no localStorage).
6. OpenAPI: `@nestjs/swagger` with CLI plugin.
7. DTOs: `class-validator` on API side; Zod schemas shared with frontend.
8. Reserved slugs: spec list + `status, health, login, logout, invite, signup, register, verify-email, forgot-password, reset-password, mfa, public, assets, static`.
9. Seed: `pnpm db:seed` script (not migration-time).
10. Audit metadata: `{ reason?, ip?, userAgent?, meta? }` — `login.failed` reasons: `wrong_password | user_not_found | locked | unverified_email | mfa_required`.
11. Backup codes: 10 codes of `XXXXX-XXXXX` Crockford base32.

---

## Remaining 11 phases

Each is independently committable. Same Conventional Commits cadence as Module 01.

### Phase 8 — Guards + decorators + PermissionResolver

**Files:**
- `apps/api/src/auth/strategies/{jwt,jwt-refresh,local}.strategy.ts`
- `apps/api/src/auth/guards/{jwt-auth,jwt-refresh,email-verified,workspace-access,permission}.guard.ts`
- `apps/api/src/auth/decorators/{current-user,current-session,current-workspace,public,require-permission}.decorator.ts`
- `apps/api/src/permissions/{permissions.module,permission-resolver.service}.ts`
- `apps/api/src/auth/services/permission-resolver.spec.ts` (≥6 tests: inheritance, owner override, viewer denies, cache hit)

**Key points:**
- JwtStrategy: Bearer from header OR `metaflow_access` cookie. Redis blacklist check on JTI (`access_blacklist:<jti>`) → 401.
- WorkspaceAccessGuard: resolves `:workspaceSlug` → Workspace + Membership; ORG_OWNER implicit WS_ADMIN.
- PermissionGuard: reads `@RequirePermission('key')`, scope from prefix, calls PermissionResolver.
- PermissionResolver: Redis cache `perm:<userId>:<orgId>:<workspaceId?>` TTL 60s, invalidated on role-change writes.
- Guards order: JwtAuthGuard → WorkspaceAccessGuard → PermissionGuard.

**Commit:** `feat(api): add auth guards, permission resolver, and decorators`

### Phase 9 — Auth controller

**Endpoints (12):**
- POST /api/auth/register — creates Org+Workspace+OWNER OR accepts invitationToken atomically
- POST /api/auth/login — returns discriminated union (success | mfa_challenge | mfa_setup_required)
- GET /api/auth/mfa/setup/init — stores secret in Redis 5min, returns QR
- POST /api/auth/mfa/setup — verifies TOTP, persists encrypted secret + backup codes
- POST /api/auth/mfa/verify — TOTP OR backup code; 5 failed → lockout
- POST /api/auth/refresh — rotation with theft detection
- POST /api/auth/logout — blacklist JTI + revoke session
- POST /api/auth/logout-all
- POST /api/auth/email/verify
- POST /api/auth/email/resend-verification
- POST /api/auth/password/forgot — enumeration-safe
- POST /api/auth/password/reset — revoke all sessions
- POST /api/auth/password/change — revoke all except current

**Cross-cutting:**
- Global `RequireCustomHeaderGuard` on state-changing `/auth/*` routes: `X-Requested-With: metaflow-web`.
- `@Throttle({ default: { limit: N, ttl: ms } })` per route; email/user/session trackers via named throttlers in the ThrottlerModule config.
- Register creates Org+Workspace in a single Prisma `$transaction`. Slug generated from fullName if missing; collision-safe loop.
- `cookie-parser` middleware added to `main.ts`.
- `ApiResponse<T>` wrapping via global interceptor (new file `apps/api/src/common/interceptors/api-response.interceptor.ts`).

**Commit:** `feat(api): add auth controller with register, login, mfa, refresh, password flows`

### Phase 10 — Users/Orgs/Workspaces/Invitations/Sessions controllers

**Files:** per spec. Last-admin guard in `organizations.service.ts` for OWNER demotion/removal. Reserved-slug validator on `createWorkspaceRequestSchema`. `@RequirePermission('workspace:create')` on create, `@RequirePermission('member:invite')` on invite. `DELETE /auth/sessions/:id` 400 on current session.

**Commit:** `feat(api): add users, organizations, workspaces, invitations, sessions endpoints`

### Phase 11 — React Email templates

**Files under `apps/api/src/email/templates/`:**
- `verify-email.tsx`
- `password-reset.tsx`
- `invitation.tsx`
- `_shared/{layout,button,hero}.tsx`
- `i18n.ts` with `tr.json` + `en.json`

**Processor** already exists (`EmailProcessor`); replace the string-template stubs with React Email render. `@react-email/render` + `@react-email/components` already installed.

**Commit:** `feat(api): add react email templates and resend integration`

### Phase 12 — Frontend: api client, middleware gate, hooks, stores

**Files:**
- `apps/web/src/lib/api/client.ts` — fetch wrapper with auto-refresh (single-flight, concurrent 401 merge, `X-Requested-With: metaflow-web`).
- `apps/web/src/stores/use-auth-store.ts` — Zustand (not persisted).
- `apps/web/src/lib/auth/{session,use-auth,use-workspace,use-can,bootstrap}.ts(x)`.
- Extend existing `apps/web/src/middleware.ts` (CSP nonce) with auth gate: cookie-presence check (`metaflow_refresh`), redirect to `/login?redirect=…`.
- `apps/web/src/components/auth/auth-gate.tsx`.

**Commit:** `feat(web): add auth client, middleware gate, hooks, and stores`

### Phase 13 — Auth pages

**Files:**
- `apps/web/src/app/(auth)/{layout,login,register,verify-email,forgot-password,reset-password}/page.tsx` + `mfa/setup/page.tsx` + `mfa/verify/page.tsx`
- `apps/web/src/app/invite/accept/page.tsx`
- `apps/web/src/components/auth/{login-form,register-form,mfa-setup,mfa-verify,backup-codes-display,password-strength-meter}.tsx`
- shadcn add: `button, form, input, label, skeleton, dialog, dropdown-menu, alert, separator, toast` (or `sonner`)

RHF + `@hookform/resolvers/zod` bound to `@metaflow/shared-types` schemas. Backup codes: one-time reveal + download `.txt`.

**Commit:** `feat(web): add auth pages for login, register, mfa, password flows, invite accept`

### Phase 14 — App shell + settings + workspace routes

**Files:**
- `apps/web/src/app/(app)/{layout,page,settings/{profile,security,sessions,organization,members}/page.tsx}`
- `apps/web/src/app/(app)/w/[slug]/{layout,page,settings}/page.tsx`
- `apps/web/src/components/workspace/{workspace-switcher,invite-member-dialog}.tsx`
- Server-side `requirePermission('key', workspaceSlug?)` helper.

**Commit:** `feat(web): add app shell, settings, workspace routes, member management`

### Phase 15 — Integration tests (≥15 scenarios)

**Files:** `apps/api/test/integration/*.spec.ts`:
- auth-register-email-job
- auth-login-lockout-5-to-6
- auth-full-flow-register→verify→mfa-setup→login→verify→me
- auth-refresh-rotation + replay-revokes-all
- auth-logout-blacklist
- permission-viewer-denied
- workspace-nonmember-403
- invitation-accept-new-user + accept-existing-user
- password-reset-revokes-all-sessions
- password-change-revokes-all-except-current
- session-revoke
- rate-limit-login
- rate-limit-forgot
- org-owner-inherits-ws-admin
- last-admin-demotion-blocked

`testcontainers` starts pg:16 + redis:7. New vitest config `vitest.integration.config.ts` + `test:integration` script.

**Commit:** `test(api): add integration suite for auth, permissions, sessions, invitations`

### Phase 16 — Playwright e2e (4)

**Files:** `apps/web/tests/e2e/{signup-mfa-login,invitation-flow,password-reset,session-revoke}.spec.ts` + `helpers/{mailbox,totp}.ts`.

Mailbox helper tails `tmp/mail/` to extract verify/reset/invitation tokens. TOTP helper uses otplib.

**Commit:** `test(web): add playwright e2e for signup, invitation, password reset, sessions`

### Phase 17 — OpenAPI/Swagger

- `apps/api/src/main.ts` — `SwaggerModule.setup('/api/docs', …)` behind `NODE_ENV !== 'production'`.
- `nest-cli.json` — enable `@nestjs/swagger` CLI plugin.
- DocumentBuilder with `bearer` + `refreshCookie` security schemes.
- Controllers annotated with `@ApiTags`, `@ApiOperation`, `@ApiResponse`.

**Commit:** `feat(api): add openapi/swagger docs for all module 02 endpoints`

### Phase 18 — CI updates + docs

- `.github/workflows/ci.yml`: add `integration-tests` job (pg + redis service containers, `pnpm test:integration`) + `e2e-tests` job.
- `README.md`: add `pnpm db:seed` step to quickstart.
- `PROGRESS.md`: move Module 02 from ⏸ PAUSED to ✅ Complete, append commit table.
- `docs/module-03-handoff.md`: Meta OAuth + BISU token notes (CryptoService, SessionService, AuditLog, PermissionGuard `bisu:connect|rotate|disconnect` keys already seeded).

**Commit:** `docs(repo): module 02 progress report, module 03 handoff, ci updates`

---

## DoD exit gate (run before declaring DONE)

```bash
pnpm lint                                                    # 0 errors, 0 warnings
pnpm type-check                                              # 0 errors
pnpm test                                                    # all unit tests green
pnpm --filter @metaflow/api test:integration                 # ≥15 green
pnpm --filter @metaflow/web test:e2e -- --project=chromium   # ≥1 scenario green
pnpm build                                                   # api + web build
pnpm audit --audit-level=high --prod                         # no high/critical
```

Then manual curl walk: register → email-verify from tmp/mail → MFA setup → login (mfa_challenge step) → verify → `/users/me` → logout → refresh returns 401.

Push to `origin/main`.

---

## New-session resume prompt

Paste this verbatim into a fresh Claude Code session (started in `/Users/muratbeyhan/Desktop/meta_ad_tools`):

```
Module 02 — Auth & User Management. Phase 8–18.

Durum: Phase 7/18 tamam. Spec: docs/02-auth-user-management.md (full).
Resume rehberi: docs/module-02-resume.md (phase listesi, locked kararlar, DoD).

Komut:
1. PROGRESS.md ve docs/module-02-resume.md oku.
2. git log --oneline origin/main..HEAD ile unpushed commit varsa durumu raporla.
3. pnpm install && docker compose -f infra/docker-compose.yml up -d postgres redis
4. Phase 8'den başla. Her phase atomic commit, Conventional Commits (scope enum'u commitlint.config.cjs'te).
5. Plan agent'a ihtiyaç yok — resume doc'ta her phase'in file listesi ve commit message'ı var.
6. Phase 18'de PROGRESS.md güncelle (Module 02 ✅ Complete), docs/module-03-handoff.md yaz, push.

Locked kararları değiştirme (resume doc'ta madde madde):
- Hashing: bcrypt password+backup, SHA-256 rastgele token
- Email: Resend key varsa kullan, yoksa tmp/mail dump
- Refresh cookie path=/api/auth
- Access token in-memory Zustand
- OpenAPI: @nestjs/swagger
- DTOs: class-validator
- Reserved slugs listesi sabit
- Backup codes XXXXX-XXXXX Crockford base32

Kurallar (Module 01-02 disiplin):
- TS strict, any yok
- Her async'te error handling
- Env @nestjs/config + Joi
- Password/token asla log'a (Pino redact)
- Rate limit her kritik endpoint'te
- Her security event audit.record()

"DONE: Module 02" demeden önce DoD sweep (resume doc sonunda).
```

That's it — the new session has everything it needs.
