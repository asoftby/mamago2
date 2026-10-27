-- Independent pass entitlement and consumption ledger. No passes are issued by this migration.
CREATE TABLE "ClassPass" (
    "id" TEXT NOT NULL,
    "issuedBookingId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "classTariffId" TEXT NOT NULL,
    "visitsTotal" INTEGER NOT NULL,
    "visitsRemaining" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClassPass_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClassPass_visits_check" CHECK ("visitsTotal" > 0 AND "visitsRemaining" >= 0 AND "visitsRemaining" <= "visitsTotal")
);
CREATE TABLE "ClassPassUsage" (
    "id" TEXT NOT NULL,
    "classPassId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "restoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassPassUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassPass_issuedBookingId_key" ON "ClassPass"("issuedBookingId");
CREATE INDEX "ClassPass_offerId_classGroupId_expiresAt_idx" ON "ClassPass"("offerId", "classGroupId", "expiresAt");
CREATE UNIQUE INDEX "ClassPassUsage_bookingId_key" ON "ClassPassUsage"("bookingId");
CREATE INDEX "ClassPassUsage_classPassId_restoredAt_idx" ON "ClassPassUsage"("classPassId", "restoredAt");
ALTER TABLE "ClassPass" ADD CONSTRAINT "ClassPass_issuedBookingId_fkey" FOREIGN KEY ("issuedBookingId") REFERENCES "BookingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassPassUsage" ADD CONSTRAINT "ClassPassUsage_classPassId_fkey" FOREIGN KEY ("classPassId") REFERENCES "ClassPass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassPassUsage" ADD CONSTRAINT "ClassPassUsage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "BookingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
