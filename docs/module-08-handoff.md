# Module 08 handoff — Insights drill-down + Ad / AdSet reporting

Module 04 shipped campaign-level insights. Modules 05, 06, 07 filled out
the write-side of the hierarchy (Campaign → AdSet → Ad → Creative).
Module 08 closes the loop: pull daily insights at every level of the
tree so the UI can answer "which ad is underperforming?" without
dropping into Meta Ads Manager.

---

## What's already wired for you

### Everything Modules 02–07 deliver

- Auth + workspaces + members (Module 02)
- Meta connection with encrypted tokens (Module 03)
- Campaigns read + Insights read at campaign level (Module 04)
- Campaign CRUD (Module 05)
- AdSet CRUD with the two-controller pattern (Module 06)
- Ad CRUD + Creative library (Module 07)

### The pattern to copy

Module 07 is your template this round. Services look like:
- `syncFor<parent>(workspaceId, userId, parentId)`
- `listFor<parent>(workspaceId, parentId)`
- `getById`, `create`, `update`, `delete`

Controllers come in pairs: parent-scoped for list/sync/create,
workspace-scoped for detail/update/delete.

For insights, the shape to beat is `CampaignsInsightsController` — look
at how it merges cached rows with a fresh Graph call and dedupes by
`(campaignId, date)`.

### Mock provider pattern

`MockMetaApiClient` has four stateful `Map`s now (campaigns, ad sets,
ads, creatives). Add a fifth for insight snapshots if you want write
tests, or keep insights deterministic-from-seed like Module 04 did. The
existing `fetchInsights` already produces per-campaign-per-day rows
with a seeded hash — extend it to `level: 'adset' | 'ad'` by including
the child id in the hash.

---

## Suggested first cuts

1. **Database**: one (maybe two) new snapshot models, or extend the
   existing one.
   - Easiest path: add nullable `adsetId` + `adId` columns to
     `meta_insight_snapshots`, plus `level` enum column
     (`CAMPAIGN | ADSET | AD`). One table, three scopes, same query
     shape as Module 04.
   - Cleaner path: three tables (`campaign_insight_snapshots` already
     exists in spirit; add `adset_insight_snapshots` and
     `ad_insight_snapshots`). Better for typed queries but triples the
     migration surface. Your call.

2. **MetaApiClient**: extend `fetchInsights` to accept a
   `level: 'campaign' | 'adset' | 'ad'` and a child-ids filter. Real
   binding stays on `/{accountId}/insights` — just change the `level`
   querystring + the `filtering` clause. Mock extends the hash seed.

3. **Services**: `InsightsService` already exists. Give it:
   - `listForAdSet(workspaceId, adsetId, { from, to })`
   - `listForAd(workspaceId, adId, { from, to })`
   - Reuse the 15-minute cache window logic from Module 04.

4. **Controllers**: add `/adsets/:adsetId/insights` + `/ads/:adId/insights`
   routes. Permissions: `insights:read`.

5. **Frontend**:
   - AdSet detail page grows an Insights card (same 14-day rolling
     window, same table shape as CampaignInsightsPanel).
   - Ad detail page — note there isn't one yet; you'll want to add
     `/w/[slug]/ads/[id]` with a detail card + insights.
   - Optional: a roll-up table on the campaign detail that pivots ads
     by status so the manager sees "which ads are burning budget".

6. **Integration tests**:
   - Insights fetch at each level returns rows for the seeded fixtures.
   - `from > to` rejected.
   - Insights are workspace-scoped (a stranger can't read another
     workspace's insights even with a valid ad/adset id).

---

## Permissions

Module 02 already shipped `insights:read`; no new permissions needed.
If you add Ad-level write features like "pause all ads burning over
$X", reuse `ad:write`.

## Known follow-ups

- **No insight drill-down yet.** That's the whole module.
- **No ad detail page.** The frontend jumps from AdSet → AdsPanel but
  there's no `/w/[slug]/ads/[id]` page. Module 08 should add one so the
  per-ad insights view has a home.
- **Creative previews are shallow.** Currently we render `thumbUrl`
  only. A future module can render the full `object_story_spec` as a
  native preview (link card, video player, carousel cards).
- **Two-controller split per level.** Keep following the pattern.
  Breaking it will haunt the next reader.

## Don't break

- The `__resetMockCampaignStore` hook in `per-test-setup.ts` clears all
  four stateful maps. If you add a fifth (insight snapshots),
  remember to clear it too.
- Audit action vocabulary is in shared-types and frozen per module.
  Add new actions to the zod enum; don't reuse existing ones for new
  events.
- BigInt minor units stay as regex-validated strings on the wire and
  BigInt in the DB. Don't introduce floats.
- `insights:read` gates the read routes. Keep the pattern.

---

Happy shipping. If Module 08 goes deep on reporting, consider pulling
out a dedicated `ReportsModule` rather than stuffing it all into
`MetaModule` — the latter is getting crowded.
