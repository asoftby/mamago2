import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("standard resource reservation locks BookingUnit before final availability check", () => {
  const service = readFileSync("src/server/offers/reserveSlot.ts", "utf8");
  const resources = readFileSync("src/server/services/booking/resourceAllocation.ts", "utf8");
  const lock = service.indexOf("await lockBookingUnits(tx, businessId, selectedUnitIds)");
  assert.match(resources, /ORDER BY "id" FOR UPDATE/);
  const finalRecheck = service.indexOf("const current = await loadSlotSnapshot(query, tx);");
  const allocation = service.indexOf("await tx.bookingAllocation.createMany({");
  assert.ok(lock > 0, "BookingUnit row lock is required to synchronize with manual blocks");
  assert.ok(finalRecheck > lock, "availability must be re-read after lock acquisition");
  assert.ok(allocation > finalRecheck, "allocation must be inserted only after recheck");
});
