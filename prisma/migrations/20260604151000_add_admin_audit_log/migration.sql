-- CreateTable: AdminAuditLog
-- Stores admin action audit trail. Restores missing table (P2021 fix).

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id"         TEXT NOT NULL,
    "actorId"    TEXT,
    "actorRole"  TEXT NOT NULL,
    "action"     TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId"   TEXT NOT NULL,
    "before"     JSONB,
    "after"      JSONB,
    "reason"     TEXT,
    "metadata"   JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorId_idx"
    ON "AdminAuditLog"("actorId");

CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorRole_idx"
    ON "AdminAuditLog"("actorRole");

CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_idx"
    ON "AdminAuditLog"("action");

CREATE INDEX IF NOT EXISTS "AdminAuditLog_entityType_entityId_idx"
    ON "AdminAuditLog"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx"
    ON "AdminAuditLog"("createdAt");

-- ForeignKey: actorId → User
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AdminAuditLog_actorId_fkey'
    ) THEN
        ALTER TABLE "AdminAuditLog"
            ADD CONSTRAINT "AdminAuditLog_actorId_fkey"
            FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
