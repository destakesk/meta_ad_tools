-- CreateEnum
CREATE TYPE "AdSetStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "ad_sets" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "meta_adset_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AdSetStatus" NOT NULL DEFAULT 'UNKNOWN',
    "optimization_goal" TEXT,
    "billing_event" TEXT,
    "daily_budget_cents" BIGINT,
    "lifetime_budget_cents" BIGINT,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "targeting" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_sets_workspace_id_status_idx" ON "ad_sets"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "ad_sets_campaign_id_idx" ON "ad_sets"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_sets_campaign_id_meta_adset_id_key" ON "ad_sets"("campaign_id", "meta_adset_id");

-- AddForeignKey
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
