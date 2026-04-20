-- CreateTable
CREATE TABLE "meta_adset_insight_snapshots" (
    "id" TEXT NOT NULL,
    "adset_id" TEXT NOT NULL,
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

    CONSTRAINT "meta_adset_insight_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ad_insight_snapshots" (
    "id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
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

    CONSTRAINT "meta_ad_insight_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_adset_insight_snapshots_adset_id_date_idx" ON "meta_adset_insight_snapshots"("adset_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "meta_adset_insight_snapshots_adset_id_date_key" ON "meta_adset_insight_snapshots"("adset_id", "date");

-- CreateIndex
CREATE INDEX "meta_ad_insight_snapshots_ad_id_date_idx" ON "meta_ad_insight_snapshots"("ad_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ad_insight_snapshots_ad_id_date_key" ON "meta_ad_insight_snapshots"("ad_id", "date");

-- AddForeignKey
ALTER TABLE "meta_adset_insight_snapshots" ADD CONSTRAINT "meta_adset_insight_snapshots_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ad_insight_snapshots" ADD CONSTRAINT "meta_ad_insight_snapshots_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
