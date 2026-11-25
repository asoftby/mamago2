import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGuestBookingSms, unicodeSmsParts } from "./guestBookingSms";
import { businessRejectionReasons } from "./businessBookingDecisionSchema";

test("Unicode segment boundaries include concatenation overhead and surrogate pairs", () => {
  for (const [length, parts] of [[70, 1], [71, 2], [134, 2], [135, 3]]) {
    assert.equal(unicodeSmsParts("я".repeat(length)), parts);
  }
  assert.equal(unicodeSmsParts("😀".repeat(36)), 2);
});

test("confirmation and standard reasons fit one Unicode segment with the visit time", () => {
  const context = { bookingId: "synthetic-booking", when: "25.11 14:00" };
  assert.equal(buildGuestBookingSms({ ...context, status: "CONFIRMED", reason: null }).parts, 1);
  for (const status of ["REJECTED", "CANCELLED"] as const) {
    for (const reason of businessRejectionReasons.slice(0, -1)) {
      const copy = buildGuestBookingSms({ ...context, status, reason });
      assert.equal(copy.parts, 1, copy.message);
      assert.ok(copy.message.includes("mamaGo.by"));
      assert.ok(copy.message.includes("25.11 14:00"));
    }
  }
});

test("custom explanation is preserved without redundant reason labels or whitespace", () => {
  const comment = "Пояснение " + "я".repeat(490);
  const copy = buildGuestBookingSms({
    bookingId: "synthetic-booking", when: "25.11 14:00", status: "CANCELLED",
    reason: "Другая причина: " + comment,
  });
  assert.ok(copy.message.endsWith(comment));
  assert.equal(copy.message.includes("Другая причина"), false);
  assert.ok(copy.parts <= 9);
});

test("undated decision has a bounded booking reference and retains optional comment", () => {
  const copy = buildGuestBookingSms({
    bookingId: "synthetic-ABC123", when: "", status: "REJECTED",
    reason: "Нет свободных мест:   Позвоните   завтра",
  });
  assert.ok(copy.message.includes("#ABC123"));
  assert.ok(copy.message.includes("Нет мест: Позвоните завтра"));
});


test("full allowed explanations have a maximum of nine Unicode segments", () => {
  for (const reason of businessRejectionReasons) {
    const comment = "я".repeat(500);
    const copy = buildGuestBookingSms({ bookingId: "synthetic-booking", when: "25.11 14:00",
      status: "CANCELLED", reason: reason + ": " + comment });
    assert.ok(copy.message.endsWith(comment));
    assert.ok(copy.parts <= 9);
  }
});


test("completion and expiry never become cancellation SMS", () => {
  for (const status of ["NEW", "COMPLETED", "EXPIRED"] as const) {
    assert.throws(() => buildGuestBookingSms({ bookingId: "test", when: "", status, reason: null }));
  }
});
