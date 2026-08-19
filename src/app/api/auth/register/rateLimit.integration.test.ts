import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import NodeModule from "node:module";
import { NextRequest } from "next/server";

// register/route.ts transitively imports email-service.tsx (via
// sendRegistrationVerificationEmail), which has a top-level
// `import "server-only"` — real under Next's bundler (react-server
// condition), but this file runs under plain tsx/Node for this integration
// test. Same fix as login/pendingActivation.integration.test.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const patchableModule = NodeModule as any;
const originalLoad = patchableModule._load;
patchableModule._load = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.apply(this, [request, ...rest]);
};

function registerRequest(body: unknown, ip: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify(body),
  });
}

async function main(): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const { POST: registerRoute } = await import("./route");

  const marker = randomUUID();
  const ip = `203.0.113.${(Date.now() % 200) + 1}`;
  const email = `register-ratelimit-${marker}@example.invalid`;
  const otherEmail = `register-ratelimit-other-${marker}@example.invalid`;
  const otherIp = `198.51.100.${(Date.now() % 200) + 1}`;
  const userIds: string[] = [];
  const previousTrustProxyHeaders = process.env.TRUST_PROXY_HEADERS;
  process.env.TRUST_PROXY_HEADERS = "true";

  try {
    // First attempt for a brand-new email: not rate-limited, real account
    // created (proves the rate-limit check doesn't break the happy path).
    const first = await registerRoute(
      registerRequest({ email, password: "Correct-Horse-1!" }, ip),
    );
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.equal(firstBody.success, true);
    userIds.push(firstBody.user.id);

    // Next 5 attempts against the SAME ip+email key (now an existing-user
    // 400 each time) exhaust the 5-per-15min window; the 6th must be
    // rejected with 429 before ever touching the DB existence check.
    let sawRateLimited = false;
    for (let i = 0; i < 6; i += 1) {
      const res = await registerRoute(
        registerRequest({ email, password: "Correct-Horse-1!" }, ip),
      );
      if (res.status === 429) {
        sawRateLimited = true;
        const body = await res.json();
        assert.equal(typeof body.error, "string");
        break;
      }
      assert.equal(res.status, 400);
    }
    assert.equal(sawRateLimited, true, "register endpoint must rate-limit repeated attempts");

    // A different IP for a different email is unaffected — the limiter key
    // is scoped per ip+email, not global.
    const otherRes = await registerRoute(
      registerRequest({ email: otherEmail, password: "Correct-Horse-1!" }, otherIp),
    );
    assert.equal(otherRes.status, 200);
    const otherBody = await otherRes.json();
    userIds.push(otherBody.user.id);

    console.log("register rate-limit integration tests: OK");
  } finally {
    if (previousTrustProxyHeaders === undefined) delete process.env.TRUST_PROXY_HEADERS;
    else process.env.TRUST_PROXY_HEADERS = previousTrustProxyHeaders;

    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.rateLimitEntry.deleteMany({
      where: {
        key: {
          in: [`register:${ip}:${email}`, `register:${otherIp}:${otherEmail}`],
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
  console.error("register rate-limit integration tests: FAILED", error);
  process.exitCode = 1;
});
