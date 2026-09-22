import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/auth/crypto";
import { createSession, validateSession } from "@/lib/auth/session";
import { verifyLoginPassword } from "@/lib/auth/credentials";
import { deleteAccount } from "./deleteAccount.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at a disposable SEC-007 test database");

const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = parsedDatabaseUrl.pathname.replace(/^\//u, "");
if (!/(sec.?007|test)/iu.test(databaseName) || !["127.0.0.1", "localhost"].includes(parsedDatabaseUrl.hostname)) {
  throw new Error("SEC-007 integration tests refuse non-local or non-test databases");
}

const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const marker = randomUUID();

async function createUser(label: string, extra: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: {
      email: `${label}-${marker}@example.invalid`,
      phoneE164: `+37529${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
      status: "ACTIVE",
      ...extra,
    },
  });
}

async function main(): Promise<void> {
  const password = "SEC-007-valid-password-123";
  const passwordHash = await hashPassword(password);
  const family = await createUser("family", {
    passwordHash,
    displayName: "Sensitive Parent",
    resetToken: `reset-${marker}`,
    emailVerificationToken: `verify-${marker}`,
    telegramConnected: true,
    telegramId: `tg-${marker}`,
    telegramUsername: "private_username",
  });
  const originalEmail = family.email;
  const originalPhone = family.phoneE164!;
  const sessionA = await createSession(family.id);
  const sessionB = await createSession(family.id);

  const child = await prisma.child.create({
    data: {
      parentId: family.id,
      name: "Sensitive Child",
      birthDate: new Date("2020-01-02"),
      systemInterests: { create: { interestSlug: "music" } },
      customInterests: { create: { label: "Private interest" } },
    },
  });
  await prisma.planItem.create({ data: { userId: family.id, date: "2026-09-22", title: "Private plan" } });
  await prisma.notification.create({
    data: {
      userId: family.id,
      audience: "USER",
      type: "SECURITY_ALERT",
      title: "Private notification",
      body: "Sensitive account message",
    },
  });
  await prisma.phoneOtp.create({
    data: {
      userId: family.id,
      phoneE164: originalPhone,
      purpose: "LOGIN",
      codeHash: `otp-${marker}`,
      expiresAt: new Date(Date.now() + 60_000),
      lastSentAt: new Date(),
    },
  });
  await prisma.userActionToken.create({
    data: {
      userId: family.id,
      purpose: "MIGRATED_ACCOUNT_ACTIVATION",
      tokenHash: `action-${marker}`,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  await prisma.telegramConnection.create({
    data: {
      userId: family.id,
      environment: "DEV",
      botUsername: "test_bot",
      telegramUserId: `user-${marker}`,
      telegramChatId: `chat-${marker}`,
      telegramUsername: "private_username",
      telegramFirstName: "Private",
    },
  });
  const privateTempMedia = await prisma.mediaAsset.create({
    data: {
      kind: "IMAGE",
      status: "TEMP",
      filename: `private-${marker}.jpg`,
      originalName: "private-family-photo.jpg",
      mimeType: "image/jpeg",
      extension: "jpg",
      sizeBytes: 123,
      storageKey: `sec007/private-${marker}.jpg`,
      publicUrl: `/api/media/file/sec007/private-${marker}.jpg`,
      sourceType: "USER_UPLOAD",
      uploadedById: family.id,
      wizardSessionId: `wizard-${marker}`,
    },
  });

  const owner = await createUser("owner");
  const business = await prisma.business.create({
    data: {
      name: "Preserved Business",
      ownerUserId: owner.id,
      billingAccount: { create: { depositBalance: 42 } },
      members: { create: { userId: owner.id, role: "OWNER" } },
    },
    include: { billingAccount: true },
  });
  const booking = await prisma.bookingRequest.create({
    data: {
      businessId: business.id,
      userId: family.id,
      publicationType: "OFFER",
      customerName: "Sensitive Parent",
      customerPhone: originalPhone,
      customerEmail: originalEmail,
      customerComment: "Sensitive comment",
      childName: "Sensitive Child",
      childAge: 6,
    },
  });
  const thread = await prisma.directThread.create({
    data: { businessId: business.id, customerUserId: family.id, publicationType: "OFFER", bookingRequestId: booking.id },
  });
  const message = await prisma.directMessage.create({
    data: { threadId: thread.id, senderType: "CUSTOMER", senderUserId: family.id, body: "Shared conversation record" },
  });
  const accessRequest = await prisma.businessAccessRequest.create({
    data: {
      businessId: business.id,
      requesterUserId: family.id,
      unp: `unp-${marker}`,
      name: "Sensitive Parent",
      phone: originalPhone,
      email: originalEmail,
      requesterRole: "MANAGER",
      comment: "Sensitive access comment",
    },
  });
  const audit = await prisma.auditLog.create({
    data: { actorId: family.id, targetType: "User", targetId: family.id, action: "SEC007_TEST" },
  });
  const publishedRoute = await prisma.route.create({
    data: {
      slug: `sec007-${marker}`,
      title: "Preserved published route",
      ageTags: [],
      authorId: family.id,
      status: "PUBLISHED",
      visibility: "PUBLIC",
    },
  });

  assert.deepEqual(await deleteAccount(family.id, prisma), { ok: true });
  const tombstone = await prisma.user.findUniqueOrThrow({ where: { id: family.id } });
  assert.match(tombstone.email, /^deleted-[a-f0-9]{64}@deleted\.invalid$/u);
  assert.equal(tombstone.phoneE164, null);
  assert.equal(tombstone.passwordHash, null);
  assert.equal(tombstone.displayName, null);
  assert.equal(tombstone.telegramId, null);
  assert.equal(tombstone.deletedAt instanceof Date, true);
  assert.equal(tombstone.status, "SUSPENDED");
  assert.equal(await prisma.session.count({ where: { userId: family.id } }), 0);
  assert.equal(await validateSession(sessionA), null);
  assert.equal(await validateSession(sessionB), null);
  assert.equal(await verifyLoginPassword(password, tombstone), false);
  assert.equal(await prisma.phoneOtp.count({ where: { userId: family.id } }), 0);
  assert.equal(await prisma.userActionToken.count({ where: { userId: family.id } }), 0);
  assert.equal(await prisma.child.count({ where: { parentId: family.id } }), 0);
  assert.equal(await prisma.childInterest.count({ where: { childId: child.id } }), 0);
  assert.equal(await prisma.childCustomInterest.count({ where: { childId: child.id } }), 0);
  assert.equal(await prisma.planItem.count({ where: { userId: family.id } }), 0);
  assert.equal(await prisma.notification.count({ where: { userId: family.id } }), 0);
  assert.equal(await prisma.telegramConnection.count({ where: { userId: family.id } }), 0);
  assert.equal(await prisma.mediaAsset.count({ where: { id: privateTempMedia.id } }), 0);

  const preservedBooking = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: booking.id } });
  assert.equal(preservedBooking.userId, null);
  assert.equal(preservedBooking.customerName, "Удалённый пользователь");
  assert.equal(preservedBooking.customerPhone, "");
  assert.equal(preservedBooking.customerEmail, null);
  assert.equal(preservedBooking.customerComment, null);
  assert.equal(preservedBooking.childName, null);
  const preservedAccess = await prisma.businessAccessRequest.findUniqueOrThrow({ where: { id: accessRequest.id } });
  assert.equal(preservedAccess.requesterUserId, family.id);
  assert.equal(preservedAccess.name, "Удалённый пользователь");
  assert.equal(preservedAccess.phone, null);
  assert.equal(preservedAccess.email, null);
  assert.equal(preservedAccess.comment, null);
  assert.equal((await prisma.directThread.findUniqueOrThrow({ where: { id: thread.id } })).customerUserId, family.id);
  assert.equal((await prisma.directMessage.findUniqueOrThrow({ where: { id: message.id } })).senderUserId, null);
  assert.equal(await prisma.business.count({ where: { id: business.id } }), 1);
  assert.equal(await prisma.billingAccount.count({ where: { id: business.billingAccount!.id } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { id: audit.id } }), 1);
  const preservedRoute = await prisma.route.findUniqueOrThrow({ where: { id: publishedRoute.id } });
  assert.equal(preservedRoute.status, "PUBLISHED");
  assert.equal(preservedRoute.authorId, null);

  const reusedIdentity = await prisma.user.create({ data: { email: originalEmail, phoneE164: originalPhone } });
  assert.equal(reusedIdentity.email, originalEmail);
  assert.equal(reusedIdentity.phoneE164, originalPhone);

  const manager = await createUser("manager");
  await prisma.businessMember.create({ data: { businessId: business.id, userId: manager.id, role: "MANAGER" } });
  assert.deepEqual(await deleteAccount(manager.id, prisma), { ok: true });
  assert.equal(await prisma.businessMember.count({ where: { userId: manager.id } }), 0);
  assert.equal(await prisma.business.count({ where: { id: business.id } }), 1);

  const ownerSession = await createSession(owner.id);
  assert.deepEqual(await deleteAccount(owner.id, prisma), { ok: false, code: "BUSINESS_OWNER_TRANSFER_REQUIRED" });
  assert.notEqual(await validateSession(ownerSession), null);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).deletedAt, null);

  const onlyAdmin = await createUser("only-admin", { role: "ADMIN" });
  const adminSession = await createSession(onlyAdmin.id);
  assert.deepEqual(await deleteAccount(onlyAdmin.id, prisma), { ok: false, code: "LAST_ADMIN" });
  assert.notEqual(await validateSession(adminSession), null);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: onlyAdmin.id } })).deletedAt, null);

  const rollbackUser = await createUser("rollback", { passwordHash });
  const rollbackSession = await createSession(rollbackUser.id);
  const rollbackChild = await prisma.child.create({ data: { parentId: rollbackUser.id, name: "Rollback Child" } });
  const tombstoneDigest = createHash("sha256")
    .update(`mamago-deleted-user:${rollbackUser.id}`)
    .digest("hex");
  await prisma.user.create({ data: { email: `deleted-${tombstoneDigest}@deleted.invalid` } });
  await assert.rejects(deleteAccount(rollbackUser.id, prisma));
  const rolledBack = await prisma.user.findUniqueOrThrow({ where: { id: rollbackUser.id } });
  assert.equal(rolledBack.email, rollbackUser.email);
  assert.equal(rolledBack.deletedAt, null);
  assert.notEqual(await validateSession(rollbackSession), null);
  assert.equal(await prisma.child.count({ where: { id: rollbackChild.id } }), 1);

  console.log("SEC-007 disposable PostgreSQL integration tests: OK");
}

main()
  .catch((error) => {
    console.error("SEC-007 disposable PostgreSQL integration tests: FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
