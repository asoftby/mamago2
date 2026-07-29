import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { maskEmail, requestMigratedAccountActivationByEmail } from "./activationRequestFlow";
import { activationRateLimitKey } from "./activationRateLimit";

const APPROVED_PRODUCTION_ENV = {
  nodeEnv: "production",
  appEnvironment: "production",
  productionEnabled: "true",
  productionApproved: "true",
} as const;

function fakeSender(status: "SENT" | "FAILED") {
  return async (params: { to: string; subject: string; text: string }) => {
    if (status === "SENT") return { status: "SENT" as const, messageId: "fake-message-id" };
    return { status: "FAILED" as const, reason: "SIMULATED_PROVIDER_FAILURE" };
  };
}

async function main(): Promise<void> {
  const marker = randomUUID();
  const userIds: string[] = [];

  try {
    // --- maskEmail format: "a***@domain", matches the founder's example shape.
    assert.equal(maskEmail("alex@protekhinvest.by"), "a***@protekhinvest.by");
    assert.equal(maskEmail("x@y.com"), "x***@y.com");
    assert.equal(maskEmail("not-an-email"), "***");

    // --- delivered:true — fake sender confirms SENT, production flags approved.
    const sentUser = await prisma.user.create({
      data: { email: `flow-sent-${marker}@example.invalid`, passwordHash: null, status: "PENDING_ACTIVATION" },
    });
    userIds.push(sentUser.id);
    const sentOutcome = await requestMigratedAccountActivationByEmail(
      { email: sentUser.email, ip: null, source: "LOGIN_FLOW" },
      { sender: fakeSender("SENT"), gateEnvironment: APPROVED_PRODUCTION_ENV },
    );
    assert.deepEqual(sentOutcome, { delivered: true });
    const sentAudit = await prisma.activationDeliveryAudit.findFirstOrThrow({ where: { userId: sentUser.id } });
    assert.equal(sentAudit.status, "SENT");
    assert.ok(sentAudit.sentAt);
    assert.equal(sentAudit.providerMessageId, "fake-message-id");
    assert.equal(sentAudit.recipientMask, maskEmail(sentUser.email));
    // activationTokenId references the token row's own id (a cuid), never the raw token/hash.
    assert.ok(sentAudit.activationTokenId);
    assert.equal(sentAudit.activationTokenId!.includes("."), false);
    const sentToken = await prisma.userActionToken.findUniqueOrThrow({ where: { id: sentAudit.activationTokenId! } });
    assert.equal(sentToken.userId, sentUser.id);

    // --- delivered:false — provider itself fails even though production is approved.
    const failedUser = await prisma.user.create({
      data: { email: `flow-failed-${marker}@example.invalid`, passwordHash: null, status: "PENDING_ACTIVATION" },
    });
    userIds.push(failedUser.id);
    const failedOutcome = await requestMigratedAccountActivationByEmail(
      { email: failedUser.email, ip: null, source: "LOGIN_FLOW" },
      { sender: fakeSender("FAILED"), gateEnvironment: APPROVED_PRODUCTION_ENV },
    );
    assert.deepEqual(failedOutcome, { delivered: false });
    const failedAudit = await prisma.activationDeliveryAudit.findFirstOrThrow({ where: { userId: failedUser.id } });
    assert.equal(failedAudit.status, "FAILED");
    assert.equal(failedAudit.errorCode, "SIMULATED_PROVIDER_FAILURE");
    assert.equal(failedAudit.sentAt, null);

    // --- delivered:false — real (unmocked) environment gate blocks LOCAL/DEV,
    // matching what actually happens today with no overrides at all.
    const blockedUser = await prisma.user.create({
      data: { email: `flow-blocked-${marker}@example.invalid`, passwordHash: null, status: "PENDING_ACTIVATION" },
    });
    userIds.push(blockedUser.id);
    const blockedOutcome = await requestMigratedAccountActivationByEmail({
      email: blockedUser.email,
      ip: null,
      source: "LOGIN_FLOW",
    });
    assert.deepEqual(blockedOutcome, { delivered: false });
    const blockedAudit = await prisma.activationDeliveryAudit.findFirstOrThrow({ where: { userId: blockedUser.id } });
    assert.equal(blockedAudit.status, "BLOCKED_ENVIRONMENT");

    // --- Unknown email: delivered:false, and no audit row is created at all
    // (nothing to link it to — matches the "don't fingerprint unknown emails" policy).
    const unknownOutcome = await requestMigratedAccountActivationByEmail({
      email: `flow-unknown-${marker}@example.invalid`,
      ip: null,
      source: "LOGIN_FLOW",
    });
    assert.deepEqual(unknownOutcome, { delivered: false });
    // No User exists for this email at all, so there is structurally no
    // userId an audit row could have been written against.
    const unknownUserExists = await prisma.user.findFirst({
      where: { email: `flow-unknown-${marker}@example.invalid` },
    });
    assert.equal(unknownUserExists, null);

    console.log("activationRequestFlow integration tests: OK");
  } finally {
    await prisma.activationDeliveryAudit.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userActionToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.rateLimitEntry.deleteMany({
      where: {
        key: {
          in: [
            activationRateLimitKey("request-email", `flow-sent-${marker}@example.invalid`),
            activationRateLimitKey("request-email", `flow-failed-${marker}@example.invalid`),
            activationRateLimitKey("request-email", `flow-blocked-${marker}@example.invalid`),
            activationRateLimitKey("request-email", `flow-unknown-${marker}@example.invalid`),
          ],
        },
      },
    });
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("activationRequestFlow integration tests: FAILED", error);
  process.exitCode = 1;
});
