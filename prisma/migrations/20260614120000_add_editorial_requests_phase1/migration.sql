CREATE TYPE "EditorialRequestStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

CREATE TABLE "EditorialRequest" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "cityId" TEXT,
  "status" "EditorialRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "deadlineAt" TIMESTAMP(3),
  "criteria" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EditorialRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EditorialRequest_cityId_idx" ON "EditorialRequest"("cityId");
CREATE INDEX "EditorialRequest_status_idx" ON "EditorialRequest"("status");
CREATE INDEX "EditorialRequest_createdAt_idx" ON "EditorialRequest"("createdAt");
CREATE INDEX "EditorialRequest_updatedAt_idx" ON "EditorialRequest"("updatedAt");

ALTER TABLE "EditorialRequest"
ADD CONSTRAINT "EditorialRequest_cityId_fkey"
FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
