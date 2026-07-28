import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/tokenHash";
import { verifyPassword } from "@/lib/auth/crypto";
import { verifyLoginPassword } from "@/lib/auth/credentials";
import { createSession, validateSession } from "@/lib/auth/session";
import { POST as requestActivation } from "@/app/api/auth/activation/request/route";
import { POST as completeActivation } from "@/app/api/auth/activation/complete/route";
import { resolveActivationEmailDelivery } from "./activationEmailGate";
import { completeMigratedAccountActivation } from "./activationCompletion.service";
import {
  activationRateLimitKey,
  checkActivationRateLimit,
  createActivationRateLimiter,
} from "./activationRateLimit";
import {
  invalidateUserActionTokens,
  issueUserActionToken,
} from "./userActionToken.service";

const PURPOSE = "MIGRATED_ACCOUNT_ACTIVATION" as const;

function request(url: string, body: unknown, ip: string): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": ip,
      "user-agent": "activation-integration-test",
    },
    body: JSON.stringify(body),
  });
}

async function main(): Promise<void> {
  const marker = randomUUID();
  const userIds: string[] = [];
  const rateLimitKeys: string[] = [];
  const previousTrustProxyHeaders = process.env.TRUST_PROXY_HEADERS;
  process.env.TRUST_PROXY_HEADERS = "true";
  const initial = {
    users: await prisma.user.count(),
    sessions: await prisma.session.count(),
    tokens: await prisma.userActionToken.count(),
  };

  try {
    const matrix = [
      ["development", "local", "false", "false", "DELIVERY_DISABLED"],
      ["development", "local", "true", "true", "DELIVERY_DISABLED"],
      ["production", "local", "true", "true", "DELIVERY_DISABLED"],
      ["production", "development", "true", "true", "DELIVERY_DISABLED"],
      ["production", "production", "false", "true", "DELIVERY_DISABLED"],
      ["production", "production", "true", "false", "DELIVERY_DISABLED"],
      ["production", "production", "true", "true", "DELIVERY_ALLOWED"],
    ] as const;
    for (const [nodeEnv, appEnvironment, productionEnabled, productionApproved, status] of matrix) {
      assert.deepEqual(
        resolveActivationEmailDelivery({
          nodeEnv,
          appEnvironment,
          productionEnabled,
          productionApproved,
        }),
        { status },
      );
    }
    assert.deepEqual(
      resolveActivationEmailDelivery({
        nodeEnv: undefined,
        appEnvironment: undefined,
        productionEnabled: undefined,
        productionApproved: undefined,
      }),
      { status: "DELIVERY_DISABLED" },
    );
    const failingLimiter = createActivationRateLimiter(async () => {
      throw new Error("simulated backend failure");
    });
    assert.deepEqual(
      await failingLimiter({ key: "test", limit: 1, windowMs: 60_000 }),
      { allowed: false },
    );

    const pending = await prisma.user.create({
      data: {
        email: `activation-pending-${marker}@example.invalid`,
        passwordHash: null,
        status: "PENDING_ACTIVATION",
      },
    });
    userIds.push(pending.id);
    const transition = await prisma.user.create({
      data: {
        email: `activation-transition-${marker}@example.invalid`,
        passwordHash: null,
        status: "PENDING_ACTIVATION",
      },
    });
    userIds.push(transition.id);
    const concurrent = await prisma.user.create({
      data: {
        email: `activation-concurrent-${marker}@example.invalid`,
        passwordHash: null,
        status: "PENDING_ACTIVATION",
      },
    });
    userIds.push(concurrent.id);
    const existingVerifiedAt = new Date("2026-01-01T00:00:00.000Z");
    const siblingConcurrent = await prisma.user.create({
      data: {
        email: `activation-sibling-${marker}@example.invalid`,
        passwordHash: null,
        status: "PENDING_ACTIVATION",
        emailVerifiedAt: existingVerifiedAt,
      },
    });
    userIds.push(siblingConcurrent.id);
    const rollbackUser = await prisma.user.create({
      data: {
        email: `activation-rollback-${marker}@example.invalid`,
        passwordHash: null,
        status: "PENDING_ACTIVATION",
      },
    });
    userIds.push(rollbackUser.id);
    const ineligibleUsers = await Promise.all([
      prisma.user.create({
        data: {
          email: `activation-active-${marker}@example.invalid`,
          passwordHash: null,
          status: "ACTIVE",
        },
      }),
      prisma.user.create({
        data: {
          email: `activation-limited-${marker}@example.invalid`,
          passwordHash: null,
          status: "LIMITED",
        },
      }),
      prisma.user.create({
        data: {
          email: `activation-suspended-${marker}@example.invalid`,
          passwordHash: null,
          status: "SUSPENDED",
        },
      }),
      prisma.user.create({
        data: {
          email: `activation-deleted-${marker}@example.invalid`,
          passwordHash: null,
          status: "PENDING_ACTIVATION",
          deletedAt: new Date(),
        },
      }),
    ]);
    userIds.push(...ineligibleUsers.map((user) => user.id));

    const requestIp = `198.51.100.${Math.floor(Math.random() * 100) + 1}`;
    const unknownEmail = `activation-unknown-${marker}@example.invalid`;
    rateLimitKeys.push(
      activationRateLimitKey("request-ip", requestIp),
      activationRateLimitKey("request-email", pending.email),
      activationRateLimitKey("request-email", unknownEmail),
      ...ineligibleUsers.map((user) =>
        activationRateLimitKey("request-email", user.email),
      ),
    );
    const pendingStartedAt = performance.now();
    const pendingResponse = await requestActivation(
      request("http://localhost/api/auth/activation/request", { email: pending.email }, requestIp),
    );
    const pendingDuration = performance.now() - pendingStartedAt;
    const unknownStartedAt = performance.now();
    const unknownResponse = await requestActivation(
      request("http://localhost/api/auth/activation/request", { email: unknownEmail }, requestIp),
    );
    const unknownDuration = performance.now() - unknownStartedAt;
    assert.equal(pendingResponse.status, 202);
    assert.equal(unknownResponse.status, 202);
    const genericBody = await pendingResponse.json();
    assert.deepEqual(genericBody, await unknownResponse.json());
    assert.equal("delivery" in genericBody, false);
    assert.ok(pendingDuration >= 180);
    assert.ok(unknownDuration >= 180);
    assert.ok(Math.abs(pendingDuration - unknownDuration) < 150);
    assert.equal(
      await prisma.userActionToken.count({ where: { userId: pending.id } }),
      1,
    );
    for (const user of ineligibleUsers) {
      const response = await requestActivation(
        request(
          "http://localhost/api/auth/activation/request",
          { email: user.email },
          requestIp,
        ),
      );
      assert.equal(response.status, 202);
      assert.deepEqual(await response.json(), genericBody);
      assert.equal(
        await prisma.userActionToken.count({ where: { userId: user.id } }),
        0,
      );
    }

    const normalizedResponse = await requestActivation(
      request(
        "http://localhost/api/auth/activation/request",
        { email: `  ${pending.email.toUpperCase()}  ` },
        requestIp,
      ),
    );
    assert.deepEqual(await normalizedResponse.json(), genericBody);
    assert.equal(
      await prisma.userActionToken.count({ where: { userId: pending.id } }),
      2,
    );

    const beforeUntrustedRequest = await prisma.userActionToken.count({
      where: { userId: pending.id },
    });
    process.env.TRUST_PROXY_HEADERS = "false";
    const untrustedHeaderResponse = await requestActivation(
      request(
        "http://localhost/api/auth/activation/request",
        { email: pending.email },
        "192.0.2.200",
      ),
    );
    process.env.TRUST_PROXY_HEADERS = "true";
    assert.equal(untrustedHeaderResponse.status, 202);
    assert.equal(
      await prisma.userActionToken.count({ where: { userId: pending.id } }),
      beforeUntrustedRequest,
    );

    const malformedResponse = await requestActivation(
      new NextRequest("http://localhost/api/auth/activation/request", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ email: pending.email }),
      }),
    );
    assert.equal(malformedResponse.status, 202);
    assert.deepEqual(await malformedResponse.json(), genericBody);

    const directEmailLimitKey = activationRateLimitKey(
      "request-email",
      `limit-${marker}@example.invalid`,
    );
    rateLimitKeys.push(directEmailLimitKey);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      assert.equal(
        (
          await checkActivationRateLimit({
            key: directEmailLimitKey,
            limit: 3,
            windowMs: 60_000,
          })
        ).allowed,
        true,
      );
    }
    assert.equal(
      (
        await checkActivationRateLimit({
          key: directEmailLimitKey,
          limit: 3,
          windowMs: 60_000,
        })
      ).allowed,
      false,
    );

    const issued = await issueUserActionToken({ userId: pending.id, purpose: PURPOSE });
    const controlSession = await createSession(ineligibleUsers[0].id);
    const issuanceAudit = await prisma.adminAuditLog.findFirstOrThrow({
      where: {
        entityId: pending.id,
        action: "MIGRATED_ACCOUNT_ACTIVATION_TOKEN_ISSUED",
      },
      orderBy: { createdAt: "desc" },
    });
    const issuanceMetadata = JSON.stringify(issuanceAudit.metadata);
    assert.equal(issuanceMetadata.includes(issued.token), false);
    assert.equal(issuanceMetadata.includes(hashToken(issued.token)), false);
    const accountBeforeActivation = await prisma.user.findUniqueOrThrow({
      where: { id: pending.id },
      select: { email: true, role: true, phoneE164: true, deletedAt: true },
    });
    const siblingRaw = randomUUID();
    const sibling = await prisma.userActionToken.create({
      data: {
        userId: pending.id,
        purpose: PURPOSE,
        tokenHash: hashToken(siblingRaw),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.session.create({
      data: {
        userId: pending.id,
        tokenHash: hashToken(randomUUID()),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const completeIp = "203.0.113.10";
    rateLimitKeys.push(
      activationRateLimitKey("complete-ip", completeIp),
      activationRateLimitKey("complete-token", issued.token),
    );
    const wrongTokenIp = "203.0.113.11";
    const wrongToken = randomUUID();
    rateLimitKeys.push(
      activationRateLimitKey("complete-ip", wrongTokenIp),
      activationRateLimitKey("complete-token", wrongToken),
    );
    const wrongTokenResponse = await completeActivation(
      request(
        "http://localhost/api/auth/activation/complete",
        { token: wrongToken, newPassword: "Activation-pass-123" },
        wrongTokenIp,
      ),
    );
    assert.equal(wrongTokenResponse.status, 400);
    const invalidBody = await wrongTokenResponse.json();

    const weakPasswordResponse = await completeActivation(
      request(
        "http://localhost/api/auth/activation/complete",
        { token: issued.token, newPassword: "short" },
        "203.0.113.12",
      ),
    );
    assert.equal(weakPasswordResponse.status, 400);
    assert.deepEqual(await weakPasswordResponse.json(), invalidBody);
    const oversizedTokenResponse = await completeActivation(
      request(
        "http://localhost/api/auth/activation/complete",
        { token: "x".repeat(513), newPassword: "Activation-pass-123" },
        "203.0.113.13",
      ),
    );
    assert.equal(oversizedTokenResponse.status, 400);
    assert.deepEqual(await oversizedTokenResponse.json(), invalidBody);
    const completeResponse = await completeActivation(
      request(
        "http://localhost/api/auth/activation/complete",
        { token: issued.token, newPassword: "Activation-pass-123" },
        completeIp,
      ),
    );
    assert.equal(completeResponse.status, 200);
    assert.deepEqual(await completeResponse.json(), { success: true });
    const activated = await prisma.user.findUniqueOrThrow({ where: { id: pending.id } });
    assert.equal(activated.status, "ACTIVE");
    assert.ok(activated.emailVerifiedAt);
    assert.ok(activated.passwordHash);
    assert.equal(activated.email, accountBeforeActivation.email);
    assert.equal(activated.role, accountBeforeActivation.role);
    assert.equal(activated.phoneE164, accountBeforeActivation.phoneE164);
    assert.equal(activated.deletedAt, accountBeforeActivation.deletedAt);
    assert.equal(await verifyPassword("Activation-pass-123", activated.passwordHash), true);
    assert.equal(await prisma.session.count({ where: { userId: pending.id } }), 0);
    assert.equal(
      (await validateSession(controlSession))?.id,
      ineligibleUsers[0].id,
    );
    assert.ok(
      (
        await prisma.userActionToken.findUniqueOrThrow({
          where: { tokenHash: hashToken(issued.token) },
        })
      ).usedAt,
    );
    assert.ok(
      (await prisma.userActionToken.findUniqueOrThrow({ where: { id: sibling.id } }))
        .invalidatedAt,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: { actorId: pending.id, action: "MIGRATED_ACCOUNT_ACTIVATION_COMPLETED" },
      }),
      1,
    );
    assert.equal(await verifyLoginPassword("Activation-pass-123", activated), true);
    const loginSession = await createSession(pending.id);
    assert.equal((await validateSession(loginSession))?.id, pending.id);

    const replay = await completeMigratedAccountActivation({
      token: issued.token,
      password: "Another-pass-123",
    });
    assert.deepEqual(replay, { completed: false });

    const transitionToken = await issueUserActionToken({
      userId: transition.id,
      purpose: PURPOSE,
    });
    await prisma.user.update({
      where: { id: transition.id },
      data: { status: "SUSPENDED" },
    });
    assert.deepEqual(
      await completeMigratedAccountActivation({
        token: transitionToken.token,
        password: "Suspended-pass-123",
      }),
      { completed: false },
    );
    assert.equal(
      (
        await prisma.userActionToken.findUniqueOrThrow({
          where: { tokenHash: hashToken(transitionToken.token) },
        })
      ).usedAt,
      null,
    );

    await prisma.user.update({
      where: { id: transition.id },
      data: { status: "PENDING_ACTIVATION" },
    });
    const activeTransitionToken = await issueUserActionToken({
      userId: transition.id,
      purpose: PURPOSE,
    });
    await prisma.user.update({
      where: { id: transition.id },
      data: { status: "ACTIVE" },
    });
    assert.deepEqual(
      await completeMigratedAccountActivation({
        token: activeTransitionToken.token,
        password: "Active-transition-123",
      }),
      { completed: false },
    );
    await prisma.user.update({
      where: { id: transition.id },
      data: { status: "PENDING_ACTIVATION" },
    });
    const deletedTransitionToken = await issueUserActionToken({
      userId: transition.id,
      purpose: PURPOSE,
    });
    await prisma.user.update({
      where: { id: transition.id },
      data: { deletedAt: new Date() },
    });
    assert.deepEqual(
      await completeMigratedAccountActivation({
        token: deletedTransitionToken.token,
        password: "Deleted-transition-123",
      }),
      { completed: false },
    );

    const concurrentToken = await issueUserActionToken({
      userId: concurrent.id,
      purpose: PURPOSE,
    });
    const concurrentResults = await Promise.all([
      completeMigratedAccountActivation({
        token: concurrentToken.token,
        password: "Concurrent-pass-123",
      }),
      completeMigratedAccountActivation({
        token: concurrentToken.token,
        password: "Concurrent-pass-123",
      }),
    ]);
    assert.equal(concurrentResults.filter((result) => result.completed).length, 1);
    assert.equal(concurrentResults.filter((result) => !result.completed).length, 1);
    assert.equal(
      await prisma.auditLog.count({
        where: {
          actorId: concurrent.id,
          action: "MIGRATED_ACCOUNT_ACTIVATION_COMPLETED",
        },
      }),
      1,
    );

    const siblingTokenA = await issueUserActionToken({
      userId: siblingConcurrent.id,
      purpose: PURPOSE,
    });
    const siblingTokenBRaw = randomUUID();
    const siblingTokenB = await prisma.userActionToken.create({
      data: {
        userId: siblingConcurrent.id,
        purpose: PURPOSE,
        tokenHash: hashToken(siblingTokenBRaw),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const siblingResults = await Promise.all([
      completeMigratedAccountActivation({
        token: siblingTokenA.token,
        password: "Sibling-pass-123",
      }),
      completeMigratedAccountActivation({
        token: siblingTokenBRaw,
        password: "Sibling-pass-123",
      }),
    ]);
    assert.equal(siblingResults.filter((result) => result.completed).length, 1);
    assert.equal(siblingResults.filter((result) => !result.completed).length, 1);
    const siblingRows = await prisma.userActionToken.findMany({
      where: { userId: siblingConcurrent.id },
    });
    assert.equal(siblingRows.filter((token) => token.usedAt !== null).length, 1);
    assert.equal(
      siblingRows.filter(
        (token) => token.usedAt === null && token.invalidatedAt === null,
      ).length,
      0,
    );
    assert.ok(siblingRows.some((token) => token.id === siblingTokenB.id));
    assert.equal(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: siblingConcurrent.id },
          select: { emailVerifiedAt: true },
        })
      ).emailVerifiedAt?.getTime(),
      existingVerifiedAt.getTime(),
    );

    const rollbackToken = await issueUserActionToken({
      userId: rollbackUser.id,
      purpose: PURPOSE,
    });
    await assert.rejects(
      completeMigratedAccountActivation({
        token: rollbackToken.token,
        password: "Rollback-pass-123",
        ipAddress: 123 as unknown as string,
      }),
      /ACTIVATION_UNAVAILABLE/u,
    );
    const rollbackAccount = await prisma.user.findUniqueOrThrow({
      where: { id: rollbackUser.id },
    });
    assert.equal(rollbackAccount.status, "PENDING_ACTIVATION");
    assert.equal(rollbackAccount.passwordHash, null);
    assert.equal(
      (
        await prisma.userActionToken.findUniqueOrThrow({
          where: { tokenHash: hashToken(rollbackToken.token) },
        })
      ).usedAt,
      null,
    );
    await prisma.userActionToken.update({
      where: { tokenHash: hashToken(rollbackToken.token) },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    assert.deepEqual(
      await completeMigratedAccountActivation({
        token: rollbackToken.token,
        password: "Expired-pass-123",
      }),
      { completed: false },
    );
    const invalidatedToken = await issueUserActionToken({
      userId: rollbackUser.id,
      purpose: PURPOSE,
    });
    assert.equal(
      await invalidateUserActionTokens({
        userId: rollbackUser.id,
        purpose: PURPOSE,
      }),
      1,
    );
    assert.deepEqual(
      await completeMigratedAccountActivation({
        token: invalidatedToken.token,
        password: "Invalidated-pass-123",
      }),
      { completed: false },
    );
  } finally {
    if (previousTrustProxyHeaders === undefined) {
      delete process.env.TRUST_PROXY_HEADERS;
    } else {
      process.env.TRUST_PROXY_HEADERS = previousTrustProxyHeaders;
    }
    if (rateLimitKeys.length > 0) {
      await prisma.rateLimitEntry.deleteMany({ where: { key: { in: rateLimitKeys } } });
    }
    if (userIds.length > 0) {
      await prisma.adminAuditLog.deleteMany({ where: { entityId: { in: userIds } } });
      await prisma.auditLog.deleteMany({
        where: { targetType: "USER", targetId: { in: userIds } },
      });
      for (const userId of userIds) {
        await prisma.user.delete({ where: { id: userId } });
      }
    }
    assert.equal(await prisma.user.count(), initial.users);
    assert.equal(await prisma.session.count(), initial.sessions);
    assert.equal(await prisma.userActionToken.count(), initial.tokens);
    await prisma.$disconnect();
  }

  console.log("activation endpoints integration tests: OK");
}

main().catch((error) => {
  console.error("activation endpoints integration tests: FAILED", error);
  process.exitCode = 1;
});
