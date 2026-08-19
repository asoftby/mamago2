import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { UserActionTokenPurpose, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/tokenHash";
import {
  consumeUserActionToken,
  invalidateUserActionTokens,
  issueUserActionToken,
  ISSUE_TRANSACTION_MAX_ATTEMPTS,
  MIGRATED_ACCOUNT_ACTIVATION_TOKEN_TTL_MS,
  UserActionTokenIssueError,
} from "./userActionToken.service";

const PURPOSE = "MIGRATED_ACCOUNT_ACTIVATION" as const;
const WRONG_PURPOSE = "PASSWORD_RESET" as UserActionTokenPurpose;

type FixtureUser = {
  id: string;
  status: UserStatus;
  passwordHash: string | null;
};

async function createFixtureUser(
  marker: string,
  label: string,
  status: UserStatus,
  deletedAt: Date | null = null,
): Promise<FixtureUser> {
  return prisma.user.create({
    data: {
      email: `token-${label}-${marker}@example.invalid`,
      passwordHash: null,
      status,
      deletedAt,
    },
    select: { id: true, status: true, passwordHash: true },
  });
}

async function main(): Promise<void> {
  const marker = randomUUID();
  const initialTokenCount = await prisma.userActionToken.count();
  const createdUserIds: string[] = [];

  try {
    const pending = await createFixtureUser(marker, "pending", "PENDING_ACTIVATION");
    createdUserIds.push(pending.id);
    const secondPending = await createFixtureUser(
      marker,
      "second-pending",
      "PENDING_ACTIVATION",
    );
    createdUserIds.push(secondPending.id);
    const statusTransition = await createFixtureUser(
      marker,
      "status-transition",
      "PENDING_ACTIVATION",
    );
    createdUserIds.push(statusTransition.id);
    const deletedTransition = await createFixtureUser(
      marker,
      "deleted-transition",
      "PENDING_ACTIVATION",
    );
    createdUserIds.push(deletedTransition.id);
    const active = await createFixtureUser(marker, "active", "ACTIVE");
    createdUserIds.push(active.id);
    const limited = await createFixtureUser(marker, "limited", "LIMITED");
    createdUserIds.push(limited.id);
    const suspended = await createFixtureUser(marker, "suspended", "SUSPENDED");
    createdUserIds.push(suspended.id);
    const deleted = await createFixtureUser(
      marker,
      "deleted",
      "PENDING_ACTIVATION",
      new Date(),
    );
    createdUserIds.push(deleted.id);

    assert.equal(ISSUE_TRANSACTION_MAX_ATTEMPTS, 3);
    for (const denied of [active, limited, suspended, deleted]) {
      await assert.rejects(
        issueUserActionToken({ userId: denied.id, purpose: PURPOSE }),
        (error: unknown) =>
          error instanceof UserActionTokenIssueError &&
          error.code === "USER_ACTION_TOKEN_UNAVAILABLE" &&
          !error.message.includes(denied.id),
      );
    }
    await assert.rejects(
      issueUserActionToken({ userId: randomUUID(), purpose: PURPOSE }),
      UserActionTokenIssueError,
    );
    await assert.rejects(
      issueUserActionToken({ userId: pending.id, purpose: WRONG_PURPOSE }),
      UserActionTokenIssueError,
    );
    assert.deepEqual(
      await consumeUserActionToken({ token: randomUUID(), purpose: WRONG_PURPOSE }),
      { consumed: false },
    );
    assert.equal(
      await invalidateUserActionTokens({
        userId: pending.id,
        purpose: WRONG_PURPOSE,
      }),
      0,
    );

    const issuedAt = new Date("2026-07-23T00:00:00.000Z");
    const first = await issueUserActionToken(
      { userId: pending.id, purpose: PURPOSE },
      { clock: { now: () => issuedAt } },
    );
    assert.match(first.token, /^[a-f0-9]{64}$/u);
    assert.equal(
      first.expiresAt.getTime(),
      issuedAt.getTime() + MIGRATED_ACCOUNT_ACTIVATION_TOKEN_TTL_MS,
    );

    const firstRecord = await prisma.userActionToken.findUnique({
      where: { tokenHash: hashToken(first.token) },
    });
    assert.ok(firstRecord);
    assert.equal(firstRecord.tokenHash, hashToken(first.token));
    assert.notEqual(firstRecord.tokenHash, first.token);
    assert.equal(firstRecord.purpose, PURPOSE);
    assert.equal(firstRecord.usedAt, null);
    assert.equal(firstRecord.invalidatedAt, null);

    const replacement = await issueUserActionToken({
      userId: pending.id,
      purpose: PURPOSE,
    });
    assert.notEqual(replacement.token, first.token);
    assert.ok(
      (await prisma.userActionToken.findUnique({ where: { id: firstRecord.id } }))
        ?.invalidatedAt,
    );
    assert.deepEqual(
      await consumeUserActionToken({ token: first.token, purpose: PURPOSE }),
      { consumed: false },
    );

    const userBeforeConsume = await prisma.user.findUniqueOrThrow({
      where: { id: pending.id },
      select: { status: true, passwordHash: true },
    });
    const sessionsBeforeConsume = await prisma.session.count({
      where: { userId: pending.id },
    });
    const concurrentConsume = await Promise.all([
      consumeUserActionToken({ token: replacement.token, purpose: PURPOSE }),
      consumeUserActionToken({ token: replacement.token, purpose: PURPOSE }),
    ]);
    assert.equal(concurrentConsume.filter((result) => result.consumed).length, 1);
    assert.equal(concurrentConsume.filter((result) => !result.consumed).length, 1);
    const winner = concurrentConsume.find((result) => result.consumed);
    assert.ok(winner?.consumed);
    assert.equal(winner.userId, pending.id);
    assert.deepEqual(
      await consumeUserActionToken({ token: replacement.token, purpose: PURPOSE }),
      { consumed: false },
    );
    assert.deepEqual(
      await prisma.user.findUniqueOrThrow({
        where: { id: pending.id },
        select: { status: true, passwordHash: true },
      }),
      userBeforeConsume,
    );
    assert.equal(
      await prisma.session.count({ where: { userId: pending.id } }),
      sessionsBeforeConsume,
    );

    const afterUsed = await issueUserActionToken({
      userId: pending.id,
      purpose: PURPOSE,
    });
    const usedRecord = await prisma.userActionToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(replacement.token) },
    });
    assert.ok(usedRecord.usedAt);
    assert.equal(usedRecord.invalidatedAt, null);

    const boundaryNow = new Date(afterUsed.expiresAt);
    assert.deepEqual(
      await consumeUserActionToken(
        { token: afterUsed.token, purpose: PURPOSE },
        { clock: { now: () => boundaryNow } },
      ),
      { consumed: false },
    );

    const expired = await issueUserActionToken({
      userId: secondPending.id,
      purpose: PURPOSE,
    });
    await prisma.userActionToken.update({
      where: { tokenHash: hashToken(expired.token) },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    assert.deepEqual(
      await consumeUserActionToken({ token: expired.token, purpose: PURPOSE }),
      { consumed: false },
    );
    const invalidated = await issueUserActionToken({
      userId: secondPending.id,
      purpose: PURPOSE,
    });
    assert.ok(
      (
        await prisma.userActionToken.findUniqueOrThrow({
          where: { tokenHash: hashToken(expired.token) },
        })
      ).invalidatedAt,
    );
    assert.equal(
      await invalidateUserActionTokens({ userId: secondPending.id, purpose: PURPOSE }),
      1,
    );
    assert.equal(
      await invalidateUserActionTokens({ userId: secondPending.id, purpose: PURPOSE }),
      0,
    );
    assert.deepEqual(
      await consumeUserActionToken({ token: invalidated.token, purpose: PURPOSE }),
      { consumed: false },
    );

    const activeTransitionToken = await issueUserActionToken({
      userId: statusTransition.id,
      purpose: PURPOSE,
    });
    await prisma.user.update({
      where: { id: statusTransition.id },
      data: { status: "ACTIVE" },
    });
    assert.deepEqual(
      await consumeUserActionToken({
        token: activeTransitionToken.token,
        purpose: PURPOSE,
      }),
      { consumed: false },
    );
    assert.equal(
      (
        await prisma.userActionToken.findUniqueOrThrow({
          where: { tokenHash: hashToken(activeTransitionToken.token) },
        })
      ).usedAt,
      null,
    );

    await prisma.user.update({
      where: { id: statusTransition.id },
      data: { status: "PENDING_ACTIVATION" },
    });
    const suspendedTransitionToken = await issueUserActionToken({
      userId: statusTransition.id,
      purpose: PURPOSE,
    });
    await prisma.user.update({
      where: { id: statusTransition.id },
      data: { status: "SUSPENDED" },
    });
    assert.deepEqual(
      await consumeUserActionToken({
        token: suspendedTransitionToken.token,
        purpose: PURPOSE,
      }),
      { consumed: false },
    );

    const deletedTransitionToken = await issueUserActionToken({
      userId: deletedTransition.id,
      purpose: PURPOSE,
    });
    await prisma.user.update({
      where: { id: deletedTransition.id },
      data: { deletedAt: new Date() },
    });
    assert.deepEqual(
      await consumeUserActionToken({
        token: deletedTransitionToken.token,
        purpose: PURPOSE,
      }),
      { consumed: false },
    );

    assert.deepEqual(
      await consumeUserActionToken({ token: randomUUID(), purpose: PURPOSE }),
      { consumed: false },
    );

    const concurrentIssue = await Promise.all([
      issueUserActionToken({ userId: secondPending.id, purpose: PURPOSE }),
      issueUserActionToken({ userId: secondPending.id, purpose: PURPOSE }),
    ]);
    assert.equal(concurrentIssue.length, 2);
    assert.equal(
      await prisma.userActionToken.count({
        where: {
          userId: secondPending.id,
          purpose: PURPOSE,
          usedAt: null,
          invalidatedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      1,
    );
  } finally {
    if (createdUserIds.length > 0) {
      await prisma.adminAuditLog.deleteMany({
        where: {
          entityId: { in: createdUserIds },
          action: "MIGRATED_ACCOUNT_ACTIVATION_TOKEN_ISSUED",
        },
      });
    }
    for (const userId of createdUserIds) {
      await prisma.user.delete({ where: { id: userId } });
    }
    assert.equal(await prisma.userActionToken.count(), initialTokenCount);
    await prisma.$disconnect();
  }

  console.log("user action token service integration tests: OK");
}

main().catch((error) => {
  console.error("user action token service integration tests: FAILED", error);
  process.exitCode = 1;
});
