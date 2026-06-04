-- CreateTable
CREATE TABLE "GuestUsage" (
    "id" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "generationsCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rateMinuteBucket" INTEGER,
    "rateCountInMinute" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GuestUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestUsage_anonymousId_key" ON "GuestUsage"("anonymousId");

-- CreateIndex
CREATE INDEX "GuestUsage_generationsCount_idx" ON "GuestUsage"("generationsCount");
