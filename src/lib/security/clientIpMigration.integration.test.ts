/**
 * Caller-level regression proof for the getTrustedClientIp() migration
 * (security prerequisite, commit on top of 710a7665).
 *
 * For each security-sensitive route migrated off the old spoofable
 * CF-Connecting-IP/X-Forwarded-For readers, proves directly against the
 * RateLimitEntry table that:
 *   (a) forging CF-Connecting-IP (or X-Forwarded-For) alone — with no
 *       trusted X-Real-IP — never creates a distinct rate-limit identity;
 *       every such request collapses onto the SAME "unknown"/null-derived
 *       bucket, regardless of how many different spoofed values are sent.
 *   (b) once TRUST_PROXY_HEADERS=true, two distinct real X-Real-IP values
 *       DO create two distinct rate-limit buckets.
 *
 * `direct/route.ts` is intentionally excluded: it calls getCurrentUser()
 * (-> next/headers cookies()) before the IP-extraction code runs, and that
 * throws "outside a request scope" when a route is invoked directly via
 * tsx rather than through a real Next.js request — the same pre-existing
 * harness limitation already documented in
 * src/app/api/analytics/events/route.test.ts. Its migration is proven by
 * code inspection (identical `getTrustedClientIp(request) ?? "unknown"`
 * pattern as bookings) plus the exhaustive getTrustedClientIp() unit tests
 * in clientIp.test.ts.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/lib/security/clientIpMigration.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import NodeModule from "node:module";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

// register/route.ts transitively imports a "server-only" module (via
// sendRegistrationVerificationEmail) — same tsx/Node shim as the existing
// register/rateLimit.integration.test.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const patchableModule = NodeModule as any;
const originalLoad = patchableModule._load;
patchableModule._load = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.apply(this, [request, ...rest]);
};

function jsonRequest(url: string, body: unknown, headers: Record<string, string>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function getEntry(key: string) {
  return prisma.rateLimitEntry.findUnique({ where: { key } });
}

async function testLogin(): Promise<void> {
  const { POST: loginRoute } = await import("@/app/api/auth/login/route");
  const marker = randomUUID();
  const email = `trustedip-login-${marker}@example.invalid`;
  const previous = process.env.TRUST_PROXY_HEADERS;
  const keysToClean: string[] = [];
  try {
    // (a) CF spoofing alone must never create a distinct identity.
    process.env.TRUST_PROXY_HEADERS = "false";
    await loginRoute(
      jsonRequest("http://localhost/api/auth/login", { email, password: "whatever" }, { "cf-connecting-ip": "1.1.1.1" }),
    );
    await loginRoute(
      jsonRequest("http://localhost/api/auth/login", { email, password: "whatever" }, { "cf-connecting-ip": "2.2.2.2" }),
    );
    const unknownKey = `login:unknown:${email}`;
    keysToClean.push(unknownKey, `login:1.1.1.1:${email}`, `login:2.2.2.2:${email}`);
    const unknownEntry = await getEntry(unknownKey);
    assert.equal(unknownEntry?.count, 2, "both CF-spoofed requests must land in the SAME unknown-ip bucket");
    assert.equal(await getEntry(`login:1.1.1.1:${email}`), null, "the spoofed CF value must never appear in the rate-limit key");
    assert.equal(await getEntry(`login:2.2.2.2:${email}`), null);

    // (b) trusted X-Real-IP must separate identities.
    process.env.TRUST_PROXY_HEADERS = "true";
    const ipA = "203.0.113.21";
    const ipB = "203.0.113.22";
    await loginRoute(
      jsonRequest("http://localhost/api/auth/login", { email, password: "whatever" }, { "x-real-ip": ipA }),
    );
    await loginRoute(
      jsonRequest("http://localhost/api/auth/login", { email, password: "whatever" }, { "x-real-ip": ipB }),
    );
    keysToClean.push(`login:${ipA}:${email}`, `login:${ipB}:${email}`);
    assert.equal((await getEntry(`login:${ipA}:${email}`))?.count, 1, "distinct trusted X-Real-IP must get its own bucket");
    assert.equal((await getEntry(`login:${ipB}:${email}`))?.count, 1);

    console.log("  login: OK");
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY_HEADERS;
    else process.env.TRUST_PROXY_HEADERS = previous;
    await prisma.rateLimitEntry.deleteMany({ where: { key: { in: keysToClean } } });
  }
}

async function testRegister(): Promise<void> {
  const { POST: registerRoute } = await import("@/app/api/auth/register/route");
  const marker = randomUUID();
  const email = `trustedip-register-${marker}@example.invalid`;
  const previous = process.env.TRUST_PROXY_HEADERS;
  const keysToClean: string[] = [];
  const userIds: string[] = [];
  try {
    process.env.TRUST_PROXY_HEADERS = "false";
    const r1 = await registerRoute(
      jsonRequest("http://localhost/api/auth/register", { email, password: "Correct-Horse-1!" }, { "x-forwarded-for": "1.1.1.1" }),
    );
    if (r1.status === 200) userIds.push((await r1.json()).user.id);
    await registerRoute(
      jsonRequest("http://localhost/api/auth/register", { email, password: "Correct-Horse-1!" }, { "x-forwarded-for": "2.2.2.2" }),
    );
    const unknownKey = `register:unknown:${email}`;
    keysToClean.push(unknownKey, `register:1.1.1.1:${email}`, `register:2.2.2.2:${email}`);
    assert.equal((await getEntry(unknownKey))?.count, 2, "both XFF-spoofed requests must land in the SAME unknown-ip bucket");
    assert.equal(await getEntry(`register:1.1.1.1:${email}`), null, "the spoofed XFF value must never appear in the rate-limit key");
    assert.equal(await getEntry(`register:2.2.2.2:${email}`), null);

    process.env.TRUST_PROXY_HEADERS = "true";
    const email2 = `trustedip-register-b-${marker}@example.invalid`;
    const ipA = "203.0.113.31";
    const ipB = "203.0.113.32";
    const r2 = await registerRoute(
      jsonRequest("http://localhost/api/auth/register", { email: email2, password: "Correct-Horse-1!" }, { "x-real-ip": ipA }),
    );
    if (r2.status === 200) userIds.push((await r2.json()).user.id);
    await registerRoute(
      jsonRequest("http://localhost/api/auth/register", { email: email2, password: "Correct-Horse-1!" }, { "x-real-ip": ipB }),
    );
    keysToClean.push(`register:${ipA}:${email2}`, `register:${ipB}:${email2}`);
    assert.equal((await getEntry(`register:${ipA}:${email2}`))?.count, 1, "distinct trusted X-Real-IP must get its own bucket");
    assert.equal((await getEntry(`register:${ipB}:${email2}`))?.count, 1);

    console.log("  register: OK");
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY_HEADERS;
    else process.env.TRUST_PROXY_HEADERS = previous;
    await prisma.rateLimitEntry.deleteMany({ where: { key: { in: keysToClean } } });
    if (userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

async function testVerifyOtp(): Promise<void> {
  const { POST: verifyOtpRoute } = await import("@/app/api/auth/phone/verify-otp/route");
  // A syntactically valid Belarus mobile number (libphonenumber must accept
  // it, or normalizePhoneToE164 returns "" and the route 400s before ever
  // reaching the rate limiter) — last 6 digits randomized per run.
  const suffix = String(Math.floor(1000000 + Math.random() * 9000000));
  const phone = `+37529${suffix}`;
  const previous = process.env.TRUST_PROXY_HEADERS;
  const keysToClean: string[] = [];
  try {
    process.env.TRUST_PROXY_HEADERS = "false";
    await verifyOtpRoute(
      jsonRequest("http://localhost/api/auth/phone/verify-otp", { phone, code: "1234", purpose: "LOGIN" }, { "cf-connecting-ip": "1.1.1.1" }),
    );
    await verifyOtpRoute(
      jsonRequest("http://localhost/api/auth/phone/verify-otp", { phone, code: "1234", purpose: "LOGIN" }, { "cf-connecting-ip": "2.2.2.2" }),
    );
    const phoneE164 = phone; // normalizePhoneToE164 is a no-op for an already-E164-shaped input
    const unknownKey = `otp_verify:unknown:${phoneE164}`;
    keysToClean.push(unknownKey, `otp_verify:1.1.1.1:${phoneE164}`, `otp_verify:2.2.2.2:${phoneE164}`);
    assert.equal((await getEntry(unknownKey))?.count, 2, "both CF-spoofed requests must land in the SAME unknown-ip bucket");
    assert.equal(await getEntry(`otp_verify:1.1.1.1:${phoneE164}`), null);
    assert.equal(await getEntry(`otp_verify:2.2.2.2:${phoneE164}`), null);

    process.env.TRUST_PROXY_HEADERS = "true";
    const ipA = "203.0.113.41";
    const ipB = "203.0.113.42";
    await verifyOtpRoute(
      jsonRequest("http://localhost/api/auth/phone/verify-otp", { phone, code: "1234", purpose: "LOGIN" }, { "x-real-ip": ipA }),
    );
    await verifyOtpRoute(
      jsonRequest("http://localhost/api/auth/phone/verify-otp", { phone, code: "1234", purpose: "LOGIN" }, { "x-real-ip": ipB }),
    );
    keysToClean.push(`otp_verify:${ipA}:${phoneE164}`, `otp_verify:${ipB}:${phoneE164}`);
    assert.equal((await getEntry(`otp_verify:${ipA}:${phoneE164}`))?.count, 1, "distinct trusted X-Real-IP must get its own bucket");
    assert.equal((await getEntry(`otp_verify:${ipB}:${phoneE164}`))?.count, 1);

    console.log("  verify-otp: OK");
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY_HEADERS;
    else process.env.TRUST_PROXY_HEADERS = previous;
    await prisma.rateLimitEntry.deleteMany({ where: { key: { in: keysToClean } } });
  }
}

async function testBookings(): Promise<void> {
  const { POST: bookingsRoute } = await import("@/app/api/public/bookings/route");
  const previous = process.env.TRUST_PROXY_HEADERS;
  const keysToClean: string[] = [];
  try {
    process.env.TRUST_PROXY_HEADERS = "false";
    // bookings/route.ts checks the rate limit BEFORE calling getCurrentUser(),
    // so the RateLimitEntry side effect happens even though the handler goes
    // on to fail (invalid body / auth-context limitation) afterward — that
    // failure is expected and irrelevant to what this test verifies.
    await bookingsRoute(
      jsonRequest("http://localhost/api/public/bookings", {}, { "cf-connecting-ip": "1.1.1.1" }),
    ).catch(() => undefined);
    await bookingsRoute(
      jsonRequest("http://localhost/api/public/bookings", {}, { "cf-connecting-ip": "2.2.2.2" }),
    ).catch(() => undefined);
    const unknownKey = "booking_create:unknown";
    keysToClean.push(unknownKey, "booking_create:1.1.1.1", "booking_create:2.2.2.2");
    assert.equal((await getEntry(unknownKey))?.count, 2, "both CF-spoofed requests must land in the SAME unknown-ip bucket");
    assert.equal(await getEntry("booking_create:1.1.1.1"), null);
    assert.equal(await getEntry("booking_create:2.2.2.2"), null);

    process.env.TRUST_PROXY_HEADERS = "true";
    const ipA = "203.0.113.51";
    const ipB = "203.0.113.52";
    await bookingsRoute(
      jsonRequest("http://localhost/api/public/bookings", {}, { "x-real-ip": ipA }),
    ).catch(() => undefined);
    await bookingsRoute(
      jsonRequest("http://localhost/api/public/bookings", {}, { "x-real-ip": ipB }),
    ).catch(() => undefined);
    keysToClean.push(`booking_create:${ipA}`, `booking_create:${ipB}`);
    assert.equal((await getEntry(`booking_create:${ipA}`))?.count, 1, "distinct trusted X-Real-IP must get its own bucket");
    assert.equal((await getEntry(`booking_create:${ipB}`))?.count, 1);

    console.log("  bookings: OK");
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY_HEADERS;
    else process.env.TRUST_PROXY_HEADERS = previous;
    await prisma.rateLimitEntry.deleteMany({ where: { key: { in: keysToClean } } });
  }
}

async function main(): Promise<void> {
  console.log("Caller-level trusted-IP migration regression proof:");
  await testLogin();
  await testRegister();
  await testVerifyOtp();
  await testBookings();
  console.log("clientIpMigration.integration.test.ts: OK");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("clientIpMigration.integration.test.ts: FAILED", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
