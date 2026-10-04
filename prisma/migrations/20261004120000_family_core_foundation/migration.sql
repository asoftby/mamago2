-- Family Core B1: schema foundation (no production reads switched yet).
-- Old fields (Child.parentId, PlanItem.userId, PlanItem.cancelledAt) are untouched.
-- Data backfill is a separate idempotent script: scripts/family-core-backfill.ts.
-- Rollback: remove the new columns, indexes, constraints, tables and enums below.

-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('OWNER', 'ADULT');

-- CreateEnum
CREATE TYPE "FamilyHistoryAccess" AS ENUM ('ALL', 'FROM_JOIN');

-- CreateEnum
CREATE TYPE "PlanDecisionStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMembership" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FamilyRole" NOT NULL DEFAULT 'ADULT',
    "historyAccess" "FamilyHistoryAccess" NOT NULL DEFAULT 'ALL',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "FamilyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyMembership_familyId_idx" ON "FamilyMembership"("familyId");

-- CreateIndex
CREATE INDEX "FamilyMembership_userId_idx" ON "FamilyMembership"("userId");

-- Partial unique: one active membership per user
CREATE UNIQUE INDEX "FamilyMembership_active_user" ON "FamilyMembership"("userId") WHERE "leftAt" IS NULL;

-- Partial unique: one active OWNER per family
CREATE UNIQUE INDEX "FamilyMembership_active_owner" ON "FamilyMembership"("familyId") WHERE "role" = 'OWNER' AND "leftAt" IS NULL;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Child
ALTER TABLE "Child" ADD COLUMN "familyId" TEXT,
ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "Child_familyId_idx" ON "Child"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "Child_id_familyId_key" ON "Child"("id", "familyId");

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable PlanItem (PlanVisibility enum already exists since A1)
ALTER TABLE "PlanItem" ADD COLUMN "familyId" TEXT,
ADD COLUMN "visibility" "PlanVisibility" NOT NULL DEFAULT 'FAMILY',
ADD COLUMN "status" "PlanDecisionStatus" NOT NULL DEFAULT 'CONFIRMED';

-- A private item can never be a pending family proposal
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_private_not_proposed_check" CHECK (NOT ("visibility" = 'PRIVATE' AND "status" = 'PROPOSED'));

-- CreateIndex
CREATE INDEX "PlanItem_familyId_date_idx" ON "PlanItem"("familyId", "date");

-- CreateIndex
CREATE INDEX "PlanItem_familyId_visibility_status_idx" ON "PlanItem"("familyId", "visibility", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanItem_id_familyId_key" ON "PlanItem"("id", "familyId");

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
