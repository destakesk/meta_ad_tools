-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ad_account_id" TEXT NOT NULL,
    "meta_campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'UNKNOWN',
    "daily_budget_cents" BIGINT,
    "lifetime_budget_cents" BIGINT,
    "currency" TEXT,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_insight_snapshots" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "impressions" BIGINT NOT NULL DEFAULT 0,
    "clicks" BIGINT NOT NULL DEFAULT 0,
    "spend_cents" BIGINT NOT NULL DEFAULT 0,
    "conversions" BIGINT NOT NULL DEFAULT 0,
    "reach" BIGINT NOT NULL DEFAULT 0,
    "frequency" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "cpm_cents" BIGINT,
    "ctr" DECIMAL(10,6),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_insight_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_workspace_id_status_idx" ON "campaigns"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "campaigns_ad_account_id_idx" ON "campaigns"("ad_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_ad_account_id_meta_campaign_id_key" ON "campaigns"("ad_account_id", "meta_campaign_id");

-- CreateIndex
CREATE INDEX "meta_insight_snapshots_campaign_id_date_idx" ON "meta_insight_snapshots"("campaign_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "meta_insight_snapshots_campaign_id_date_key" ON "meta_insight_snapshots"("campaign_id", "date");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_insight_snapshots" ADD CONSTRAINT "meta_insight_snapshots_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
