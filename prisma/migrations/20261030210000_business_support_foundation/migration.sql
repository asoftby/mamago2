-- #878: independent business↔platform support, not customer Direct.
CREATE TYPE "SupportThreadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CLOSED');
CREATE TYPE "SupportMessageActor" AS ENUM ('BUSINESS', 'STAFF');

CREATE TABLE "SupportThread" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "SupportThreadStatus" NOT NULL DEFAULT 'NEW',
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportThread_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SupportMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "actor" "SupportMessageActor" NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportThread_businessId_status_lastMessageAt_idx" ON "SupportThread"("businessId", "status", "lastMessageAt");
CREATE INDEX "SupportMessage_threadId_createdAt_id_idx" ON "SupportMessage"("threadId", "createdAt", "id");
ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "SupportThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
