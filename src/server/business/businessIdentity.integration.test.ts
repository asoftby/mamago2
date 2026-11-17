import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import prisma from "@/lib/prisma";
import { getBusinessPayer, saveBusinessPayer } from "./payerProfile";
import { recordNpdCheck } from "./npdCheck";
import { registrationSchema, NPD_SOURCE } from "@/lib/business/registrationIdentity";
import { approve } from "@/server/services/businessVerification.service";

// Only invoked by gate-env.sh against a throwaway PostgreSQL database.
const prefix = `identity-${Date.now()}`;
const ids: string[] = [];
async function user(role: "USER" | "ADMIN" = "USER") {
  const row = await prisma.user.create({ data: { email: `${prefix}-${ids.length}@example.invalid`, role } });
  ids.push(row.id); return row;
}
test.after(async () => { await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect(); });

test("NPD registration requires FIO and separate public name without legalName", () => {
  const payload = { subjectType: "SELF_EMPLOYED_NPD", unp: "123456789", registrationFullName: "Иванов Иван", publicName: "Мастерская", phone: "+375291234567" };
  assert.equal(registrationSchema.parse(payload).legalName, "");
  assert.equal(registrationSchema.safeParse({ ...payload, registrationFullName: "" }).success, false);
  assert.equal(registrationSchema.safeParse({ ...payload, publicName: "" }).success, false);
  for (const subjectType of ["COMPANY", "SOLE_PROPRIETOR"]) {
    assert.equal(registrationSchema.safeParse({ ...payload, subjectType }).success, false);
    assert.equal(registrationSchema.safeParse({ ...payload, subjectType, legalName: "Официальное название" }).success, true);
  }
});

test("canonical payer ignores forged Business fields; explicit other payer stays isolated", async () => {
  const owner = await user(); const stranger = await user();
  const business = await prisma.business.create({ data: { ownerUserId: owner.id, name: "Public", legalName: "Official", unp: "123456789", subjectType: "COMPANY", verificationStatus: "APPROVED" } });
  await saveBusinessPayer(owner.id, { identityMode: "BUSINESS", businessId: "forged", subjectType: "SELF_EMPLOYED_NPD", legalName: "Forged", unp: "987654321", bankName: "Bank" });
  const resolved = await getBusinessPayer(owner.id);
  assert.equal(resolved.profile?.legalName, "Official");
  assert.equal(resolved.profile?.unp, "123456789");
  const stored = await prisma.billingPayerProfile.findUniqueOrThrow({ where: { businessId: business.id } });
  assert.equal(stored.legalName, ""); assert.equal(stored.unp, null);
  await assert.rejects(getBusinessPayer(stranger.id), /OWNER_REQUIRED/);
  await assert.rejects(saveBusinessPayer(stranger.id, { identityMode: "BUSINESS", businessId: business.id }), /OWNER_REQUIRED/);
  await saveBusinessPayer(owner.id, { identityMode: "OTHER", payerType: "SELF_EMPLOYED", legalName: "Other person", bankName: "Other bank" });
  assert.equal((await getBusinessPayer(owner.id)).profile?.legalName, "Other person");
  const unchanged = await prisma.business.findUniqueOrThrow({ where: { id: business.id } });
  assert.equal(unchanged.legalName, "Official"); assert.equal(unchanged.unp, "123456789"); assert.equal(unchanged.verificationStatus, "APPROVED");
});

test("legacy discrepancy is never inferred or rewritten on read", async () => {
  const owner = await user();
  const business = await prisma.business.create({ data: { ownerUserId: owner.id, name: "Existing", legalName: "Existing official", verificationStatus: "APPROVED" } });
  assert.equal(business.subjectType, "UNSPECIFIED");
  const profile = await prisma.billingPayerProfile.create({ data: { businessId: business.id, payerType: "LEGAL_ENTITY", legalName: "Different payer", bankAccount: "Preserve" } });
  assert.equal((await getBusinessPayer(owner.id)).identityMode, "LEGACY_REVIEW");
  assert.deepEqual(await prisma.billingPayerProfile.findUniqueOrThrow({ where: { id: profile.id } }), profile);
  assert.equal((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).verificationStatus, "APPROVED");
});

test("manual NPD result is audited, ADMIN-only and separate from moderation", async () => {
  const owner = await user(); const admin = await user("ADMIN");
  const business = await prisma.business.create({ data: { ownerUserId: owner.id, name: "Workshop", subjectType: "SELF_EMPLOYED_NPD", registrationFullName: "Private FIO", verificationStatus: "PENDING" } });
  await assert.rejects(recordNpdCheck(owner, business.id, "CONFIRMED"), /ADMIN_REQUIRED/);
  await assert.rejects(approve(business.id, admin.id), /НПД/);
  for (const result of ["UNAVAILABLE", "NOT_FOUND", "CONFIRMED"]) {
    await recordNpdCheck(admin, business.id, result);
    const updated = await prisma.business.findUniqueOrThrow({ where: { id: business.id } });
    assert.equal(updated.npdCheckStatus, result); assert.equal(updated.npdCheckedByUserId, admin.id);
    assert.equal(updated.npdCheckSource, NPD_SOURCE); assert.ok(updated.npdCheckedAt);
    assert.equal(updated.verificationStatus, "PENDING"); assert.equal(updated.isVerified, false);
    assert.equal(updated.name, "Workshop");
    if (result !== "CONFIRMED") await assert.rejects(approve(business.id, admin.id), /НПД/);
  }
  assert.equal(await prisma.businessVerificationLog.count({ where: { businessId: business.id } }), 3);
});

test("additive migration is idempotent on existing data", async () => {
  const sql = readFileSync("prisma/migrations/20261117120000_business_identity_rc1/migration.sql", "utf8");
  // Execute the exact statements a second time after migrate deploy applied them.
  const boundary = sql.indexOf('ALTER TABLE');
  await prisma.$executeRawUnsafe(sql.slice(0, boundary));
  for (const statement of sql.slice(boundary).split(';').filter(s => s.trim())) await prisma.$executeRawUnsafe(statement);
});
