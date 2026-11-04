import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { billingPayerInputSchema } from "./billingPayerProfile";

const company = { payerType: "LEGAL_ENTITY", legalName: "ООО Пример", unp: "123456789", legalAddress: "Минск, улица Примерная 1" };

describe("billing payer identity validation", () => {
  it("accepts a legal entity with mandatory requisites", () => {
    assert.equal(billingPayerInputSchema.safeParse(company).success, true);
  });
  it("rejects legal entities without UNP", () => {
    assert.equal(billingPayerInputSchema.safeParse({ ...company, unp: undefined }).success, false);
  });
  it("rejects invalid UNP", () => {
    assert.equal(billingPayerInputSchema.safeParse({ ...company, unp: "123" }).success, false);
  });
  it("accepts a sole proprietor with UNP", () => {
    assert.equal(billingPayerInputSchema.safeParse({ payerType: "SOLE_PROPRIETOR", legalName: "Иванов Иван", unp: "123456789" }).success, true);
  });
  it("accepts self-employed without UNP", () => {
    assert.equal(billingPayerInputSchema.safeParse({ payerType: "SELF_EMPLOYED", legalName: "Иванов Иван" }).success, true);
  });
  it("rejects malformed email", () => {
    assert.equal(billingPayerInputSchema.safeParse({ ...company, contactEmail: "not-an-email" }).success, false);
  });
  it("does not accept a forged businessId field", () => {
    const result = billingPayerInputSchema.safeParse({ ...company, businessId: "other-business" });
    assert.equal(result.success, true);
    if (result.success) assert.equal("businessId" in result.data, false);
  });
});
