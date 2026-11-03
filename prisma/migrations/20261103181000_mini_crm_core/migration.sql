-- CreateEnum
CREATE TYPE "WorkItemKind" AS ENUM ('SALES', 'SERVICE', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "WorkSalesStage" AS ENUM ('FIRST_CONTACT', 'CONTACTED', 'OFFER_SENT', 'PAYMENT_PENDING', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "WorkActivityType" AS ENUM ('CALL', 'MESSAGE', 'MEETING', 'NOTE', 'STATUS_CHANGE', 'ASSIGNMENT_CHANGE', 'DUE_CHANGE', 'LEAD_CONVERSION');

-- CreateTable
CREATE TABLE "CrmLead" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "contactName" VARCHAR(200),
    "phoneE164" VARCHAR(20),
    "email" VARCHAR(254),
    "source" VARCHAR(64),
    "sourceUrl" VARCHAR(2048),
    "businessId" TEXT,
    "createRequestKey" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "kind" "WorkItemKind" NOT NULL,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'NEW',
    "salesStage" "WorkSalesStage",
    "potentialAmountBYN" DECIMAL(12,2),
    "nextAction" VARCHAR(1000),
    "dueAt" TIMESTAMP(3),
    "assigneeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "businessId" TEXT,
    "leadId" TEXT,
    "supportThreadId" TEXT,
    "createRequestKey" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkActivity" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "WorkActivityType" NOT NULL,
    "body" VARCHAR(4000),
    "requestKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmLead_createRequestKey_key" ON "CrmLead"("createRequestKey");

-- CreateIndex
CREATE INDEX "CrmLead_businessId_idx" ON "CrmLead"("businessId");

-- CreateIndex
CREATE INDEX "CrmLead_createdAt_idx" ON "CrmLead"("createdAt");

-- CreateIndex
CREATE INDEX "CrmLead_name_idx" ON "CrmLead"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_createRequestKey_key" ON "WorkItem"("createRequestKey");

-- CreateIndex
CREATE INDEX "WorkItem_assigneeId_status_dueAt_idx" ON "WorkItem"("assigneeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkItem_kind_status_dueAt_idx" ON "WorkItem"("kind", "status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkItem_businessId_idx" ON "WorkItem"("businessId");

-- CreateIndex
CREATE INDEX "WorkItem_leadId_idx" ON "WorkItem"("leadId");

-- CreateIndex
CREATE INDEX "WorkItem_supportThreadId_idx" ON "WorkItem"("supportThreadId");

-- CreateIndex
CREATE INDEX "WorkItem_status_dueAt_idx" ON "WorkItem"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkActivity_requestKey_key" ON "WorkActivity"("requestKey");

-- CreateIndex
CREATE INDEX "WorkActivity_workItemId_createdAt_id_idx" ON "WorkActivity"("workItemId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "WorkActivity_actorId_createdAt_idx" ON "WorkActivity"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_supportThreadId_fkey" FOREIGN KEY ("supportThreadId") REFERENCES "SupportThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkActivity" ADD CONSTRAINT "WorkActivity_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkActivity" ADD CONSTRAINT "WorkActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DB-level defense against a lead/business alias or sales amounts on service tasks.
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_one_client_chk"
  CHECK ("leadId" IS NULL OR "businessId" IS NULL);
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_sales_fields_chk"
  CHECK ("kind" = 'SALES' OR ("salesStage" IS NULL AND "potentialAmountBYN" IS NULL));
