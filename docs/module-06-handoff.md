# Module 06 handoff — AdSet + Ad + Creative

Modules 02–05 give you a tenant-isolated web app where a workspace can
connect to Meta, cache its ad accounts + campaigns, pull daily insights,
and write campaign CRUD. Module 06 drops one level down: AdSets, Ads, and
Creatives — the pieces that actually ship to users on Meta.

---

## What's already wired for you

### Read + write surface (Modules 04 + 05)

- `CampaignsService` supports full CRUD against both the mock and real
  providers. Use the same patterns — `loadContext`, encrypted token
  handling, upsert-on-sync — for the new AdSet / Ad / Creative services.
- `MetaApiClient` interface is the seam. Extend it with:
  - `fetchAdSets(campaignId)`, `createAdSet / updateAdSet / deleteAdSet`
  - `fetchAds(adsetId)`, `createAd / updateAd / deleteAd`
  - `fetchCreatives(adAccountId)`, `createCreative`
  Both `MockMetaApiClient` and `RealMetaApiClient` must stay in lockstep.
  The mock's stateful `Map` pattern (introduced in Module 05's
  `mockCampaignStore`) works verbatim for the new levels.

### Permissions (already seeded)

All the keys you need are in `packages/database/src/data/role-permissions.ts`:

- `adset:write`            — MANAGER + ADMIN
- `ad:write`               — MANAGER + ADMIN
- `budget:edit`            — MANAGER + ADMIN
- `creative:read`          — VIEWER + up
- `creative:write`         — MANAGER + ADMIN
- `campaign:delete`        — ADMIN only (already enforced)

No seed changes needed. Wire the new endpoints with
`@RequirePermission('adset:write')` etc.

### Token plumbing

- `MetaConnectionsService.accessTokenFor(connectionId)` is still the only
  call that decrypts tokens. All new services should route through it.
- Writes should call `CampaignsService.syncFromMeta(workspaceId, userId)`
  (or an analogous `AdSetsService.syncFromMeta`) after a mutation so the
  local cache matches Meta's state.

---

## Suggested first cuts

1. **Database**: four new models.
   - `AdSet` — `campaignId` FK, `metaAdSetId` unique per campaign,
     `dailyBudgetCents` / `lifetimeBudgetCents` (BigInt minor units like
     campaigns), `targeting` JSON, `optimizationGoal`, `billingEvent`,
     `startTime`, `endTime`, `status` (enum mirroring CampaignStatus).
   - `Ad` — `adsetId` FK, `metaAdId` unique per adset, `creativeId` FK,
     `status`, `effectiveStatus`.
   - `Creative` — `adAccountId` FK (creatives are ad-account-scoped,
     not campaign-scoped on Meta), `metaCreativeId` unique per ad
     account, `name`, `kind` (IMAGE | VIDEO | CAROUSEL | ...), `thumbUrl`.
   - Reuse `MetaInsightSnapshot` for ad-set + ad granularity by adding
     nullable `adsetId` / `adId` columns, OR introduce parallel
     `AdSetInsightSnapshot` + `AdInsightSnapshot` tables. The parallel
     approach keeps the Module 04 schema stable; pick based on query
     shape for your reporting pages.

2. **Services**: `AdSetsService`, `AdsService`, `CreativesService`.
   Each mirrors `CampaignsService` — `syncFromMeta / list / getById /
   create / update / delete` with AAD-scoped token decryption + audit.

3. **Controllers** (workspace-scoped):
     GET    /api/workspaces/:slug/campaigns/:id/adsets
     POST   /api/workspaces/:slug/campaigns/:id/adsets
     PATCH  /api/workspaces/:slug/adsets/:id
     DELETE /api/workspaces/:slug/adsets/:id
     GET    /api/workspaces/:slug/adsets/:id/ads
     POST   /api/workspaces/:slug/adsets/:id/ads
     PATCH  /api/workspaces/:slug/ads/:id
     DELETE /api/workspaces/:slug/ads/:id
     GET    /api/workspaces/:slug/creatives
     POST   /api/workspaces/:slug/creatives
   Gated by the existing permission keys. Auth + WorkspaceAccess guards
   are the same three-liner as everywhere else.

4. **Frontend**:
   - Campaign detail page grows an AdSets table with inline "new ad set"
     dialog. AdSet detail page grows an Ads table with inline "new ad"
     dialog.
   - Creative picker component reusable from both the ad creation dialog
     and a standalone `/w/[slug]/creatives` library page.
   - Each write action gated by the matching `useCan(...)` permission.
   - Extend `lib/format.ts` if new monetary fields need different
     locale / currency handling.

5. **Tests**:
   - Integration: `adsets-crud.spec.ts`, `ads-crud.spec.ts`,
     `creatives.spec.ts`. Bootstrap reuses the existing mock-meta
     pattern; create a campaign first, then an ad-set under it, etc.
   - E2E: end-to-end "full campaign setup" — create campaign → create
     ad set → create creative → create ad → publish.

---

## Don'ts

- Don't store creative assets' raw bytes in Postgres. Module 01 wired
  MinIO for exactly this; upload there and keep a URL in `creatives`.
- Don't bypass `MetaConnectionsService.accessTokenFor` inside the new
  services. All decryption routes through it.
- Don't collapse the AdSet → Ad → Creative hierarchy into a single
  flat controller. Meta's API is hierarchical and mismatching causes
  impossible-to-reconcile state (an ad without an ad set, for
  instance).
- Don't add `@Public()` to any new endpoint. Tenant scope matters.
- Don't re-implement token rotation or audit event enqueueing. Both are
  shared infrastructure that plug in via existing injectable services.

---

## Quick reference

| You want…                          | Reach for                                          |
|------------------------------------|----------------------------------------------------|
| Decrypted Meta token for a row     | `MetaConnectionsService.accessTokenFor(id)`        |
| Ad-account-scoped context          | `CampaignsService['loadContext']` pattern — copy into new service |
| Cached ad accounts                 | `MetaConnectionsService.listAdAccounts(connId)`    |
| Re-sync after a write              | call `syncFromMeta(workspaceId, userId)` on your service |
| BigInt minor units in Prisma       | `BigInt` column; `.toString()` on JSON serialisation |
| Frontend BigInt rendering          | `lib/format.ts` → `formatInteger / formatCents`    |
| Permission check (server)          | `@RequirePermission('adset:write')` etc.           |
| Permission check (client UI)       | `useCan('adset:write')`                            |
| Audit a domain mutation            | `AuditService.record({ action, userId, … })`       |
| Add new mock fixtures              | Extend `MockMetaApiClient` with stateful Map       |
| Start an integration spec          | Copy `apps/api/test/integration/campaign-crud.spec.ts` |
| Reset mock state between tests     | Export `__resetMockXxxStore` + hook into `per-test-setup.ts` |

Ship it.
