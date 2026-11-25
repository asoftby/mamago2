CREATE TYPE "BookingSmsDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'ACCEPTED', 'FAILED', 'EXHAUSTED', 'UNCERTAIN', 'SKIPPED');

CREATE TABLE "BookingSmsDelivery" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "decisionActivityId" TEXT NOT NULL,
  "decisionStatus" "BookingStatus" NOT NULL,
  "status" "BookingSmsDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3),
  "estimatedParts" INTEGER,
  "providerMessageId" TEXT,
  "providerStatus" TEXT,
  "providerParts" INTEGER,
  "errorCode" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingSmsDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingSmsDelivery_decision_status" CHECK ("decisionStatus" IN ('CONFIRMED', 'REJECTED', 'CANCELLED')),
  CONSTRAINT "BookingSmsDelivery_attempt_count" CHECK ("attemptCount" >= 0)
);

CREATE TABLE "BookingSmsAttempt" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "status" "BookingSmsDeliveryStatus" NOT NULL,
  "errorCode" TEXT,
  "providerMessageId" TEXT,
  "providerStatus" TEXT,
  "providerParts" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "BookingSmsAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingSmsAttempt_number" CHECK ("number" > 0)
);

CREATE UNIQUE INDEX "BookingSmsDelivery_decisionActivityId_key" ON "BookingSmsDelivery"("decisionActivityId");
CREATE INDEX "BookingSmsDelivery_status_nextAttemptAt_idx" ON "BookingSmsDelivery"("status", "nextAttemptAt");
CREATE INDEX "BookingSmsDelivery_status_leaseUntil_idx" ON "BookingSmsDelivery"("status", "leaseUntil");
CREATE INDEX "BookingSmsDelivery_bookingId_idx" ON "BookingSmsDelivery"("bookingId");
CREATE UNIQUE INDEX "BookingSmsAttempt_deliveryId_number_key" ON "BookingSmsAttempt"("deliveryId", "number");
ALTER TABLE "BookingSmsDelivery" ADD CONSTRAINT "BookingSmsDelivery_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingSmsDelivery" ADD CONSTRAINT "BookingSmsDelivery_decisionActivityId_fkey" FOREIGN KEY ("decisionActivityId") REFERENCES "BookingActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingSmsAttempt" ADD CONSTRAINT "BookingSmsAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "BookingSmsDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
