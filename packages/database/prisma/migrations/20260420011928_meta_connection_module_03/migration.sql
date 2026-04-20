-- CreateEnum
CREATE TYPE "MetaConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "meta_connections" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "meta_user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "scopes" TEXT[],
    "expires_at" TIMESTAMP(3),
    "status" "MetaConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "connected_by_id" TEXT NOT NULL,
    "last_rotated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ad_accounts" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "meta_ad_account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "timezone" TEXT,
    "status" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_connections_workspace_id_idx" ON "meta_connections"("workspace_id");

-- CreateIndex
CREATE INDEX "meta_connections_status_idx" ON "meta_connections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "meta_connections_workspace_id_meta_user_id_key" ON "meta_connections"("workspace_id", "meta_user_id");

-- CreateIndex
CREATE INDEX "meta_ad_accounts_connection_id_idx" ON "meta_ad_accounts"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ad_accounts_connection_id_meta_ad_account_id_key" ON "meta_ad_accounts"("connection_id", "meta_ad_account_id");

-- AddForeignKey
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ad_accounts" ADD CONSTRAINT "meta_ad_accounts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "meta_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
