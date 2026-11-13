import assert from "node:assert/strict";
import { resolveBookingSheetPrice } from "./bookingSheetPrice";

const structured = resolveBookingSheetPrice(15, "детям 3-5 лет — 20 BYN");
assert.equal(structured.ticket.priceMode, "FROM");
assert.equal(structured.ticket.priceValue, 15);
assert.equal(structured.freeText, null);

const free = resolveBookingSheetPrice(null, "детям 3-5 лет — 20 BYN");
assert.equal(free.ticket.priceValue, null);
assert.equal(free.ticket.priceMode, "UNKNOWN");
assert.equal(free.freeText, "детям 3-5 лет — 20 BYN");

assert.deepEqual(resolveBookingSheetPrice(null, "  "), resolveBookingSheetPrice(null, null));
console.log("bookingSheetPrice.test.ts: OK");
