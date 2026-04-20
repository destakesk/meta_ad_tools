# Module 04 handoff — Campaigns + Insights

Module 03 (Meta Ads connection) is complete. Module 04 builds on top of the
encrypted Meta tokens to read + write campaigns, ad sets, ads, and to pull
performance insights into local cache for reporting.

---

## What's already wired for you

### Meta connection + token plumbing

- `MetaConnectionsService.accessTokenFor(connectionId)` returns the
  decrypted access token. **Only place in the system that hands out
  plaintext** — pass it straight to the Meta API client and never log it.
- `MetaConnectionsService.rotate(...)` already handles fb_exchange_token
  long-lived flow when running against the real provider, no work needed.
- `MetaApiClient` interface (under `apps/api/src/meta/`) is the seam.
  Module 04 should extend it with `fetchCampaigns`, `createCampaign`,
  `fetchInsights`, etc. Add the methods to both `MockMetaApiClient` and
  `RealMetaApiClient` in lockstep so dev/CI never blocks on Meta access.
- `MetaAdAccount` rows already cache the ad-account list (refresh via
  `MetaConnectionsService.syncAdAccounts`). Use `metaAdAccountId` (the
  `act_xxxxx` form) when calling Graph endpoints scoped per ad account.

### Permissions (already seeded)

The campaign / ad lifecycle permissions are seeded and granted to the
right roles already (Module 02, `packages/database/src/data/role-permissions.ts`):

- `campaign:read` (VIEWER+), `campaign:write` (MANAGER+), `campaign:delete` (ADMIN)
- `adset:write`, `ad:write`, `budget:edit`
- `creative:read`, `creative:write`
- `template:read`, `template:write`, `brandkit:read`, `brandkit:write`
- `automation:read/write/enable`
- `abtest:read/write`
- `insights:read`, `report:read`, `report:export`
- `ai:use`
- `lead:read`, `lead:export`

Wire the new endpoints with `@RequirePermission('campaign:write')` etc. and
the existing `PermissionGuard` will Just Work — no role-permission catalogue
changes needed.

### CryptoService

If Module 04 stores any other secret (e.g. webhook signing keys for Meta
webhooks), reuse `CryptoService.encrypt(value, aad)` with an AAD that
encodes the resource (`webhook:<workspaceId>:<id>` style). Same AES-256-GCM
v1: format as Module 03's tokens.

### AuditService

Pre-defined audit actions for Module 04 to extend. Add to `AuditAction` in
`packages/shared-types/src/audit.ts`:

- `campaign.created`, `campaign.updated`, `campaign.deleted`
- `adset.created`, `adset.updated`, `ad.created`, `ad.updated`
- `creative.uploaded`, `creative.deleted`
- `insights.fetched`
- `report.exported`
- `automation.enabled`, `automation.disabled`
- `lead.exported`

Type-checker will tell you everywhere the new actions need to be wired.

---

## Suggested first cuts

1. **Database**: `Campaign`, `AdSet`, `Ad`, `Creative` Prisma models that
   mirror Meta's hierarchy. Each carries the `metaAdAccountId` it lives
   under and a `metaCampaignId / metaAdSetId / metaAdId / metaCreativeId`.
   Add a `MetaInsightSnapshot` table for cached per-day spend/clicks/etc.
   The `connectionId` foreign key on each row binds them to the
   originating MetaConnection (so disconnect cascades clean).

2. **Service layer**: `CampaignsService` (CRUD + list + duplicate),
   `AdSetsService`, `AdsService`, `InsightsService`. Each uses
   `MetaConnectionsService.accessTokenFor(...)` to obtain a token for the
   relevant ad account and calls the extended `MetaApiClient`.

3. **Controller layer**: workspace-scoped routes
     GET    /api/workspaces/:slug/campaigns
     POST   /api/workspaces/:slug/campaigns
     PATCH  /api/workspaces/:slug/campaigns/:id
     DELETE /api/workspaces/:slug/campaigns/:id
     GET    /api/workspaces/:slug/insights?from=...&to=...
   gated by the existing permission keys.

4. **Frontend**: `/w/[slug]/campaigns` list page + campaign detail page.
   The Module 03 Meta connection settings page already lives at
   `/w/[slug]/settings/meta`; surface "Connect Meta first" empty-state on
   `/w/[slug]/campaigns` when `MetaConnectionResponse.connection` is null.

5. **Tests**:
   - Unit: campaign builder math (budget, schedule).
   - Integration: extend `apps/api/test/integration/` with a `campaigns.spec.ts`
     using the mock provider; create → fetch → update → delete round-trip.
   - E2E: `apps/web/tests/e2e/campaign-lifecycle.spec.ts` once enough of the
     UI lands.

---

## Don'ts

- Don't bypass `MetaConnectionsService.accessTokenFor`. Even within a
  service that already has a connection row in scope, decryption MUST go
  through that method so audit + AAD invariants hold.
- Don't store ad creatives' raw assets in Postgres. Stage them in MinIO
  (Module 01 has it wired) and keep a reference URL in the `creatives`
  table.
- Don't log token / response bodies from Meta calls. Pino redaction
  patterns are in place but new keys (`access_token`, `client_secret`,
  `code`, `state`) should be added to the redact config in `apps/api/src/common/logging/`
  if Module 04 introduces new shapes.
- Don't add `@Public()` to any campaign endpoint. Even read-only routes
  carry tenant scope; PermissionGuard + WorkspaceAccessGuard enforce that.

---

## Quick reference

| You want…                          | Reach for                                          |
|------------------------------------|----------------------------------------------------|
| Meta access token for a connection | `MetaConnectionsService.accessTokenFor(id)`        |
| Re-extend the access token         | `MetaConnectionsService.rotate(id, userId)`        |
| Cached ad accounts for workspace   | `MetaConnectionsService.listAdAccounts(connId)`    |
| Permission check (server)          | `@RequirePermission('campaign:write')` etc.        |
| Permission check (client UI)       | `useCan('campaign:write')`                         |
| Audit a domain mutation            | `AuditService.record({ action, userId, … })`       |
| Add a new mock fixture for tests   | Extend `MockMetaApiClient` with the new method     |
| Start an integration spec          | Copy `apps/api/test/integration/meta-connection.spec.ts` as a template |

Ship it.
