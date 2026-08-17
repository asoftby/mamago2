import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { POST as statusRoute } from "@/app/api/auth/activation/status/route";
import { POST as completeRoute } from "@/app/api/auth/activation/complete/route";
import { issueUserActionToken } from "./userActionToken.service";
import { activationRateLimitKey } from "./activationRateLimit";

const PURPOSE = "MIGRATED_ACCOUNT_ACTIVATION" as const;

function statusRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/activation/status", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": "203.0.113.50",
      "user-agent": "activate-page-integration-test",
    },
    body: JSON.stringify(body),
  });
}

function completeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/activation/complete", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": "203.0.113.50",
      "user-agent": "activate-page-integration-test",
    },
    body: JSON.stringify(body),
  });
}

async function main(): Promise<void> {
  const marker = randomUUID();
  const userIds: string[] = [];
  const previousTrustProxyHeaders = process.env.TRUST_PROXY_HEADERS;
  process.env.TRUST_PROXY_HEADERS = "true";

  try {
    // --- Invalid: never-issued token.
    const invalidStatus = await statusRoute(statusRequest({ token: randomUUID() }));
    assert.deepEqual(await invalidStatus.json(), { status: "INVALID" });

    // --- Valid link -> full happy path -> complete -> re-check now USED.
    const pending = await prisma.user.create({
      data: {
        email: `activate-page-valid-${marker}@example.invalid`,
        passwordHash: null,
        status: "PENDING_ACTIVATION",
        role: "USER",
      },
    });
    userIds.push(pending.id);
    const issued = await issueUserActionToken({ userId: pending.id, purpose: PURPOSE });

    const validStatus = await statusRoute(statusRequest({ token: issued.token }));
    assert.deepEqual(await validStatus.json(), { status: "VALID" });

    const completeRes = await completeRoute(
      completeRequest({ token: issued.token, newPassword: `Activate-${marker}-Aa1!` }),
    );
    assert.equal(completeRes.status, 200);
    assert.deepEqual(await completeRes.json(), { success: true });

    const afterUser = await prisma.user.findUniqueOrThrow({
      where: { id: pending.id },
      select: { status: true, role: true },
    });
    assert.equal(afterUser.status, "ACTIVE");
    assert.equal(afterUser.role, "USER");

    const usedStatus = await statusRoute(statusRequest({ token: issued.token }));
    assert.deepEqual(await usedStatus.json(), { status: "USED" });

    // A second complete attempt with the same (now-used) token must fail generically.
    const secondComplete = await completeRoute(
      completeRequest({ token: issued.token, newPassword: `Activate-${marker}-Bb2!` }),
    );
    assert.equal(secondComplete.status, 400);

    // --- Already-active: a fresh token for an account that is already ACTIVE.
    const alreadyActiveUser = await prisma.user.create({
      data: {
        email: `activate-page-active-${marker}@example.invalid`,
        passwordHash: "irrelevant-hash-not-used-by-status-check",
        status: "ACTIVE",
      },
    });
    userIds.push(alreadyActiveUser.id);
    // issueUserActionToken refuses non-PENDING_ACTIVATION users, so insert the
    // token row directly to simulate "link was valid, account got activated
    // through another path before this link was clicked".
    const { hashToken } = await import("@/lib/auth/tokenHash");
    const staleToken = "f".repeat(64);
    await prisma.userActionToken.create({
      data: {
        userId: alreadyActiveUser.id,
        purpose: PURPOSE,
        tokenHash: hashToken(staleToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const alreadyActiveStatus = await statusRoute(statusRequest({ token: staleToken }));
    assert.deepEqual(await alreadyActiveStatus.json(), { status: "ALREADY_ACTIVE" });

    // --- Expired: issue with a backdated clock so expiresAt is already past.
    const expiringUser = await prisma.user.create({
      data: {
        email: `activate-page-expired-${marker}@example.invalid`,
        passwordHash: null,
        status: "PENDING_ACTIVATION",
      },
    });
    userIds.push(expiringUser.id);
    const expiredIssue = await issueUserActionToken(
      { userId: expiringUser.id, purpose: PURPOSE },
      { clock: { now: () => new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    );
    const expiredStatus = await statusRoute(statusRequest({ token: expiredIssue.token }));
    assert.deepEqual(await expiredStatus.json(), { status: "EXPIRED" });
    const expiredComplete = await completeRoute(
      completeRequest({ token: expiredIssue.token, newPassword: `Activate-${marker}-Cc3!` }),
    );
    assert.equal(expiredComplete.status, 400);

    console.log("activate page (status + complete) integration tests: OK");
  } finally {
    if (previousTrustProxyHeaders === undefined) delete process.env.TRUST_PROXY_HEADERS;
    else process.env.TRUST_PROXY_HEADERS = previousTrustProxyHeaders;

    await prisma.rateLimitEntry.deleteMany({
      where: {
        key: {
          in: [
            activationRateLimitKey("status-ip", "203.0.113.50"),
            activationRateLimitKey("complete-ip", "203.0.113.50"),
          ],
        },
      },
    });
    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { targetId: { in: userIds } } });
      await prisma.activationDeliveryAudit.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.userActionToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("activate page integration tests: FAILED", error);
  process.exitCode = 1;
});
