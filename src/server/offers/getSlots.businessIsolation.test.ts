import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { loadSlotSnapshot } from "./getSlots";

// Regression: a BookingUnitOffer belonging to another business must never
// surface a bookable exclusive unit on this offer.
async function main() {
  let unitWhere: unknown;
  const fake = {
    offer: {
      findUnique: async () => ({
        bookingEnabled: true,
        bookingMode: "USE_PUBLICATION_SLOTS",
        campPlacesCount: null,
        openingHoursId: null,
        inheritPlaceOpeningHours: false,
        place: { openingHoursId: null, ownerBusinessId: "owner-business" },
        offerBooking: {
          scheduleKind: "WEEKLY",
          timezone: "Europe/Minsk",
          leadTimeHours: 0,
          horizonDays: 30,
          durationMin: 60,
          bufferMin: 0,
          capacity: 1,
          rules: [],
          exceptions: [],
        },
      }),
    },
    offerSession: { findMany: async () => [] },
    bookingRequest: { findMany: async () => [] },
    bookingUnitOffer: {
      findMany: async (args: { where: unknown }) => {
        unitWhere = args.where;
        return [];
      },
    },
  };
  await loadSlotSnapshot(
    { offerId: "offer-1", from: new Date("2026-10-28T00:00:00Z"), to: new Date("2026-10-29T00:00:00Z") },
    fake as unknown as Prisma.TransactionClient,
  );
  assert.deepEqual(unitWhere, {
    offerId: "offer-1",
    bookingUnit: { status: "ACTIVE", type: "EXCLUSIVE", businessId: "owner-business" },
  });
  console.log("getSlots.businessIsolation.test: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
