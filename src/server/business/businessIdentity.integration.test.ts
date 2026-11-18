import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import prisma from "@/lib/prisma";
import { getBusinessPayer, saveBusinessPayer } from "./payerProfile";
import { recordNpdCheck } from "./npdCheck";
import { registrationSchema, NPD_SOURCE, normalizeOtherPayerType } from "@/lib/business/registrationIdentity";
import { approve } from "@/server/services/businessVerification.service";
import { createBusinessAction } from "@/app/business/onboarding/actions";
import { createSession } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";

// Only invoked by gate-env.sh against a throwaway PostgreSQL database.
const prefix = `identity-${Date.now()}`;
const ids: string[] = [];
async function user(role: "USER" | "ADMIN" = "USER") {
  const row = await prisma.user.create({ data: { email: `${prefix}-${ids.length}@example.invalid`, role } });
  ids.push(row.id); return row;
}
// businessVerification.service fires notifications without awaiting them, and
// createNotification in turn dispatches IN_APP/EMAIL/TELEGRAM delivery rows in
// the background. Deleting users while those writes are in flight deadlocks
// (40P01) on the Notification/NotificationDelivery FK cascade, so every test
// that triggers them waits for the chain to finish before cleanup runs.
const DELIVERY_CHANNELS = 3; // IN_APP, EMAIL, TELEGRAM — one row each per notification.
async function waitFor(label: string, done: () => Promise<boolean>, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await done())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
async function notificationsSettled(userIds: string[]) {
  const notifications = await prisma.notification.findMany({
    where: { userId: { in: userIds } },
    select: { deliveries: { select: { status: true } } },
  });
  return notifications.every(({ deliveries }) =>
    deliveries.length === DELIVERY_CHANNELS && deliveries.every(({ status }) => status !== "PENDING"));
}
test.after(async () => {
  await waitFor("notification deliveries to settle", () => notificationsSettled(ids));
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test("OTHER payer normalizes legacy and linked business types to an editable option", () => {
  for (const value of ["UNSPECIFIED", "BUSINESS", undefined, null]) assert.equal(normalizeOtherPayerType(value), "LEGAL_ENTITY");
  for (const value of ["LEGAL_ENTITY", "SOLE_PROPRIETOR", "SELF_EMPLOYED"]) assert.equal(normalizeOtherPayerType(value), value);
});

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
  await prisma.businessMember.create({ data: { businessId: business.id, userId: owner.id, role: "OWNER", isActive: true } });
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
  await prisma.businessMember.update({
    where: { businessId_userId: { businessId: business.id, userId: owner.id } },
    data: { isActive: false },
  });
  await assert.rejects(getBusinessPayer(owner.id), /OWNER_REQUIRED/);
  await assert.rejects(saveBusinessPayer(owner.id, { identityMode: "BUSINESS" }), /OWNER_REQUIRED/);
});

test("legacy discrepancy is never inferred or rewritten on read", async () => {
  const owner = await user();
  const business = await prisma.business.create({ data: { ownerUserId: owner.id, name: "Existing", legalName: "Existing official", verificationStatus: "APPROVED" } });
  await prisma.businessMember.create({ data: { businessId: business.id, userId: owner.id, role: "OWNER", isActive: true } });
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


// Run the *real* Next Server Action with a valid DB-backed session and
// request-scoped cookies. No fake user argument is passed to the action.
async function submitIdentityChangeAs(ownerId: string, data: FormData) {
  const token = await createSession(ownerId);
  const requestCookies = {
    get(name: string) {
      return name === SESSION_COOKIE_NAME ? { name, value: token } : undefined;
    },
  };
  // Only the request context is simulated: authentication, ACL and Business
  // mutations use the production implementations and a real PostgreSQL DB.
  const workStore = {
    route: "/business/onboarding",
    page: "/business/onboarding",
    incrementalCache: {},
  };
  const requestStore = {
    type: "request",
    phase: "action",
    cookies: requestCookies,
    userspaceMutableCookies: requestCookies,
  };
  return workAsyncStorage.run(workStore as never, () =>
    workUnitAsyncStorage.run(requestStore as never, () =>
      createBusinessAction(null, data)
    )
  );
}

test("real registration Server Action rejects revoked OWNER and preserves approved data; active OWNER can resubmit", async () => {
  const owner = await user();
  const phone = "+375291234567";
  const verifiedAt = new Date("2026-11-17T08:00:00.000Z");
  const business = await prisma.business.create({
    data: {
      ownerUserId: owner.id,
      name: "Original public name",
      unp: "876543219",
      subjectType: "SELF_EMPLOYED_NPD",
      registrationFullName: "Иванов Иван Иванович",
      phone,
      contactPhoneVerifiedAt: verifiedAt,
      npdCheckStatus: "CONFIRMED",
      verificationStatus: "APPROVED",
      isVerified: true,
      approvedAt: verifiedAt,
    },
  });
  await prisma.businessMember.create({
    data: { businessId: business.id, userId: owner.id, role: "OWNER", isActive: false },
  });

  function formData() {
    const form = new FormData();
    form.set("requestIdentityChange", "true");
    form.set("subjectType", "SELF_EMPLOYED_NPD");
    form.set("unp", business.unp!);
    form.set("registrationFullName", "Петров Пётр Петрович");
    form.set("publicName", "Changed public name");
    form.set("phone", phone); // Already verified in Business; no OTP bypass mock.
    return form;
  }

  const before = await prisma.business.findUniqueOrThrow({ where: { id: business.id } });
  const denied = await submitIdentityChangeAs(owner.id, formData());
  assert.equal(denied?.ok, false);
  assert.match(denied?.ok === false ? denied.message : "", /Нет доступа/);
  const unchanged = await prisma.business.findUniqueOrThrow({ where: { id: business.id } });
  for (const field of [
    "name", "unp", "subjectType", "registrationFullName", "verificationStatus",
    "isVerified", "approvedAt", "npdCheckStatus", "contactPhoneVerifiedAt", "updatedAt",
  ] as const) assert.deepEqual(unchanged[field], before[field], field);

  await prisma.businessMember.update({
    where: { businessId_userId: { businessId: business.id, userId: owner.id } },
    data: { isActive: true },
  });
  await assert.rejects(submitIdentityChangeAs(owner.id, formData()), /NEXT_REDIRECT/);
  const changed = await prisma.business.findUniqueOrThrow({ where: { id: business.id } });
  assert.equal(changed.name, "Changed public name");
  assert.equal(changed.registrationFullName, "Петров Пётр Петрович");
  assert.equal(changed.unp, before.unp);
  assert.equal(changed.verificationStatus, "PENDING");
  assert.equal(changed.isVerified, false);
  assert.equal(changed.npdCheckStatus, "REVIEW_REQUIRED");
  assert.equal(changed.approvedAt, null);

  // Resubmission notifies the owner and every admin in the background; wait
  // until those notifications exist so cleanup can drain their deliveries.
  const admins = await prisma.user.findMany({ where: { id: { in: ids }, role: "ADMIN" }, select: { id: true } });
  await waitFor("verification notifications", async () => {
    const [submitted, adminNotices] = await Promise.all([
      prisma.notification.count({ where: { userId: owner.id, type: "BUSINESS_VERIFICATION_SUBMITTED", entityId: business.id } }),
      prisma.notification.count({ where: { userId: { in: admins.map((a) => a.id) }, type: "BUSINESS_APPLICATION_CREATED", entityId: business.id } }),
    ]);
    return submitted === 1 && adminNotices === admins.length;
  });
  await waitFor("notification deliveries to settle", () => notificationsSettled(ids));
});

test("additive migration is idempotent on existing data", async () => {
  const sql = readFileSync("prisma/migrations/20261117120000_business_identity_rc1/migration.sql", "utf8");
  // Execute the exact statements a second time after migrate deploy applied them.
  const boundary = sql.indexOf('ALTER TABLE');
  await prisma.$executeRawUnsafe(sql.slice(0, boundary));
  for (const statement of sql.slice(boundary).split(';').filter(s => s.trim())) await prisma.$executeRawUnsafe(statement);
});
