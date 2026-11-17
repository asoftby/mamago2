import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createGovernmentRequestSchema,
  updateGovernmentRequestSchema,
  canTransitionGovernmentRequest,
  isAllowedGovernmentRequestOrigin,
} from "./governmentRequests.policy";

const valid = {
  authorityName: "Уполномоченный государственный орган",
  incomingNumber: "N-123",
  receivedDate: "2026-11-17",
  legalBasis: "Указанная отправителем норма закона",
  requestedScope: "Идентификационные сведения за указанный период",
  subjectUserId: "clabc12345678",
};

describe("Government requests: fail-closed validation", () => {
  it("accepts metadata only", () => {
    assert.equal(createGovernmentRequestSchema.safeParse(valid).success, true);
    assert.equal(createGovernmentRequestSchema.safeParse({ ...valid, phoneE164: "+375291234567" }).success, false);
    assert.equal(createGovernmentRequestSchema.safeParse({ ...valid, encryptedPhone: "ciphertext" }).success, false);
    assert.equal(createGovernmentRequestSchema.safeParse({ ...valid, requestFile: "base64" }).success, false);
  });

  it("rejects impossible dates, empty legal basis and oversized fields", () => {
    assert.equal(createGovernmentRequestSchema.safeParse({ ...valid, receivedDate: "2026-02-30" }).success, false);
    assert.equal(createGovernmentRequestSchema.safeParse({ ...valid, legalBasis: "" }).success, false);
    assert.equal(createGovernmentRequestSchema.safeParse({ ...valid, requestedScope: "x".repeat(2001) }).success, false);
  });

  it("requires outcome notes for rejecting or closing", () => {
    assert.equal(updateGovernmentRequestSchema.safeParse({ status: "CLOSED" }).success, false);
    assert.equal(updateGovernmentRequestSchema.safeParse({ status: "REJECTED", resolutionNote: " " }).success, false);
    assert.equal(updateGovernmentRequestSchema.safeParse({ status: "IN_REVIEW" }).success, true);
    assert.equal(updateGovernmentRequestSchema.safeParse({ status: "CLOSED", resolutionNote: "Результат рассмотрения" }).success, true);
    assert.equal(updateGovernmentRequestSchema.safeParse({ status: "CLOSED", phone: "+375291234567" }).success, false);
  });

  it("enforces terminal statuses", () => {
    assert.equal(canTransitionGovernmentRequest("RECEIVED", "IN_REVIEW"), true);
    assert.equal(canTransitionGovernmentRequest("RECEIVED", "CLOSED"), false);
    assert.equal(canTransitionGovernmentRequest("IN_REVIEW", "CLOSED"), true);
    assert.equal(canTransitionGovernmentRequest("IN_REVIEW", "REJECTED"), true);
    assert.equal(canTransitionGovernmentRequest("CLOSED", "IN_REVIEW"), false);
    assert.equal(canTransitionGovernmentRequest("REJECTED", "RECEIVED"), false);
  });

  it("rejects cross-site, foreign-origin and missing-origin mutations", () => {
    const host = "https://admin.mamago.by";
    assert.equal(isAllowedGovernmentRequestOrigin(host, host, "same-origin"), true);
    assert.equal(isAllowedGovernmentRequestOrigin(host, host, null), true);
    assert.equal(isAllowedGovernmentRequestOrigin(null, host, "same-origin"), false);
    assert.equal(isAllowedGovernmentRequestOrigin("https://evil.example", host, "same-origin"), false);
    assert.equal(isAllowedGovernmentRequestOrigin(host, host, "cross-site"), false);
  });
});
