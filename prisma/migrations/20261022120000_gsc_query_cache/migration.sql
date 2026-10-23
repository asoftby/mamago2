CREATE TABLE "GscQueryCache" (
    "id" VARCHAR(64) NOT NULL,
    "property" TEXT NOT NULL,
    "startDate" VARCHAR(10) NOT NULL,
    "endDate" VARCHAR(10) NOT NULL,
    "rows" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GscQueryCache_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GscQueryCache_expiresAt_idx" ON "GscQueryCache"("expiresAt");
