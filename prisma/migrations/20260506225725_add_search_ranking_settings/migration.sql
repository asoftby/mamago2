-- CreateTable
CREATE TABLE "SearchRankingSettings" (
    "id" TEXT NOT NULL,
    "nearbyBoost" INTEGER NOT NULL DEFAULT 50,
    "freshnessBoost" INTEGER NOT NULL DEFAULT 30,
    "popularityBoost" INTEGER NOT NULL DEFAULT 40,
    "partnerBoost" INTEGER NOT NULL DEFAULT 20,
    "ageBoost" INTEGER NOT NULL DEFAULT 60,
    "cityBoost" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchRankingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchRankingSettings_updatedAt_idx" ON "SearchRankingSettings"("updatedAt");
