import { describe, expect, it } from "vitest";
import { billingPayerInputSchema } from "./billingPayerProfile";

const company = { payerType: "LEGAL_ENTITY", legalName: "ООО Пример", unp: "123456789", legalAddress: "Минск, улица Примерная 1" };

describe("billing payer identity validation", () => {
  it("accepts a legal entity with mandatory requisites", () => {
    expect(billingPayerInputSchema.safeParse(company).success).toBe(true);
  });
  it("rejects legal entities without UNP", () => {
    expect(billingPayerInputSchema.safeParse({ ...company, unp: undefined }).success).toBe(false);
  });
  it("rejects invalid UNP", () => {
    expect(billingPayerInputSchema.safeParse({ ...company, unp: "123" }).success).toBe(false);
  });
  it("accepts a sole proprietor with UNP", () => {
    expect(billingPayerInputSchema.safeParse({ payerType: "SOLE_PROPRIETOR", legalName: "Иванов Иван", unp: "123456789" }).success).toBe(true);
  });
  it("accepts self-employed without UNP", () => {
    expect(billingPayerInputSchema.safeParse({ payerType: "SELF_EMPLOYED", legalName: "Иванов Иван" }).success).toBe(true);
  });
  it("rejects malformed email", () => {
    expect(billingPayerInputSchema.safeParse({ ...company, contactEmail: "not-an-email" }).success).toBe(false);
  });
  it("does not accept a forged businessId field", () => {
    const result = billingPayerInputSchema.safeParse({ ...company, businessId: "other-business" });
    expect(result.success).toBe(true);
    if (result.success) expect("businessId" in result.data).toBe(false);
  });
});
