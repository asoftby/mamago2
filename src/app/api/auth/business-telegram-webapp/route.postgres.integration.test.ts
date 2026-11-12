import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import NodeModule from "node:module";
import { NextRequest } from "next/server";

// Only disposable CI data; never invoke Telegram or a production database.
const database = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/seo_redirect_test", "Requires the disposable CI PostgreSQL database");
const loader = NodeModule as unknown as { _load: (request: string, ...args: unknown[]) => unknown };
const originalLoad = loader._load;
loader._load = function (request, ...args) {
  if (request === "server-only") return {};
  if (request === "next/headers") return { cookies: async () => ({ get: () => undefined }) };
  return originalLoad.apply(this, [request, ...args]);
};

async function main() {
  const keys = ["APP_ENV", "NEXTAUTH_URL", "AUTH_COOKIE_SECURE", "TELEGRAM_BUSINESS_BOT_TOKEN_DEV",
    "TELEGRAM_BUSINESS_BOT_USERNAME_DEV", "TELEGRAM_BUSINESS_WEBHOOK_SECRET_DEV",
    "TELEGRAM_BUSINESS_DELIVERY_ENABLED"] as const;
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const { prismaBase: db } = await import("@/lib/prisma");
  const marker = randomUUID();
  const token = "123456:synthetic-business-bot-token";
  const telegramId = String(1_000_000_000 + Math.floor(Math.random() * 1_000_000_000));
  let userId: string | undefined;
  let businessId: string | undefined;
  let outsiderId: string | undefined;
  try {
    process.env.APP_ENV = "dev";
    process.env.NEXTAUTH_URL = "https://dev.mamago.by";
    process.env.AUTH_COOKIE_SECURE = "true"; // Explicit HTTPS DEV deployment policy.
    process.env.TELEGRAM_BUSINESS_BOT_TOKEN_DEV = token;
    process.env.TELEGRAM_BUSINESS_BOT_USERNAME_DEV = "synthetic_business_bot";
    process.env.TELEGRAM_BUSINESS_WEBHOOK_SECRET_DEV = "synthetic-webhook-secret";
    process.env.TELEGRAM_BUSINESS_DELIVERY_ENABLED = "true";
    const { POST } = await import("./route");
    const user = await db.user.create({ data: { email: marker + "@example.test", status: "ACTIVE" } });
    userId = user.id;
    const business = await db.business.create({ data: { ownerUserId: user.id, name: marker, operationalStatus: "ACTIVE" } });
    businessId = business.id;
    const outsider = await db.business.create({ data: { ownerUserId: user.id, name: marker + "-other", operationalStatus: "ACTIVE" } });
    outsiderId = outsider.id;
    const member = await db.businessMember.create({ data: { userId: user.id, businessId: business.id, role: "OWNER", isActive: true } });
    const connection = await db.businessTelegramConnection.create({ data: {
      userId: user.id, businessId: business.id, environment: "DEV",
      botUsername: "synthetic_business_bot", telegramUserId: telegramId, telegramChatId: telegramId,
    } });
    const sign = (botToken = token, age = 0) => {
      const params = new URLSearchParams({
        auth_date: String(Math.floor(Date.now() / 1000) - age),
        user: JSON.stringify({ id: Number(telegramId) }),
      });
      const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b, "en"))
        .map(([key, value]) => key + "=" + value).join("\n");
      const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
      params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
      return params.toString();
    };
    const request = (initData = sign()) => new NextRequest("https://dev.mamago.by/api/auth/business-telegram-webapp", {
      method: "POST", headers: { origin: "https://dev.mamago.by", "content-type": "application/json", host: "dev.mamago.by" },
      body: JSON.stringify({ initData }),
    });
    async function rejected(initData = sign(), status = 403) {
      const count = await db.session.count({ where: { userId: user.id } });
      const response = await POST(request(initData));
      assert.equal(response.status, status);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.has("set-cookie"), false);
      assert.equal(await db.session.count({ where: { userId: user.id } }), count);
    }
    for (const role of ["OWNER", "MANAGER"] as const) {
      await db.businessMember.update({ where: { id: member.id }, data: { role } });
      const response = await POST(request());
      assert.equal(response.status, 200, role);
      assert.deepEqual(await response.json(), { ok: true });
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/i);
      assert.match(response.headers.get("set-cookie") ?? "", /Secure/i);
    }
    assert.equal(await db.session.count({ where: { userId: user.id } }), 2);
    await rejected(sign("123456:family-bot-token"), 401);
    await rejected(sign(token, 601), 401);
    await db.businessMember.update({ where: { id: member.id }, data: { isActive: false } });
    await rejected();
    await db.businessMember.update({ where: { id: member.id }, data: { isActive: true } });
    await db.businessTelegramConnection.update({ where: { id: connection.id }, data: { businessId: outsider.id } });
    await rejected(); // Owning another business is not a substitute for the linked membership.
    await db.businessTelegramConnection.update({ where: { id: connection.id }, data: { businessId: business.id, isActive: false } });
    await rejected();
    await db.businessTelegramConnection.update({ where: { id: connection.id }, data: { isActive: true } });
    await db.user.update({ where: { id: user.id }, data: { status: "BANNED" } });
    await rejected();
    console.log("Business Mini App signed auth, session and revoked/cross-business PostgreSQL: PASS");
  } finally {
    if (userId) {
      await db.businessTelegramConnection.deleteMany({ where: { userId } });
      await db.session.deleteMany({ where: { userId } });
      await db.businessMember.deleteMany({ where: { userId } });
    }
    if (businessId) await db.business.deleteMany({ where: { id: businessId } });
    if (outsiderId) await db.business.deleteMany({ where: { id: outsiderId } });
    if (userId) await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
    for (const key of keys) {
      const value = before[key];
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    loader._load = originalLoad;
  }
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
