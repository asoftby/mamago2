-- CreateTable
CREATE TABLE "RankingSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "freshnessWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "boostWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "ageMatchWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "proximityWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "popularityWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoostSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "allowBoostInToday" BOOLEAN NOT NULL DEFAULT true,
    "allowBoostInNew" BOOLEAN NOT NULL DEFAULT true,
    "allowBoostInFree" BOOLEAN NOT NULL DEFAULT false,
    "maxBoostedItemsPerStory" INTEGER NOT NULL DEFAULT 2,
    "maxBoostScore" INTEGER NOT NULL DEFAULT 100,
    "repeatCooldown" INTEGER NOT NULL DEFAULT 24,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoostSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryIntentConfig" (
    "id" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "itemLimit" INTEGER NOT NULL DEFAULT 5,
    "allowedTypes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryIntentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoryIntentConfig_intent_key" ON "StoryIntentConfig"("intent");

-- CreateIndex
CREATE INDEX "StoryIntentConfig_order_idx" ON "StoryIntentConfig"("order");
