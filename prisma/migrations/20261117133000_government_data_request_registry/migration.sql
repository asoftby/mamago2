-- Case metadata only: no phone numbers, decrypted data, or payload exports.
CREATE TYPE "GovernmentDataRequestStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'REJECTED', 'CLOSED');

CREATE TABLE "GovernmentDataRequest" (
    "id" TEXT NOT NULL,
    "authorityName" TEXT NOT NULL,
    "incomingNumber" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "requestedScope" TEXT NOT NULL,
    "subjectUserId" TEXT,
    "status" "GovernmentDataRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "resolutionNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentDataRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GovernmentDataRequest_authorityName_incomingNumber_key"
ON "GovernmentDataRequest"("authorityName", "incomingNumber");

CREATE INDEX "GovernmentDataRequest_status_createdAt_idx"
ON "GovernmentDataRequest"("status", "createdAt");
CREATE INDEX "GovernmentDataRequest_receivedAt_idx"
ON "GovernmentDataRequest"("receivedAt");
CREATE INDEX "GovernmentDataRequest_subjectUserId_idx"
ON "GovernmentDataRequest"("subjectUserId");
