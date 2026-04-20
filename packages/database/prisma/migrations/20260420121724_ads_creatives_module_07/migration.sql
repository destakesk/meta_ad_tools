-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CreativeKind" AS ENUM ('IMAGE', 'VIDEO', 'CAROUSEL', 'LINK', 'POST');

-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "adset_id" TEXT NOT NULL,
    "creative_id" TEXT,
    "meta_ad_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'UNKNOWN',
    "effective_status" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creatives" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "ad_account_id" TEXT NOT NULL,
    "meta_creative_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CreativeKind" NOT NULL DEFAULT 'IMAGE',
    "thumb_url" TEXT,
    "object_story_spec" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creatives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ads_workspace_id_status_idx" ON "ads"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "ads_adset_id_idx" ON "ads"("adset_id");

-- CreateIndex
CREATE INDEX "ads_creative_id_idx" ON "ads"("creative_id");

-- CreateIndex
CREATE UNIQUE INDEX "ads_adset_id_meta_ad_id_key" ON "ads"("adset_id", "meta_ad_id");

-- CreateIndex
CREATE INDEX "creatives_workspace_id_idx" ON "creatives"("workspace_id");

-- CreateIndex
CREATE INDEX "creatives_ad_account_id_idx" ON "creatives"("ad_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "creatives_ad_account_id_meta_creative_id_key" ON "creatives"("ad_account_id", "meta_creative_id");

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
