import assert from "node:assert/strict";
import { BookingStatus } from "@prisma/client";
import { businessBookingDecisionSchema } from "./businessBookingDecisionSchema";

assert.equal(businessBookingDecisionSchema.safeParse({ status: BookingStatus.CONFIRMED }).success, true);
assert.equal(businessBookingDecisionSchema.safeParse({ status: BookingStatus.REJECTED }).success, false);
assert.equal(businessBookingDecisionSchema.safeParse({ status: BookingStatus.REJECTED, reason: "   " }).success, false);
assert.equal(businessBookingDecisionSchema.safeParse({ status: BookingStatus.REJECTED, reason: "Нет мест" }).success, true);
assert.equal(businessBookingDecisionSchema.safeParse({ status: BookingStatus.REJECTED, reason: "x".repeat(501) }).success, false);
console.log("Business decision reason schema: PASS");
