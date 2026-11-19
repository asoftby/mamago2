/**
 * Cross-endpoint paid-SMS budget regression against disposable PostgreSQL.
 * Both real authenticated API handlers must consume one user-scoped quota.
 * Never send real SMS: provider fetch is intercepted and synthetic.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import NodeModule from "node:module";
import { NextRequest } from "next/server";

const dbUrl = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
  ["localhost", "127.0.0.1"].includes(dbUrl.hostname) &&
  dbUrl.pathname === "/seo_redirect_test",
  "Requires disposable local seo_redirect_test PostgreSQL",
);

let sessionToken: string | null = null;
const loader = NodeModule as unknown as { _load: (request: string, ...args: unknown[]) => unknown };
const originalLoad = loader._load;
loader._load = function (request, ...args) {
  if (request === "server-only") return {};
  if (request === "next/navigation") {
    return { redirect: (url: string): never => { throw new Error("Unexpected redirect: " + url); } };
  }
  if (request === "next/headers") {
    return { cookies: async () => ({ get: () => sessionToken ? { value: sessionToken } : undefined }) };
  }
  return originalLoad.apply(this, [request, ...args]);
};

const oldFetch = globalThis.fetch;
const oldSmsToken = process.env.SMS_BY_TOKEN;
const oldSmsUrl = process.env.SMS_BY_BASE_URL;
const oldForceSms = process.env.FORCE_SMS;
const marker = randomUUID().slice(0, 12);
const smsHost = "https://sms-budget.invalid";
let smsCalls = 0;

process.env.SMS_BY_TOKEN = "synthetic_ci_sms_token";
process.env.SMS_BY_BASE_URL = smsHost;
process.env.FORCE_SMS = "true";

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (href.startsWith(smsHost + "/api/v1/sendQuickSms")) {
    smsCalls++;
    // A definite provider rejection must still consume one shared attempt.
    if (smsCalls === 4) return new Response(JSON.stringify({ status: "FAILED", error: "synthetic" }), { status: 200 });
    return new Response(JSON.stringify({ status: "NEW", sms_id: "synthetic-" + smsCalls }), { status: 200 });
  }
  return oldFetch(input, init);
}) as typeof fetch;

async function main() {
  const prisma = (await import("@/lib/prisma")).default;
  const { createSession } = await import("@/lib/auth/session");
  const { POST: start } = await import("./start/route");
  const { POST: settings } = await import("../settings/phone/send-otp/route");
  let userId: string | null = null;

  const phoneAt = (index: number) => "+3752912345" + String(index).padStart(2, "0");
  const fromStart = (index: number) => start(new NextRequest("http://localhost/api/phone/start", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: phoneAt(index), purpose: "BUSINESS_CONTACT_VERIFICATION" }),
  }));
  const fromSettings = (index: number) => settings(new NextRequest("http://localhost/api/settings/phone/send-otp", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: phoneAt(index) }),
  }));

  try {
    const user = await prisma.user.create({ data: { email: "sms-budget-" + marker + "@example.test" } });
    userId = user.id;
    sessionToken = await createSession(user.id);

    // Twelve attempts spread between distinct destinations and both routes.
    for (let i = 0; i < 12; i++) {
      const res = i % 2 === 0 ? await fromStart(i) : await fromSettings(i);
      assert.equal(res.status, i === 3 ? 503 : 200, "attempt " + (i + 1) + " consumed quota");
      if (i === 3) {
        const body = await res.json() as { code: string };
        assert.equal(body.code, "SMS_DELIVERY_FAILED", "definite provider failure is not dispatched");
      }
    }

    assert.equal(smsCalls, 12, "twelve provider attempts from both routes");
    const quotaKey = "business-contact-sms:user:" + user.id;
    const before = await prisma.rateLimitEntry.findUnique({ where: { key: quotaKey } });
    assert.equal(before?.count, 12, "both endpoints used the same PostgreSQL counter");

    // The 13th and subsequent attempt must never create OTP or invoke provider.
    const thirteenth = await fromSettings(12);
    assert.equal(thirteenth.status, 429);
    assert.equal((await thirteenth.json() as { code: string }).code, "SMS_RATE_LIMITED");
    const fourteenth = await fromStart(13);
    assert.equal(fourteenth.status, 429);
    assert.equal((await fourteenth.json() as { code: string }).code, "SMS_RATE_LIMITED");
    assert.equal(smsCalls, 12, "no provider calls after quota exhaustion");
    assert.equal(await prisma.phoneOtp.count({ where: {
      userId: user.id, phoneE164: { in: [phoneAt(12), phoneAt(13)] },
    } }), 0, "denied requests do not create or replace OTPs");
  } finally {
    if (userId) {
      await prisma.phoneOtp.deleteMany({ where: { userId } });
      await prisma.rateLimitEntry.deleteMany({ where: { key: "business-contact-sms:user:" + userId } });
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  globalThis.fetch = oldFetch;
  loader._load = originalLoad;
  if (oldSmsToken === undefined) delete process.env.SMS_BY_TOKEN; else process.env.SMS_BY_TOKEN = oldSmsToken;
  if (oldSmsUrl === undefined) delete process.env.SMS_BY_BASE_URL; else process.env.SMS_BY_BASE_URL = oldSmsUrl;
  if (oldForceSms === undefined) delete process.env.FORCE_SMS; else process.env.FORCE_SMS = oldForceSms;
});
