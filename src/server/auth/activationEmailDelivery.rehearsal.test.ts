import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  buildMigratedAccountActivationUrl,
  deliverMigratedAccountActivationEmail,
} from "./activationEmailDelivery";
import { resolveActivationEmailDelivery } from "./activationEmailGate";
import {
  consumeUserActionToken,
  issueUserActionToken,
} from "./userActionToken.service";
import { completeMigratedAccountActivation } from "./activationCompletion.service";
import {
  activationRateLimitKey,
  checkActivationRateLimit,
} from "./activationRateLimit";

const PURPOSE = "MIGRATED_ACCOUNT_ACTIVATION" as const;

/** Fake/sandbox transport — captures what WOULD have been sent, never touches Resend or the network. */
function fakeTransport() {
  const calls: Array<{ to: string; subject: string; text: string }> = [];
  const send = async (params: { to: string; subject: string; text: string }) => {
    calls.push(params);
    return { status: "SENT" as const, messageId: `fake-${calls.length}` };
  };
  return { send, calls };
}

const APPROVED_PRODUCTION_ENV = {
  nodeEnv: "production",
  appEnvironment: "production",
  productionEnabled: "true",
  productionApproved: "true",
} as const;

async function main(): Promise<void> {
  const marker = randomUUID();
  const userIds: string[] = [];
  const rateLimitKeys: string[] = [];
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    // --- 1. LOCAL/DEV hard-disable: real process.env, whatever it is in this
    // dev shell, must never allow delivery. This is the single most important
    // property this whole slice exists to guarantee.
    const realEnvGate = resolveActivationEmailDelivery();
    assert.equal(realEnvGate.status, "DELIVERY_DISABLED");
    const { send: neverCalledSend, calls: neverCalledCalls } = fakeTransport();
    const localAttempt = await deliverMigratedAccountActivationEmail(
      { to: `should-not-send-${marker}@example.invalid`, rawToken: "irrelevant" },
      neverCalledSend,
      // no override — uses the real process.env, proving hard-disable holds
      // even when a caller supplies a working transport.
    );
    assert.deepEqual(localAttempt, { status: "SKIPPED", reason: "DELIVERY_DISABLED" });
    assert.equal(neverCalledCalls.length, 0);

    // --- 2. Every individual flag short of full approval must still disable
    // delivery (matches the matrix already proven in activationEmailGate,
    // re-asserted here at the delivery-function boundary).
    const partialMatrices: ActivationGateInput[] = [
      { nodeEnv: "development", appEnvironment: "local", productionEnabled: "false", productionApproved: "false" },
      { nodeEnv: "production", appEnvironment: "production", productionEnabled: "false", productionApproved: "true" },
      { nodeEnv: "production", appEnvironment: "production", productionEnabled: "true", productionApproved: "false" },
      { nodeEnv: "production", appEnvironment: "development", productionEnabled: "true", productionApproved: "true" },
    ];
    for (const env of partialMatrices) {
      const { send, calls } = fakeTransport();
      const result = await deliverMigratedAccountActivationEmail(
        { to: `partial-${marker}@example.invalid`, rawToken: "irrelevant" },
        send,
        env,
      );
      assert.deepEqual(result, { status: "SKIPPED", reason: "DELIVERY_DISABLED" });
      assert.equal(calls.length, 0);
    }

    // --- 3. Production-approved + fake transport: proves the provider
    // adapter itself works — URL built, content built, sender invoked —
    // without ever touching Resend or mutating real process.env.
    process.env.NEXT_PUBLIC_APP_URL = "https://mamago.by";
    const pendingUser = await prisma.user.create({
      data: {
        email: `activation-rehearsal-${marker}@example.invalid`,
        passwordHash: null,
        status: "PENDING_ACTIVATION",
      },
    });
    userIds.push(pendingUser.id);

    const issued = await issueUserActionToken({ userId: pendingUser.id, purpose: PURPOSE });
    const { send: approvedSend, calls: approvedCalls } = fakeTransport();
    const delivered = await deliverMigratedAccountActivationEmail(
      { to: pendingUser.email, rawToken: issued.token },
      approvedSend,
      APPROVED_PRODUCTION_ENV,
    );
    assert.equal(delivered.status, "SENT");
    assert.equal(approvedCalls.length, 1);
    const sentCall = approvedCalls[0];
    assert.equal(sentCall.to, pendingUser.email);

    const expectedUrl = buildMigratedAccountActivationUrl(issued.token);
    assert.ok(expectedUrl);
    assert.ok(sentCall.text.includes(expectedUrl!));
    assert.ok(expectedUrl!.startsWith("https://mamago.by/activate?token="));

    // --- 4. Token secrecy: the raw token must appear ONLY inside the email
    // body handed to the transport — never as a bare, un-urlencoded literal
    // anywhere else reachable from this call (subject, or logged structure).
    assert.equal(sentCall.subject.includes(issued.token), false);
    assert.deepEqual(Object.keys(sentCall).sort(), ["subject", "text", "to"]);

    // --- 5. Missing base URL => SKIPPED, never falls back to a guessed host.
    delete process.env.NEXT_PUBLIC_APP_URL;
    const { send: noUrlSend, calls: noUrlCalls } = fakeTransport();
    const noUrlResult = await deliverMigratedAccountActivationEmail(
      { to: pendingUser.email, rawToken: issued.token },
      noUrlSend,
      APPROVED_PRODUCTION_ENV,
    );
    assert.deepEqual(noUrlResult, { status: "SKIPPED", reason: "ACTIVATION_BASE_URL_NOT_CONFIGURED" });
    assert.equal(noUrlCalls.length, 0);
    process.env.NEXT_PUBLIC_APP_URL = "https://mamago.by";

    // --- 6. One-time-use: the token this rehearsal issued consumes exactly
    // once; a second attempt with the same raw token must fail.
    const firstConsume = await consumeUserActionToken({ token: issued.token, purpose: PURPOSE });
    assert.equal(firstConsume.consumed, true);
    const secondConsume = await consumeUserActionToken({ token: issued.token, purpose: PURPOSE });
    assert.deepEqual(secondConsume, { consumed: false });

    // --- 7. Invalid token: a token that was never issued must fail, not throw.
    const invalidConsume = await consumeUserActionToken({ token: randomUUID(), purpose: PURPOSE });
    assert.deepEqual(invalidConsume, { consumed: false });

    // --- 8. Expiry: an already-expired token must fail to consume even
    // though it was validly issued and never used.
    const expiringUser = await prisma.user.create({
      data: {
        email: `activation-rehearsal-expiry-${marker}@example.invalid`,
        passwordHash: null,
        status: "PENDING_ACTIVATION",
      },
    });
    userIds.push(expiringUser.id);
    const past = new Date(Date.now() - 60_000);
    const expiredIssue = await issueUserActionToken(
      { userId: expiringUser.id, purpose: PURPOSE },
      { clock: { now: () => new Date(past.getTime() - 60 * 60 * 1000) } },
    );
    const expiredConsume = await consumeUserActionToken({ token: expiredIssue.token, purpose: PURPOSE });
    assert.deepEqual(expiredConsume, { consumed: false });

    // --- 9. Already-activated account: complete once, then prove a stray
    // second activation attempt for the same account cannot re-consume or
    // re-activate — and roles are never touched by any of this.
    const completionUser = await prisma.user.create({
      data: {
        email: `activation-rehearsal-complete-${marker}@example.invalid`,
        passwordHash: null,
        status: "PENDING_ACTIVATION",
        role: "USER",
      },
    });
    userIds.push(completionUser.id);
    const completionIssue = await issueUserActionToken({ userId: completionUser.id, purpose: PURPOSE });
    const completion = await completeMigratedAccountActivation({
      token: completionIssue.token,
      password: `Rehearsal-${marker}-Aa1!`,
    });
    assert.deepEqual(completion, { completed: true, userId: completionUser.id });
    const reConsume = await consumeUserActionToken({ token: completionIssue.token, purpose: PURPOSE });
    assert.deepEqual(reConsume, { consumed: false });
    const afterCompletion = await prisma.user.findUniqueOrThrow({
      where: { id: completionUser.id },
      select: { role: true, status: true },
    });
    assert.equal(afterCompletion.role, "USER");
    assert.equal(afterCompletion.status, "ACTIVE");

    // --- 10. Rate limits: the activation request limiter fails closed once
    // the window's limit is exceeded (reusing the real Postgres-backed
    // limiter — no separate fake needed, it's already deterministic via `now`).
    const rateKey = activationRateLimitKey("rehearsal", marker);
    rateLimitKeys.push(rateKey);
    const now = new Date();
    const first = await checkActivationRateLimit({ key: rateKey, limit: 2, windowMs: 60_000, now });
    const second = await checkActivationRateLimit({ key: rateKey, limit: 2, windowMs: 60_000, now });
    const third = await checkActivationRateLimit({ key: rateKey, limit: 2, windowMs: 60_000, now });
    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    assert.equal(third.allowed, false);

    // --- 11. ADMIN/roles untouched: nothing in this rehearsal ever changes
    // ADMIN count or any fixture user's role away from what it was created with.
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    assert.ok(adminCount >= 1);
    const stillUser = await prisma.user.findUniqueOrThrow({ where: { id: pendingUser.id }, select: { role: true } });
    assert.equal(stillUser.role, "USER");

    console.log("activation email delivery rehearsal: OK");
  } finally {
    if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;

    for (const key of rateLimitKeys) {
      await prisma.rateLimitEntry.deleteMany({ where: { key } });
    }
    if (userIds.length > 0) {
      await prisma.adminAuditLog.deleteMany({ where: { entityId: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { targetId: { in: userIds } } });
      await prisma.userActionToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  }
}

type ActivationGateInput = Parameters<typeof resolveActivationEmailDelivery>[0];

main().catch((error) => {
  console.error("activation email delivery rehearsal: FAILED", error);
  process.exitCode = 1;
});
