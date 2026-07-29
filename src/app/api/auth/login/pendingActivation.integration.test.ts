import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import NodeModule from "node:module";
import { NextRequest } from "next/server";

// login/route.ts transitively imports email-service.tsx (via
// acceptBusinessInvite -> ... -> emailService.sendBusinessInvite), which
// has a top-level `import "server-only"` — real under Next's bundler
// (react-server condition), but this file runs under plain tsx/Node for
// this integration test. Same fix as migration-commit-wordpress-db.ts's
// installServerOnlyStub(): resolve the exact bare specifier to a no-op
// before the route module (and therefore email-service.tsx) ever loads.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const patchableModule = NodeModule as any;
const originalLoad = patchableModule._load;
patchableModule._load = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.apply(this, [request, ...rest]);
};

function loginRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function main(): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const { POST: loginRoute } = await import("./route");
  const { resolveActivationEmailDelivery } = await import("@/server/auth/activationEmailGate");
  const { activationRateLimitKey } = await import("@/server/auth/activationRateLimit");

  const marker = randomUUID();
  const userIds: string[] = [];

  try {
    // --- PENDING_ACTIVATION: no legacy-password check performed (any
    // password value reaches the same branch), triggers activation
    // delivery, response is a distinct-but-neutral 200 — never a 401, never
    // "Invalid email or password".
    const pending = await prisma.user.create({
      data: {
        email: `login-pending-${marker}@example.invalid`,
        passwordHash: null,
        status: "PENDING_ACTIVATION",
        role: "USER",
      },
    });
    userIds.push(pending.id);

    const res = await loginRoute(
      loginRequest({ email: pending.email, password: "whatever-was-typed" }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.pendingActivation, true);
    assert.equal(typeof body.maskedEmail, "string");
    assert.equal(typeof body.delivered, "boolean");
    assert.equal("error" in body, false);

    // Real proof this is the request-flow, not a no-op: exactly one token
    // now exists, and it went through the standard LOCAL-hard-disabled gate
    // (an audit row was written, delivery itself was never attempted).
    const tokenCount = await prisma.userActionToken.count({ where: { userId: pending.id } });
    assert.equal(tokenCount, 1);
    const audits = await prisma.activationDeliveryAudit.findMany({ where: { userId: pending.id } });
    assert.equal(audits.length, 1);
    assert.equal(audits[0].source, "LOGIN_FLOW");
    const gate = resolveActivationEmailDelivery();
    assert.equal(gate.status, "DELIVERY_DISABLED");
    assert.equal(audits[0].status, "BLOCKED_ENVIRONMENT");
    assert.equal(audits[0].sentAt, null);

    // Role/status untouched by merely attempting this login.
    const stillPending = await prisma.user.findUniqueOrThrow({
      where: { id: pending.id },
      select: { status: true, role: true },
    });
    assert.equal(stillPending.status, "PENDING_ACTIVATION");
    assert.equal(stillPending.role, "USER");

    // --- ACTIVE user: completely unaffected by the new branch, identical
    // to pre-existing behavior (correct password logs in).
    const bcrypt = await import("bcryptjs");
    const activePasswordHash = await bcrypt.hash("Correct-Horse-1!", 10);
    const active = await prisma.user.create({
      data: {
        email: `login-active-${marker}@example.invalid`,
        passwordHash: activePasswordHash,
        status: "ACTIVE",
        role: "USER",
      },
    });
    userIds.push(active.id);
    const activeRes = await loginRoute(
      loginRequest({ email: active.email, password: "Correct-Horse-1!" }),
    );
    assert.equal(activeRes.status, 200);
    const activeBody = await activeRes.json();
    assert.equal(activeBody.success, true);
    assert.equal(activeBody.pendingActivation, undefined);

    // --- ACTIVE user, wrong password: unchanged generic 401.
    const wrongRes = await loginRoute(
      loginRequest({ email: active.email, password: "not-the-password" }),
    );
    assert.equal(wrongRes.status, 401);
    const wrongBody = await wrongRes.json();
    assert.equal(wrongBody.error, "Invalid email or password");

    // --- Unknown email: identical generic 401, no account existence signal.
    const unknownRes = await loginRoute(
      loginRequest({ email: `login-unknown-${marker}@example.invalid`, password: "anything" }),
    );
    assert.equal(unknownRes.status, 401);
    const unknownBody = await unknownRes.json();
    assert.deepEqual(unknownBody, wrongBody);

    console.log("login pendingActivation integration tests: OK");
  } finally {
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.activationDeliveryAudit.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userActionToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.rateLimitEntry.deleteMany({
      where: {
        key: {
          in: [
            activationRateLimitKey("request-email", `login-pending-${marker}@example.invalid`),
            `login:unknown:login-pending-${marker}@example.invalid`,
            `login:unknown:login-active-${marker}@example.invalid`,
            `login:unknown:login-unknown-${marker}@example.invalid`,
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
  console.error("login pendingActivation integration tests: FAILED", error);
  process.exitCode = 1;
});
