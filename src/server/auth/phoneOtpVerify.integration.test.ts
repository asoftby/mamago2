import assert from "node:assert/strict";
import { randomUUID, randomInt, createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/otp/otp";
import { POST } from "@/app/api/auth/phone/verify-otp/route";

async function main() {
  assert.equal(process.env.APP_ENV, "test");
  assert.ok(process.env.DATABASE_URL?.includes("/seo_redirect_test"));
  const secret = process.env.OTP_SECRET;
  assert.ok(secret);
  const phoneE164 = "+1202555" + randomInt(1000, 10000);
  const user = await prisma.user.create({ data: {
    email: `otp-${randomUUID()}@example.invalid`, phoneE164, status: "ACTIVE",
  } });
  process.env.TRUST_PROXY_HEADERS = "false";
  const key = "otp_verify:v2:" + createHmac("sha256", secret).update(JSON.stringify(["unknown", phoneE164])).digest("hex");
  const where = { userId: user.id, phoneE164, purpose: "LOGIN" as const };
  const request = (code: string) => POST(new NextRequest("http://localhost/api/auth/phone/verify-otp", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: phoneE164, code, purpose: "LOGIN" }),
  }));
  const seed = async () => {
    await prisma.phoneOtp.deleteMany({ where });
    await prisma.rateLimitEntry.deleteMany({ where: { key } });
    await prisma.phoneOtp.create({ data: { ...where, codeHash: hashCode("0123"),
      expiresAt: new Date(Date.now() + 60000), lastSentAt: new Date(), attempts: 0 } });
  };
  try {
    await seed();
    const wrong = await Promise.all(Array.from({ length: 3 }, () => request("9999")));
    assert.ok(wrong.every(r => r.status === 400));
    assert.equal((await prisma.phoneOtp.findFirstOrThrow({ where })).attempts, 3);
    assert.equal((await request("0123")).status, 400);
    await seed();
    const correct = await Promise.all([request("0123"), request("0123")]);
    assert.deepEqual(correct.map(r => r.status).sort(), [200, 400]);
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 1);
    assert.equal(await prisma.phoneOtp.count({ where }), 0);

    // A replacement code must survive an attempt using the previous code.
    await seed();
    await prisma.phoneOtp.updateMany({ where, data: {
      codeHash: hashCode("4567"), lastSentAt: new Date(Date.now() + 1000),
      expiresAt: new Date(Date.now() + 61000), attempts: 0,
    } });
    assert.equal((await request("0123")).status, 400);
    assert.equal((await prisma.phoneOtp.findFirstOrThrow({ where })).codeHash, hashCode("4567"));
    assert.equal((await request("4567")).status, 200);

    // Pause verification immediately after its real database read.
    // The replacement commits before the stale verifier can mutate the row.
    await seed();
    const delegate = prisma.phoneOtp;
    const originalFind = delegate.findUnique;
    let replaced = false;
    delegate.findUnique = (async (...args: Parameters<typeof originalFind>) => {
      const record = await originalFind.apply(delegate, args);
      if (record && !replaced) {
        replaced = true;
        await delegate.updateMany({ where, data: {
          codeHash: hashCode("4567"), lastSentAt: new Date(Date.now() + 1000),
          expiresAt: new Date(Date.now() + 61000), attempts: 0,
        } });
      }
      return record;
    }) as unknown as typeof originalFind;
    try {
      assert.equal((await request("0123")).status, 400);
      assert.equal(replaced, true);
      const replacement = await delegate.findFirstOrThrow({ where });
      assert.equal(replacement.codeHash, hashCode("4567"));
      assert.equal(replacement.attempts, 0);
      assert.equal(await prisma.session.count({ where: { userId: user.id } }), 2);
    } finally {
      delegate.findUnique = originalFind;
    }

    await seed();
    await prisma.user.update({ where: { id: user.id }, data: { status: "BANNED", phoneVerifiedAt: null } });
    assert.equal((await request("0123")).status, 400);
    const banned = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(banned.status, "BANNED");
    assert.equal(banned.phoneVerifiedAt, null);
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 2);

    await seed();
    for (const code of ["12-34", "123", "12345", "abcd"]) {
      assert.equal((await request(code)).status, 400);
    }
    const malformed = await POST(new NextRequest("http://localhost/api/auth/phone/verify-otp", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{",
    }));
    assert.equal(malformed.status, 400);
    assert.equal((await prisma.phoneOtp.findFirstOrThrow({ where })).attempts, 0);
  } finally {
    await prisma.rateLimitEntry.deleteMany({ where: { key } });
    await prisma.phoneOtp.deleteMany({ where });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
