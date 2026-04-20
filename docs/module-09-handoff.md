# Module 09 handoff — Automation rules

Module 08 closed the read-side loop: you can drill down from campaign
to adset to ad and see daily performance at each level. Module 09 flips
the switch on the *write-reacting-to-read* side: **automation rules.**
A user configures "if ad X's spend exceeds $Y without a conversion,
pause it" and the system runs that check on a schedule and applies
the action.

---

## What's already wired for you

### Everything Modules 02–08 deliver

- Auth + workspaces + members (Module 02)
- Meta connection with encrypted tokens (Module 03)
- Campaigns read + Insights read at campaign level (Module 04)
- Campaign CRUD (Module 05)
- AdSet CRUD (Module 06)
- Ad CRUD + Creative library (Module 07)
- Insights drill-down to adset + ad (Module 08)

### The pattern to copy

By now you know it:
- Service: `syncFor / listFor / getById / create / update / delete`
- Two controllers per entity: parent-scoped for list/sync/create,
  workspace-scoped for detail/update/delete
- BigInt minor units, regex-validated strings on the wire
- Audit every mutation
- Permission seeds live in `packages/database/src/data/permissions.ts`
  + `role-permissions.ts`; keep `PERMISSION_KEY_LIST` in
  `packages/shared-types/src/permission.ts` in lock-step

### BullMQ worker

Module 02 already wired BullMQ with `audit`, `email`, and
`session-cleanup` queues. Add a fourth — `automation` — and a worker
that reads due rules and applies actions. The worker pattern is
visible in the existing `audit.worker.ts`.

---

## Suggested first cuts

1. **Database**: one new model (maybe two).
   - `AutomationRule` — workspace-scoped. Fields:
     - `scope`: CAMPAIGN / ADSET / AD (use a Prisma enum)
     - `scopeId`: the id of the parent entity (nullable if "any ad in
       workspace" is allowed — probably not, better require a target)
     - `condition`: Json — structured DSL. e.g.
       `{ metric: 'spendCents', op: 'gt', value: '10000',
          window: '7d', and: [{ metric: 'conversions', op: 'eq', value: '0' }] }`
     - `action`: ACTION_TYPE enum — PAUSE / ARCHIVE / NOTIFY / SET_BUDGET
     - `actionPayload`: Json — for SET_BUDGET, the new budget
     - `status`: ENABLED / DISABLED
     - `lastEvaluatedAt` / `lastTriggeredAt` / `lastError`
   - `AutomationRuleLog` — one row per evaluation (rule id + outcome +
     snapshot of the metric that was checked + action taken). Needed for
     the "why did this rule fire" UX.

2. **Permissions**:
   - `automation:read` — already seeded (module 02)
   - `automation:write` — already seeded
   - `automation:enable` — already seeded (flipping ENABLED/DISABLED)
   - Reuse, don't re-seed.

3. **Shared-types**:
   - `automationConditionSchema` — the DSL. Start with two metric
     ops + optional AND-array. Don't design for every imaginable query
     yet; add OR / time-window arithmetic in Module 10.
   - `automationRuleSchema` + list/create/update shapes
   - New audit actions: `automation.created / .updated / .enabled /
     .disabled / .evaluated / .triggered / .deleted`

4. **API**:
   - `AutomationService` with CRUD + `evaluate(ruleId)` + `evaluateAll`
   - Controllers: two per pattern (workspace list + scoped detail)
   - BullMQ job: `automation.evaluate` runs every N minutes; reads
     enabled rules, calls `evaluate(ruleId)` for each, emits log rows.
     Back-off is important — don't hammer the Meta API.

5. **Frontend**:
   - `/w/[slug]/automations` — list + create rule (condition builder UI)
   - Rule detail page with the log view
   - Inline toggle on each rule card: enable / disable

6. **Integration tests**:
   - CRUD round-trip
   - A rule with `scope = 'AD'` + `condition = spendCents > X`, given
     synthetic snapshots that match, triggers the action on evaluate()
   - A rule that doesn't match stays silent
   - DISABLED rules aren't evaluated
   - Workspace isolation on every route

---

## The tricky parts

1. **Condition DSL vs. hard-coded.** You'll be tempted to hard-code a
   handful of rule types ("pause if spend > X") into the service. Don't.
   The DSL approach wins long-term because rules become data, not code.
   But start with *two* operators (`gt`, `eq`) + AND — full expression
   language can wait for Module 10.

2. **Evaluation windows.** A rule says "spend in the last 7 days". Which
   7 days? Last-calendar-week? Rolling? Define `window` as a
   rolling-from-now interval (`'7d'`, `'24h'`) and document the choice
   in the handoff for Module 10.

3. **Safety — PAUSE is the default action.** Never ship an ARCHIVE
   automation in the first version. Pause is reversible; archive isn't
   without a full manual unarchive. The UI should force PAUSE selected
   unless the user checks a "yes, I understand" box for ARCHIVE.

4. **Rate limiting at the Meta side.** Each evaluation may touch
   `/insights` and the mutation endpoint. If a workspace has 1000 rules,
   that's 2000 Graph calls per run. Batch where possible — use the
   existing insight cache first, only hit Graph if the cache is stale.

5. **Idempotency.** If the worker crashes mid-evaluation, you don't want
   to pause the same ad twice. Use `lastTriggeredAt` + `lastTriggeredFor`
   as a dedupe key per rule.

---

## Don't break

- The `__resetMockCampaignStore` hook still clears four maps. If you
  add an "automation queue" to the mock, remember to clear it.
- `insights:read` gates insight reads across all three levels.
- BigInt minor units stay regex-validated strings on the wire.
- Audit every mutation, always.
- Permission seed is the single source of truth — never hard-code
  a permission check outside `RequirePermission`.

---

Next up after automation: probably AI-assisted creative generation
(Module 10) or multivariate testing (Module 11). Your call; the
automation DSL is the foundation for both.
