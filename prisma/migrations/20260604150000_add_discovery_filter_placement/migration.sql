-- CreateTable: DiscoveryFilterPlacement
-- Binds a FilterDefinition to a section (intent) or category (categoryId).
-- Restores missing table that Prisma Client already references (P2021 fix).

CREATE TABLE IF NOT EXISTS "DiscoveryFilterPlacement" (
    "id"         TEXT NOT NULL,
    "filterId"   TEXT NOT NULL,
    "intent"     TEXT,
    "categoryId" TEXT,
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"  INTEGER NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryFilterPlacement_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DiscoveryFilterPlacement_filterId_intent_categoryId_key"
    ON "DiscoveryFilterPlacement"("filterId", "intent", "categoryId");

-- Indexes
CREATE INDEX IF NOT EXISTS "DiscoveryFilterPlacement_intent_isActive_sortOrder_idx"
    ON "DiscoveryFilterPlacement"("intent", "isActive", "sortOrder");

CREATE INDEX IF NOT EXISTS "DiscoveryFilterPlacement_categoryId_isActive_sortOrder_idx"
    ON "DiscoveryFilterPlacement"("categoryId", "isActive", "sortOrder");

-- ForeignKeys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DiscoveryFilterPlacement_filterId_fkey'
    ) THEN
        ALTER TABLE "DiscoveryFilterPlacement"
            ADD CONSTRAINT "DiscoveryFilterPlacement_filterId_fkey"
            FOREIGN KEY ("filterId") REFERENCES "FilterDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DiscoveryFilterPlacement_categoryId_fkey'
    ) THEN
        ALTER TABLE "DiscoveryFilterPlacement"
            ADD CONSTRAINT "DiscoveryFilterPlacement_categoryId_fkey"
            FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
