-- AddValue: NotificationType.NEWS
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEWS';

-- AddValue: NotificationType.ANNOUNCEMENT
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT';

-- CreateEnum: BroadcastType
DO $$ BEGIN
  CREATE TYPE "BroadcastType" AS ENUM ('NEWS', 'ANNOUNCEMENT', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: BroadcastPriority
DO $$ BEGIN
  CREATE TYPE "BroadcastPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: AudienceType
DO $$ BEGIN
  CREATE TYPE "AudienceType" AS ENUM ('BUSINESS', 'USER', 'ALL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: BroadcastStatus
DO $$ BEGIN
  CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable: AdminBroadcast
CREATE TABLE IF NOT EXISTS "AdminBroadcast" (
    "id"            TEXT NOT NULL,
    "title"         VARCHAR(200) NOT NULL,
    "summary"       VARCHAR(500),
    "body"          TEXT NOT NULL,
    "type"          "BroadcastType" NOT NULL,
    "priority"      "BroadcastPriority" NOT NULL DEFAULT 'NORMAL',
    "audienceType"  "AudienceType" NOT NULL DEFAULT 'BUSINESS',
    "status"        "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "coverImageUrl" TEXT,
    "ctaLabel"      VARCHAR(100),
    "ctaUrl"        VARCHAR(2000),
    "showInInbox"   BOOLEAN NOT NULL DEFAULT true,
    "sendEmail"     BOOLEAN NOT NULL DEFAULT false,
    "pinToDashboard" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt"   TIMESTAMP(3),
    "scheduledAt"   TIMESTAMP(3),
    "createdById"   TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminBroadcast_status_publishedAt_idx" ON "AdminBroadcast"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "AdminBroadcast_audienceType_status_idx" ON "AdminBroadcast"("audienceType", "status");
CREATE INDEX IF NOT EXISTS "AdminBroadcast_createdById_idx" ON "AdminBroadcast"("createdById");

-- AddForeignKey
ALTER TABLE "AdminBroadcast" ADD CONSTRAINT "AdminBroadcast_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
