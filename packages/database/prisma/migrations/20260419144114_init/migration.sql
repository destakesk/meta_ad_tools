-- CreateTable
CREATE TABLE "health_checks" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_checks_service_created_at_idx" ON "health_checks"("service", "created_at");
