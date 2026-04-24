CREATE TYPE "OrganizerCreatedFrom" AS ENUM ('IMPORT', 'MANUAL');

CREATE TABLE "Organizer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unp" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "createdFrom" "OrganizerCreatedFrom" NOT NULL DEFAULT 'MANUAL',
    "linkedBusinessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organizer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Activity" ADD COLUMN "organizerId" TEXT;

ALTER TABLE "Activity"
ADD CONSTRAINT "Activity_organizerId_fkey"
FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Organizer"
ADD CONSTRAINT "Organizer_linkedBusinessId_fkey"
FOREIGN KEY ("linkedBusinessId") REFERENCES "Business"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "Activity_organizerId_idx" ON "Activity"("organizerId");
CREATE INDEX "Organizer_name_idx" ON "Organizer"("name");
CREATE UNIQUE INDEX "Organizer_unp_key" ON "Organizer"("unp");
CREATE INDEX "Organizer_linkedBusinessId_idx" ON "Organizer"("linkedBusinessId");
