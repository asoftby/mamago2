-- AlterTable
ALTER TABLE "AdminBroadcast"
  ADD COLUMN IF NOT EXISTS "lastEditedAfterPublishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishedEditCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminBroadcastRevision" (
  "id" TEXT NOT NULL,
  "broadcastId" TEXT NOT NULL,
  "editedById" TEXT NOT NULL,
  "reason" TEXT,
  "oldSnapshot" JSONB NOT NULL,
  "newSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminBroadcastRevision_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminBroadcastRevision_broadcastId_fkey'
  ) THEN
    ALTER TABLE "AdminBroadcastRevision"
      ADD CONSTRAINT "AdminBroadcastRevision_broadcastId_fkey"
      FOREIGN KEY ("broadcastId")
      REFERENCES "AdminBroadcast"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminBroadcastRevision_editedById_fkey'
  ) THEN
    ALTER TABLE "AdminBroadcastRevision"
      ADD CONSTRAINT "AdminBroadcastRevision_editedById_fkey"
      FOREIGN KEY ("editedById")
      REFERENCES "User"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "AdminBroadcastRevision_broadcastId_createdAt_idx"
  ON "AdminBroadcastRevision"("broadcastId", "createdAt");

CREATE INDEX IF NOT EXISTS "AdminBroadcastRevision_editedById_idx"
  ON "AdminBroadcastRevision"("editedById");
