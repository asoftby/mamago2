-- Durable party provider invitation queue. No dispatch is activated in this migration.
CREATE TYPE "PartyProviderDispatchMode" AS ENUM ('PARALLEL', 'SEQUENTIAL');
CREATE TYPE "PartyProviderInviteStatus" AS ENUM (
  'QUEUED', 'SENT', 'QUOTED', 'ACCEPTED', 'CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELLED'
);

CREATE TABLE "PartyProviderInvite" (
  "id" TEXT NOT NULL,
  "partyOrderItemId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "mode" "PartyProviderDispatchMode" NOT NULL,
  "status" "PartyProviderInviteStatus" NOT NULL DEFAULT 'QUEUED',
  "bookingRequestId" TEXT,
  "responseDueAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartyProviderInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartyProviderInvite_bookingRequestId_key"
  ON "PartyProviderInvite"("bookingRequestId");
CREATE UNIQUE INDEX "PartyProviderInvite_partyOrderItemId_businessId_key"
  ON "PartyProviderInvite"("partyOrderItemId", "businessId");
CREATE UNIQUE INDEX "PartyProviderInvite_partyOrderItemId_position_key"
  ON "PartyProviderInvite"("partyOrderItemId", "position");
CREATE INDEX "PartyProviderInvite_status_responseDueAt_idx"
  ON "PartyProviderInvite"("status", "responseDueAt");

ALTER TABLE "PartyProviderInvite"
  ADD CONSTRAINT "PartyProviderInvite_partyOrderItemId_fkey"
  FOREIGN KEY ("partyOrderItemId") REFERENCES "PartyOrderItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyProviderInvite"
  ADD CONSTRAINT "PartyProviderInvite_bookingRequestId_fkey"
  FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
