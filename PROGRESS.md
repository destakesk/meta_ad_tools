# metaflow — progress report

## Module 05 — Campaign writes

**Status:** ✅ Complete — 2026-04-20
**Branch:** `main`
**Module 06 handoff:** [`docs/module-06-handoff.md`](./docs/module-06-handoff.md)

### Phases shipped (7/7)

| Phase | Summary |
|-------|---------|
| 0 | Sanity: lint + 33 integration tests green; mock campaign store already in place from module 04. |
| 1 | shared-types gains `CreateCampaignRequest` / `UpdateCampaignRequest`. Create enforces "exactly one of dailyBudget / lifetimeBudget" via zod refinement. Three new audit actions: `campaign.created / .updated / .deleted`. |
| 2 | `MetaApiClient` extended with `createCampaign / updateCampaign / deleteCampaign`. Mock implementation switched to a stateful `Map<adAccountId, snapshots[]>` so writes flow into subsequent reads. Real binding calls Graph with `POST /{adAccountId}/campaigns` for create + `POST /{metaCampaignId}` for update + `DELETE /{metaCampaignId}` for delete, then re-fetches the snapshot. |
| 3 | `CampaignsService.create / update / delete`. Shared `loadContext(workspaceId, adAccountId)` helper handles Meta connection lookup + token decryption + ad-account scoping. Create enforces the "exactly one budget" invariant server-side too. Each write emits `campaign.created / .updated / .deleted` audit events. |
| 4 | `CampaignsController` gains POST (create), PATCH :id (update), DELETE :id (delete). Permissions: `campaign:write` for create + update, `campaign:delete` for delete — a workspace manager can edit but not destroy, consistent with the Module 02 role/permission seed. class-validator DTOs enforce shape at the HTTP boundary. |
| 5 | Frontend CRUD: `CreateCampaignDialog` on the campaigns list (gated by `useCan('campaign:write')`, pulls ad-accounts from the active connection). Campaign detail page grows "Düzenle" (name + status) and "Sil" buttons, each gated by its permission. Delete navigates back to the list on success. |
| 6 | Integration suite: `apps/api/test/integration/campaign-crud.spec.ts` — create → list round-trip, reject-no-budget validation, update mutates name + status, delete flips DELETED, cross-workspace id isolation. **Total integration suite: 38 tests across 13 files.** per-test-setup now resets the mock-provider store so writes don't leak across tests. |
| 7 | PROGRESS.md ✅. `docs/module-06-handoff.md` written. |

### Test counts

- `@metaflow/api` integration: **38 tests** across 13 files (22 module 02 + 6 module 03 + 5 module 04 + 5 module 05)

### Decisions locked

1. **Budgets validated twice.** Zod schema forbids "both set" / "neither set" at the boundary; `CampaignsService.create` re-validates the same invariant. Belt-and-braces because the UI can be bypassed.
2. **`campaign:delete` is a distinct permission.** Write + delete are split so WS_MANAGER can edit but not destroy. The UI's `useCan('campaign:delete')` gates the delete button; the server's `PermissionGuard` enforces it.
3. **Create flow respects PAUSED default.** The Create dialog defaults status to `PAUSED` so a misclicked launch doesn't accidentally spend money. Users must consciously flip to ACTIVE.
4. **Real-provider create does a follow-up fetch.** Graph's `POST /campaigns` returns only the new id; we follow with a GET for the full snapshot so the caller always gets a complete row. Matches the upsert-on-sync pattern from Module 04.
5. **Mock store resets per-test.** Added `__resetMockCampaignStore` + `afterEach` hook. Writes in one test can no longer leak into the next.
6. **Update schema allows null to clear fields.** `endTime: null` clears the field; `endTime` omitted leaves it alone. Same for budgets — matches Meta's own "pass empty string to clear" pattern.

---

## Module 04 — Campaigns + Insights

**Status:** ✅ Complete — 2026-04-20
**Branch:** `main`
**Module 05 handoff:** [`docs/module-05-handoff.md`](./docs/module-05-handoff.md)

### Phases shipped (10/10)

| Phase | Summary |
|-------|---------|
| 0 | Sanity: lint/type-check/test green; admin user from module 02 testing still present; mock Meta connection works. |
| 1 | Prisma `Campaign` + `MetaInsightSnapshot` models + `CampaignStatus` enum. Budgets + spend in integer minor units (BigInt). `(adAccountId, metaCampaignId)` unique; `(campaignId, date)` unique on snapshots for idempotent re-syncs. Migration `20260420090509_campaigns_insights_module_04` applied. |
| 2 | `@metaflow/shared-types`: Campaign / InsightRow / CampaignListResponse / InsightListResponse / InsightSyncRequest / CampaignSyncResponse. BigInt travels as regex-validated string. Two new audit actions: `campaign.synced`, `insights.fetched`. |
| 3 | `MetaApiClient` extended with `fetchCampaigns` + `fetchInsights` on both implementations. Mock returns 2 campaigns per ad account + deterministic per-day insight rows (seed from campaign id hash). Real binding calls `/{ad_account}/campaigns` + `/{ad_account}/insights?level=campaign`, converts Graph's major-units spend to minor units. |
| 4 | `CampaignsService` — `syncFromMeta` (upserts all ad accounts' campaigns, marks stale rows DELETED), `listForWorkspace`, `getById`. Token decryption goes through `CryptoService` with workspace-scoped AAD; audit on every sync. |
| 5 | `InsightsService` — `syncForWorkspace(from, to)` pulls daily rows for ACTIVE + PAUSED campaigns and upserts `meta_insight_snapshots`. `listForWorkspace` aggregates totals over the range. Range validation (max 400 days, inverted rejected, ISO 8601 enforced). |
| 6 | `CampaignsController` (GET /campaigns, POST /campaigns/sync, GET /campaigns/:id, GET /campaigns/:id/insights) + `InsightsController` (GET /insights, POST /insights/sync). All workspace-scoped, gated by `campaign:read` and `insights:read` from the Module 02 seed. |
| 7 | Web: `/w/[slug]/campaigns` list with manual sync + empty state linking to Meta connection. `/w/[slug]/campaigns/[id]` detail with last-14-days performance preview. Topbar gains Kampanyalar + İçgörüler links when inside a workspace. |
| 8 | Web: `/w/[slug]/insights` with date-range picker + Meta sync button + totals + per-row table joined with campaign names/currencies. `lib/format.ts` shared BigInt-safe integer + currency + percent formatters. |
| 9 | Integration tests (`apps/api/test/integration/campaigns.spec.ts`, 5 tests): sync inserts 2×2 campaigns, insights sync + list round-trip matches row sums, missing-connection rejection, range validation, cross-workspace isolation. **Total integration suite: 33 tests across 12 files.** |
| 10 | PROGRESS.md flipped to ✅. `docs/module-05-handoff.md` written. CI integration job automatically picks up the new spec. |

### Test counts

- `@metaflow/api` integration: **33 tests** across 12 files (22 module 02 + 6 module 03 + 5 module 04)
- Unit + web counts unchanged from module 02

### Decisions locked

1. **Budgets as BigInt minor units.** Every monetary column (`dailyBudgetCents`, `lifetimeBudgetCents`, `spendCents`, `cpmCents`) is `BigInt`. API serialises as BigInt-as-string so JSON round-trips don't lose precision on very-large-spend accounts.
2. **Upsert-on-sync, never delete.** A campaign that disappears from Meta flips to `DELETED` but stays in the DB so its historical insights remain attached. Same pattern for `meta_insight_snapshots` — re-syncing a range refreshes numbers in place.
3. **`insights:read` gates both campaigns.detail.insights AND the top-level /insights.** That way a workspace viewer with campaign:read but without insights:read gets campaign list + detail metadata but not performance numbers.
4. **Range cap 400 days.** Meta's own insight windows top out around 37 months; we cap at 400 days to make any accidental front-end submission (`from=2000-01-01`) return a clean error instead of a multi-minute Graph call.
5. **Per-campaign insights endpoint re-uses workspace-wide fetch + client-side filter.** Simpler than a separate query path; the workspace-wide fetch is already per-campaign granular. When data volumes grow we'll swap to a campaign-scoped query — noted as a perf TODO in `CampaignsController.campaignInsights`.
6. **Ad-account sync is a Module 03 concern.** Module 04's `campaigns/sync` assumes `ad_accounts` is already populated. The frontend empty state points users at `/w/<slug>/settings/meta` where the ad-account sync button lives.

---

## Module 03 — Meta Ads Connection

**Status:** ✅ Complete — 2026-04-20
**Branch:** `main`
**Module 04 handoff:** [`docs/module-04-handoff.md`](./docs/module-04-handoff.md)

### Phases shipped (8/8)

| Phase | Commit | Summary |
|-------|--------|---------|
| 0 | — | sanity: lint/type-check/test green; pg + redis services up; admin user from module 02 testing present |
| 1 | `f1995e4` | Prisma `MetaConnection` + `MetaAdAccount` models, `MetaConnectionStatus` enum, migration `20260420011928_meta_connection_module_03`. Tokens stored as AES-256-GCM ciphertext (`v1:` prefix); workspaceId is the AAD so a leaked row cannot be replayed against another tenant. |
| 2 | `534c563` | `@metaflow/shared-types`: meta connection schemas (status, response shapes, oauth init / callback) + 7 new audit actions covering oauth lifecycle + ad-accounts sync. |
| 3 | (in `500cf82`) | `MetaApiClient` interface + `MockMetaApiClient` (deterministic stub for dev/CI; authorize URL redirects right back at the callback) + `RealMetaApiClient` (graph.facebook.com binding, activated by `META_OAUTH_MODE=real`). |
| 4 | (in `500cf82`) | `MetaConnectionsService` with connect/get/rotate/disconnect + ad-accounts sync. Encrypted storage via `CryptoService` with workspace-scoped AAD; audit events on every mutation. |
| 5 | (in `500cf82`) | `MetaController` (workspace-scoped: GET, init, rotate, disconnect, ad-accounts sync/list) + `MetaCallbackController` (workspace-less callback that resolves workspace from redis state). OAuth state lives in redis with TTL; permission keys are the existing `bisu:connect / bisu:rotate / bisu:disconnect` from Module 02 seed. |
| 6 | `6aa1a55` | Web UI: `/w/[slug]/settings/meta` connection card + ad-accounts table; `/meta/callback` page that POSTs code+state to API and routes user back. New workspace settings sidebar (Genel / Meta bağlantısı). `useCan` gates each button. |
| 7 | (in `500cf82`) | 6 integration tests against the mock provider in `apps/api/test/integration/meta-connection.spec.ts`: full lifecycle, expired-state rejection, rotate, disconnect, ad-account sync, cross-workspace isolation. Total integration suite: 28 tests. |
| 8 | (this commit) | PROGRESS.md ✅; `docs/module-04-handoff.md` (campaigns + insights); CI integration job already covers the meta tests since they live alongside module 02's. |

### Test counts

- `@metaflow/api` integration: **28 tests** green via `pnpm --filter @metaflow/api test:integration` (22 from module 02 + 6 from module 03)
- Unit + e2e counts unchanged from module 02

### Decisions locked

1. **Mock-first OAuth.** `META_OAUTH_MODE=mock` is the default. The mock authorize URL redirects straight back at our own callback with a fake code, so the entire pipeline (state → exchange → connect → ad-accounts) runs against the real API surface without touching graph.facebook.com. `META_OAUTH_MODE=real` flips a single DI factory to the binding once the Meta business app is approved.
2. **AAD = workspaceId.** Every CryptoService call in this module uses `meta_connection:<workspaceId>` as AAD. A row exfiltrated from one tenant cannot be replayed against another — GCM auth fails on mismatched AAD.
3. **OAuth state in Redis, not a cookie.** State is a 32-byte random hex stored under `meta_oauth_state:<state>` with a configurable TTL (`META_OAUTH_STATE_TTL_SECONDS`, default 600). The callback verifies it before any code exchange and deletes it on first use.
4. **Workspace-less callback.** `redirect_uri` is fixed at the Meta app level and cannot carry the workspace slug; the callback controller resolves the workspace from the redis state instead. Returns `workspaceSlug` so the UI can navigate the user back to the right settings page.
5. **GET /meta only surfaces ACTIVE.** REVOKED + EXPIRED connections stay in the table for audit but are filtered from the workspace status endpoint. Disconnect is reversible only by re-running the OAuth flow.
6. **Permissions reused from module 02 seed.** `bisu:connect`, `bisu:rotate`, `bisu:disconnect` were already seeded in WS_ADMIN + ORG_ADMIN + ORG_OWNER; no new role mappings needed. `adaccount:read` (already in WS_VIEWER+) gates the ad-accounts list.

---

## Module 02 — Auth & User Management

**Status:** ✅ Complete — 2026-04-20
**Branch:** `main`
**Module 03 handoff:** [`docs/module-03-handoff.md`](./docs/module-03-handoff.md)

### Phases shipped (18/18)

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
| 10    | (pushed `5c2fcf8`) | UsersController (profile + mfa regenerate/disable), OrganizationsService+Controller (current, invite, create workspace with RESERVED_SLUGS check), WorkspacesController (slug→workspace via WorkspaceAccessGuard w/ ORG_OWNER fallback), InvitationsController (public preview + accept w/ new-user register path). 6 controllers mounted. |
| 11    | (hash in log)   | React Email templates (verify/password-reset/invitation) with shared Layout + CtaButton, TR copy, 24h/1h/7d expiry notices. EmailProcessor renders + sends both html + plaintext via Resend or dumps to tmp/mail/. tsconfig `jsx: react`. |
| 17    | `ef21923`       | OpenAPI/Swagger at `/api/docs` (UI) + `/api/docs-json`. Bearer + refreshCookie security schemes. `@nestjs/swagger` CLI plugin in nest-cli.json with classValidatorShim + introspectComments. 27 paths auto-registered. |
| 12    | (hash in log)   | Frontend plumbing: `useAuthStore` Zustand (not persisted), `apiFetch` with X-Requested-With header + Bearer + single-flight silent refresh on 401, typed `authApi` for every /auth endpoint, `useLogin/useLogout/useAuthBootstrap` + `useCan` hook, middleware extended with cookie-presence auth gate (redirects to /login?redirect=...). web type-check + build green. |
| 13    | `752ff15` | Auth pages under `(auth)` group: login, register, verify-email, forgot-password, reset-password, mfa/setup, mfa/verify; plus `/invite/accept`. RHF + zod resolvers bound to `@metaflow/shared-types`. Backup-code one-shot reveal + .txt download. shadcn-style primitives (button, input, label, form, alert, dialog, dropdown-menu, separator, skeleton, sonner) written inline. Web build 161 kB first-load on /login. |
| 14    | `3aa9de5`, `9a1cd2a` | App shell + workspace switcher + `(app)/` route group. `/settings/{profile,security,sessions,organization,members}` and `/w/[slug]/{,settings}`. API gained `GET /organizations/:orgId/members`, `PATCH /organizations/:orgId`, `PATCH /workspaces/:slug`. `useCan()` UI gating against `/api/users/me/permissions`; status page moved to `/status` (public). |
| 15    | `bb595a0` | Integration suite via testcontainers (one pg + redis per run, `withReuse()`); `vitest.integration.config.ts` + `pnpm test:integration`. **22 tests across 10 files** covering register/email-job, full-flow (register→verify→mfa→me), 6-failure lockout, refresh rotation + theft revoke-all, logout JTI blacklist, ORG_MEMBER denial + ORG_OWNER WS_ADMIN inheritance + non-member 403, invitation preview + accept-new + accept-existing + expired, password reset (revokes refresh) + change (keeps current) + enumeration-safety, session list + cannot-revoke-current, forgot/login rate-limit. |
| 16    | `ec7beab` | Playwright e2e: 4 specs (signup-mfa-login, password-reset, invitation-flow, session-revoke). Both web (3000) + api (3001) booted by `webServer` in `playwright.config.ts`; mailbox helper reads `tests/e2e/.mailbox/` JSON dumps via `MAIL_DUMP_DIR`. `pnpm --filter @metaflow/web test:e2e`. |
| 18    | (this commit) | CI updated: `integration-tests` job (testcontainers on the ubuntu runner) + `e2e-tests` job (pg+redis services + playwright install + chromium project). PROGRESS.md flipped to ✅ Complete. `docs/module-03-handoff.md` written for the Meta OAuth + BISU work. |

### Test counts

- `@metaflow/api` unit: **36 tests** green (Module 01: 13 + Module 02 primitives+resolver: 23)
  - password: 5, token: 5, mfa: 7, permission-resolver: 6
- `@metaflow/api` integration: **22 tests** green via `pnpm --filter @metaflow/api test:integration` (testcontainers spins pg:16 + redis:7, ≈30s warm)
- `@metaflow/web` unit: **2 tests** green (badge component)
- `@metaflow/web` e2e: **4 scenarios** wired (signup-mfa-login, password-reset, invitation-flow, session-revoke). Run with `pnpm --filter @metaflow/web test:e2e`.

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

### Remaining phases

None — Module 02 is complete. Hand-off to Module 03 (Meta OAuth + BISU) is in
[`docs/module-03-handoff.md`](./docs/module-03-handoff.md).

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
