# Module 05 handoff — Campaign writes + AdSet/Ad/Creative

Module 04 (read-only Campaigns + Insights) is complete. Module 05 turns the
read-through cache into a full read/write surface and goes one level deeper
into Meta's hierarchy.

---

## What's already wired for you

### Read surface (Module 04)

- `CampaignsService.syncFromMeta(workspaceId, userId)` — pulls every ad
  account's campaign list. Call at the end of a write op so the local
  cache reflects the Meta state immediately.
- `CampaignsService.listForWorkspace(workspaceId)` and
  `CampaignsService.getById(workspaceId, id)` — tenant-scoped; already
  used by the frontend.
- `InsightsService.syncForWorkspace / listForWorkspace` — fills
  `meta_insight_snapshots` idempotently. Extend to level=ADSET / level=AD
  when you add those hierarchy tiers.

### Token plumbing (Module 03)

- `MetaConnectionsService.accessTokenFor(connectionId)` — only place
  that decrypts tokens. Writes should reach for this same helper so AAD +
  audit invariants hold.
- `MetaApiClient` interface is the seam. Writes need new methods:
  - `createCampaign(input)`, `updateCampaign(id, input)`, `deleteCampaign(id)`
  - `createAdSet / updateAdSet / deleteAdSet`
  - `createAd / updateAd / deleteAd`
  - `uploadCreative` (multipart; will probably wrap `fetch` + FormData)
  Add the methods to both `MockMetaApiClient` and `RealMetaApiClient` in
  lockstep; the mock should write into in-memory maps that `fetchCampaigns`
  etc. can read from so create → list → detail works end-to-end in tests.

### Permissions (already seeded)

These keys are seeded but not yet consumed by any controller:

- `campaign:write`, `campaign:delete`
- `adset:write`
- `ad:write`
- `budget:edit`
- `creative:read`, `creative:write`

Wire the new endpoints with `@RequirePermission('campaign:write')` etc.
`PermissionGuard` will enforce the grant. WS_MANAGER has `campaign:write`
but not `campaign:delete` by design — keep that distinction visible in the UI
with `useCan(...)`.

---

## Suggested first cuts

1. **Database**: add `AdSet`, `Ad`, `Creative` Prisma models mirroring
   Meta's hierarchy. Each carries the parent `Campaign.id` (or `AdSet.id`
   for ads). Match the `(parentId, metaXxxId)` unique constraint pattern
   from `campaigns`.
2. **Service layer**: mirror `CampaignsService` — each level gets a
   syncFromMeta + list + CRUD methods. DRY an `metaSync` helper in the
   meta module that takes a parent id and a provider fetch fn.
3. **MetaApiClient extensions**:
   - Add the CRUD methods listed above.
   - Mock implementation stores created campaigns in a `Map<metaId, snapshot>`
     keyed by (adAccountId + metaCampaignId) so fetchCampaigns returns
     both the fixture campaigns AND any created-in-mock campaigns. That
     lets integration tests write → sync → list without ceremony.
4. **Controller layer** (workspace-scoped):
     POST   /api/workspaces/:slug/campaigns
     PATCH  /api/workspaces/:slug/campaigns/:id
     DELETE /api/workspaces/:slug/campaigns/:id
     POST   .../campaigns/:id/adsets
     PATCH  .../adsets/:id
     DELETE .../adsets/:id
     POST   .../adsets/:id/ads
     PATCH  .../ads/:id
     DELETE .../ads/:id
     POST   .../creatives
   Gated by the existing permission keys.
5. **Frontend**:
   - `/w/[slug]/campaigns/new` and `/w/[slug]/campaigns/[id]/edit` — RHF +
     zod shared schemas.
   - `/w/[slug]/campaigns/[id]` detail grows AdSets table + "new ad set"
     button; AdSet detail grows Ads table + "new ad" button.
   - Creative picker dialog reusable from any of the three levels.
6. **Tests**:
   - Integration: extend `apps/api/test/integration/campaigns.spec.ts`
     with create → fetch → update → delete round-trips; add
     `adsets.spec.ts`, `ads.spec.ts`, `creatives.spec.ts`.
   - E2E: `apps/web/tests/e2e/campaign-crud.spec.ts` once enough UI is
     there — create campaign → add adset → add ad → delete.

---

## Don'ts

- Don't bypass `MetaConnectionsService.accessTokenFor`. Services in the
  meta module should all route through it so AAD + audit invariants stay
  intact.
- Don't mutate `meta_insight_snapshots` from write endpoints. Insight
  numbers are Meta-owned; a write op should trigger a `campaigns/sync`
  for the affected campaign but never touch insight rows directly.
- Don't log request bodies that carry campaign budgets, creatives, or
  target specs. Add any new pino-redact patterns if new shapes introduce
  sensitive fields.
- Don't add `@Public()` to any CRUD endpoint. Even read operations need
  workspace scope.

---

## Quick reference

| You want…                          | Reach for                                          |
|------------------------------------|----------------------------------------------------|
| Meta access token for a campaign   | `MetaConnectionsService.accessTokenFor(connId)`    |
| Cached ad accounts for workspace   | `MetaConnectionsService.listAdAccounts(connId)`    |
| Sync campaigns after a write       | `CampaignsService.syncFromMeta(workspaceId, userId)` |
| BigInt-safe server response field  | BigInt column in Prisma → `.toString()` before JSON |
| Client-side BigInt rendering       | `lib/format.ts` → `formatInteger / formatCents`    |
| Permission check (server)          | `@RequirePermission('campaign:write')` etc.        |
| Permission check (client UI)       | `useCan('campaign:write')`                         |
| Audit a domain mutation            | `AuditService.record({ action, userId, … })`       |
| Add new mock fixtures              | Extend `MockMetaApiClient` with the new methods    |
| Start an integration spec          | Copy `apps/api/test/integration/campaigns.spec.ts` as a template |

Ship it.
