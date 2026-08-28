import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createSession, validateSession } from "./session";
import { hashToken } from "./tokenHash";
import { requestPasswordReset, resetPassword } from "@/server/auth/password-reset";
import { issueUserActionToken } from "@/server/auth/userActionToken.service";
import { checkUserStatus } from "@/server/services/userModeration.service";
import { unbanUser } from "@/server/services/userModeration.service";

async function main(): Promise<void> {
  const marker = `foundation-${randomUUID()}@example.invalid`;
  let activeUserId: string | null = null;
  let pendingUserId: string | null = null;
  let limitedUserId: string | null = null;
  let deletedUserId: string | null = null;
  let moderatorUserId: string | null = null;
  const initialActionTokenCount = await prisma.userActionToken.count();

  try {
    const [active, pending, limited, deleted, moderator] = await prisma.$transaction([
      prisma.user.create({
        data: {
          email: `active-${marker}`,
          passwordHash: null,
          status: "ACTIVE",
          lastLoginAt: new Date(),
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `pending-${marker}`,
          passwordHash: null,
          status: "PENDING_ACTIVATION",
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `limited-${marker}`,
          passwordHash: null,
          status: "LIMITED",
          lastLoginAt: new Date(),
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `deleted-${marker}`,
          passwordHash: null,
          status: "ACTIVE",
          lastLoginAt: new Date(),
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `moderator-${marker}`,
          passwordHash: null,
          status: "ACTIVE",
          role: "MODERATOR",
          lastLoginAt: new Date(),
        },
        select: { id: true },
      }),
    ]);
    activeUserId = active.id;
    pendingUserId = pending.id;
    limitedUserId = limited.id;
    deletedUserId = deleted.id;
    moderatorUserId = moderator.id;

    await assert.rejects(
      createSession(pending.id),
      /ACCOUNT_NOT_SESSION_ELIGIBLE/,
    );
    assert.equal(await prisma.session.count({ where: { userId: pending.id } }), 0);
    assert.equal((await checkUserStatus(pending.id)).isAllowed, false);
    await assert.rejects(
      unbanUser({
        userId: pending.id,
        moderatorId: moderator.id,
        reason: "adversarial pending activation test",
      }),
      /USER_NOT_BLOCKED/,
    );
    assert.equal(
      (await prisma.user.findUnique({ where: { id: pending.id } }))?.status,
      "PENDING_ACTIVATION",
    );

    // A migrated account can initiate the same self-service password reset as
    // an active account. requestPasswordReset stores only the token hash, so
    // assert issuance here and then install a known raw token for completion.
    await requestPasswordReset(`pending-${marker}`);
    const pendingAfterRequest = await prisma.user.findUnique({
      where: { id: pending.id },
      select: { resetToken: true, resetTokenExpires: true },
    });
    assert.ok(pendingAfterRequest?.resetToken);
    assert.ok(pendingAfterRequest?.resetTokenExpires);

    const activationToken = await issueUserActionToken({
      userId: pending.id,
      purpose: "MIGRATED_ACCOUNT_ACTIVATION",
    });
    const pendingResetRaw = randomUUID();
    await prisma.user.update({
      where: { id: pending.id },
      data: {
        resetToken: hashToken(pendingResetRaw),
        resetTokenExpires: new Date(Date.now() + 60_000),
      },
    });

    await resetPassword(pendingResetRaw, "Foundation-reset-123");
    const pendingAfterReset = await prisma.user.findUnique({
      where: { id: pending.id },
      select: {
        status: true,
        passwordHash: true,
        emailVerifiedAt: true,
        resetToken: true,
        resetTokenExpires: true,
      },
    });
    assert.equal(pendingAfterReset?.status, "ACTIVE");
    assert.ok(pendingAfterReset?.passwordHash);
    assert.ok(pendingAfterReset?.emailVerifiedAt);
    assert.equal(pendingAfterReset?.resetToken, null);
    assert.equal(pendingAfterReset?.resetTokenExpires, null);

    const staleActivationToken = await prisma.userActionToken.findUnique({
      where: { id: activationToken.id },
      select: { invalidatedAt: true, usedAt: true },
    });
    assert.ok(staleActivationToken?.invalidatedAt);
    assert.equal(staleActivationToken?.usedAt, null);
    assert.equal((await checkUserStatus(pending.id)).isAllowed, true);

    const token = await createSession(active.id);
    assert.equal((await validateSession(token))?.id, active.id);

    const activeResetRaw = randomUUID();
    await prisma.user.update({
      where: { id: active.id },
      data: {
        resetToken: hashToken(activeResetRaw),
        resetTokenExpires: new Date(Date.now() + 60_000),
      },
    });
    await resetPassword(activeResetRaw, "Foundation-active-reset-123");
    const activeAfterReset = await prisma.user.findUnique({ where: { id: active.id } });
    assert.ok(activeAfterReset?.passwordHash);
    assert.equal(activeAfterReset?.resetToken, null);

    const limitedToken = await createSession(limited.id);
    assert.equal((await validateSession(limitedToken))?.id, limited.id);

    const deletedUserToken = await createSession(deleted.id);
    await prisma.user.delete({ where: { id: deleted.id } });
    deletedUserId = null;
    assert.equal(await validateSession(deletedUserToken), null);

    await prisma.user.update({
      where: { id: active.id },
      data: { status: "PENDING_ACTIVATION" },
    });
    const concurrentResults = await Promise.all([
      validateSession(token),
      validateSession(token),
    ]);
    assert.deepEqual(concurrentResults, [null, null]);
    assert.equal(await prisma.session.count({ where: { userId: active.id } }), 0);

    const suspendedToken = limitedToken;
    await prisma.user.update({
      where: { id: limited.id },
      data: { status: "SUSPENDED", suspendedUntil: new Date(Date.now() + 60_000) },
    });
    assert.equal(await validateSession(suspendedToken), null);
  } finally {
    const ids = [
      activeUserId,
      pendingUserId,
      limitedUserId,
      deletedUserId,
      moderatorUserId,
    ].filter(
      (id): id is string => id !== null,
    );
    if (ids.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    assert.equal(await prisma.userActionToken.count(), initialActionTokenCount);
    await prisma.$disconnect();
  }

  console.log("session eligibility integration tests: OK");
}

main().catch((error) => {
  console.error("session eligibility integration tests: FAILED", error);
  process.exitCode = 1;
});
