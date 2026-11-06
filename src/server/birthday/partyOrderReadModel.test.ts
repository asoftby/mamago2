import assert from "node:assert/strict";
import { test } from "node:test";
import { partyOrderReadModel } from "./partyOrderReadModel";

test("only the winning accepted quote is final and pending add-ons are separate", () => {
  const summary = partyOrderReadModel({ status: "ANCHOR_CONFIRMED", items: [
    { role: "ANCHOR", status: "CONFIRMED", offerPriceSnapshot: null, confirmedBookingRequestId: "winner", requests: [
      { id: "other", partyStage: "NOT_ACCEPTED", partyQuotes: [{ status: "ACCEPTED", priceByn: 1, validUntil: null }] },
      { id: "winner", partyStage: "CONFIRMED", partyQuotes: [{ status: "ACCEPTED", priceByn: 150.25, validUntil: null }] },
    ] },
    { role: "ADDON", status: "REQUESTED", offerPriceSnapshot: null, confirmedBookingRequestId: null, requests: [] },
  ] });
  assert.equal(summary.stage, "ANCHOR_CONFIRMED");
  assert.equal(summary.confirmedAmountByn, "150.25");
  assert.equal(summary.awaitingCount, 1);
});

test("an expired quote is unavailable and an accepted quote is not a booking", () => {
  const request = { id: "r", partyStage: "QUOTED", partyQuotes: [
    { status: "ACTIVE", priceByn: null, validUntil: new Date("2026-01-01") },
  ] };
  const order = { status: "ANCHOR_PENDING", items: [
    { role: "ANCHOR", status: "REQUESTED", offerPriceSnapshot: null, confirmedBookingRequestId: null, requests: [request] },
  ] };
  assert.equal(partyOrderReadModel(order, new Date("2026-02-01")).stage, "UNAVAILABLE");
  request.partyStage = "AWAITING_RECONFIRM";
  assert.equal(partyOrderReadModel(order).stage, "AWAITING_CONFIRMATION");
  assert.equal(partyOrderReadModel(order).confirmedAmountByn, null);
});
