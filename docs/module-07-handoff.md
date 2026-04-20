# Module 07 handoff — Ads + Creatives (+ permission fill-in)

Module 06 added the AdSet level. Module 07 drops one more: individual Ads
(which reference a Creative). This rounds out the hierarchy you need to
ship a complete end-to-end Meta Ads campaign from metaflow.

---

## What's already wired for you

### Everything Modules 02–06 deliver

- Auth + workspaces + members (Module 02)
- Meta connection with encrypted tokens (Module 03)
- Campaigns read + Insights read (Module 04)
- Campaign CRUD (Module 05)
- AdSet CRUD with the two-controller pattern you should mirror (Module 06)

### The pattern to copy

Module 06's shape is the template. Each service does:
- `syncFor<parent>(workspaceId, userId, parentId)`
- `listFor<parent>(workspaceId, parentId)`
- `getById`, `create`, `update`, `delete`

Each controller has the same workspace + parent scoping. Reuse
`loadCampaign` from `AdSetsService` as the template for
`AdsService.loadAdSet` — verifies workspace ownership + decrypts the
token in one shot.

### Mock provider pattern

`MockMetaApiClient` now has two stateful `Map`s (campaigns, ad sets).
Module 07 should add two more (ads keyed by metaAdSetId, creatives keyed
by metaAdAccountId). Update `__resetMockCampaignStore` to clear all four
when the test harness calls it.

---

## Suggested first cuts

1. **Database**: three new models.
   - `Ad` — `adsetId` FK, `metaAdId` unique per adset, `name`, `status`,
     `effectiveStatus` (from Graph — "WITH_ISSUES" etc.), `creativeId` FK
     (nullable so you can create ads before a creative exists).
   - `Creative` — `adAccountId` FK (creatives are ad-account-scoped, not
     adset-scoped on Meta), `metaCreativeId` unique per ad account,
     `name`, `kind` (IMAGE | VIDEO | CAROUSEL | ...), `thumbUrl`,
     `objectStorySpec` (Json — the full Meta spec for rehydration).
   - Optional: `AdInsightSnapshot` / `AdSetInsightSnapshot` if you want
     granular reporting. Can alternatively reuse `meta_insight_snapshots`
     with a nullable `adId` / `adsetId` column — your call based on
     query shape.

2. **Permissions**: add these to the seed catalogue
   (`packages/database/src/data/role-permissions.ts` + `data/permissions.ts`):
   - `adset:delete`
   - `ad:delete`
   - `creative:delete`
   Grant to ADMIN tier (so WS_MANAGER can write but not destroy, matching
   the campaign split).
   When the migration lands, re-gate the AdSet delete endpoint from
   `campaign:delete` to `adset:delete`.

3. **MetaApiClient extensions**:
   - `fetchAds(adSetId)`, `createAd`, `updateAd`, `deleteAd`
   - `fetchCreatives(adAccountId)`, `createCreative`, `deleteCreative`
   Mock adds two stateful maps. Real binding calls
   `/{adSetId}/ads`, `/act_<accountId>/adcreatives`, etc.

4. **Services**: `AdsService`, `CreativesService`. Same shape as
   `AdSetsService`. Wire `adset:delete` / `ad:delete` / `creative:delete`
   for the delete endpoints once the permissions land.

5. **Controllers**:
   ```
   GET    /api/workspaces/:slug/adsets/:id/ads
   POST   /api/workspaces/:slug/adsets/:id/ads
   PATCH  /api/workspaces/:slug/ads/:id
   DELETE /api/workspaces/:slug/ads/:id
   GET    /api/workspaces/:slug/creatives
   POST   /api/workspaces/:slug/creatives
   DELETE /api/workspaces/:slug/creatives/:id
   ```

6. **Frontend**:
   - AdSet detail page gains an `AdsPanel` component (clone of
     `AdSetsPanel`). Campaign detail already has AdSetsPanel; keep the
     pattern consistent.
   - New `/w/[slug]/creatives` library page with a grid of creative
     cards + a "new creative" dialog that uploads to MinIO and stores
     the URL in the new `creatives` table. When ready, the Ad creation
     dialog picks a creative from the library.

7. **Tests**:
   - Integration: `ads.spec.ts`, `creatives.spec.ts`. Clone the Module 06
     spec's structure. Cross-workspace isolation is table stakes.
   - E2E: "full campaign setup" scenario that creates a campaign → ad
     set → creative → ad end-to-end via the UI.

---

## Don'ts

- **Don't store creative bytes in Postgres.** Use MinIO (already wired
  in Module 01); keep a URL in the `creatives` table.
- **Don't hit `MetaConnectionsService.accessTokenFor` from the
  frontend.** Tokens live server-side only.
- **Don't flatten the hierarchy.** Ads live under AdSets, which live
  under Campaigns. Three controllers, not one.
- **Don't `@Public()` anything.** Tenant scope matters on every route.
- **Don't mutate `meta_insight_snapshots` from write endpoints.** Those
  rows are Meta-authoritative; trigger an insights re-sync for the
  affected campaign instead.

---

## Quick reference

| You want…                          | Reach for                                          |
|------------------------------------|----------------------------------------------------|
| Decrypted Meta token               | `MetaConnectionsService.accessTokenFor(id)`        |
| Ad-account-scoped context          | `AdSetsService['loadCampaign']` as template        |
| Cached ad accounts                 | `MetaConnectionsService.listAdAccounts(connId)`    |
| Re-sync after a write              | call `syncFor<parent>(...)` on your service        |
| BigInt minor units                 | `BigInt` column; `.toString()` on JSON serialise   |
| Frontend BigInt rendering          | `lib/format.ts` → `formatInteger / formatCents`    |
| Permission check (server)          | `@RequirePermission('ad:write')` etc.              |
| Permission check (client UI)       | `useCan('ad:write')`                               |
| Audit a domain mutation            | `AuditService.record({ action, userId, … })`       |
| Add new mock fixtures              | Extend `MockMetaApiClient` with stateful Map       |
| Reset mock state per-test          | Add to `__resetMockCampaignStore` + clear the new Maps |
| Start an integration spec          | Copy `apps/api/test/integration/adsets.spec.ts`    |

Ship it.
