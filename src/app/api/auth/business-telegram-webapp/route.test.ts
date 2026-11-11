import assert from "node:assert/strict";
import NodeModule from "node:module";
import { NextRequest } from "next/server";

// Match the existing Telegram launcher route-test convention.
const loader = NodeModule as unknown as {
  _load: (request: string, ...args: unknown[]) => unknown;
};
const originalLoad = loader._load;
loader._load = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.apply(this, [request, ...args]);
};

function createRequest(origin?: string, contentType = "application/json"): NextRequest {
  const headers = new Headers({ "content-type": contentType });
  if (origin !== undefined) headers.set("origin", origin);
  return new NextRequest("http://app-internal:3000/api/auth/business-telegram-webapp", {
    method: "POST",
    headers,
    body: JSON.stringify({ initData: "invalid-business-bot-init-data" }),
  });
}

async function main(): Promise<void> {
  const envNames = [
    "APP_ENV", "NEXTAUTH_URL",
    "TELEGRAM_BUSINESS_BOT_TOKEN_PROD",
    "TELEGRAM_BUSINESS_BOT_USERNAME_PROD",
    "TELEGRAM_BUSINESS_WEBHOOK_SECRET_PROD",
    "TELEGRAM_BUSINESS_DELIVERY_ENABLED",
  ] as const;
  const before = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
  try {
    process.env.APP_ENV = "production";
    process.env.NEXTAUTH_URL = "https://mamago.by";
    process.env.TELEGRAM_BUSINESS_BOT_TOKEN_PROD = "123456:business-bot-token";
    process.env.TELEGRAM_BUSINESS_BOT_USERNAME_PROD = "mamago_business_bot";
    process.env.TELEGRAM_BUSINESS_WEBHOOK_SECRET_PROD = "test-only-business-webhook";
    process.env.TELEGRAM_BUSINESS_DELIVERY_ENABLED = "true";

    const { POST } = await import("./route");
    async function expectStatus(label: string, request: NextRequest, status: number, code: string) {
      const result = await POST(request);
      assert.equal(result.status, status, label);
      assert.deepEqual(await result.json(), { error: code }, label);
      assert.equal(result.headers.get("cache-control"), "no-store");
    }

    // A correct browser Origin never bypasses Business Bot HMAC verification.
    await expectStatus("unsigned initData", createRequest("https://mamago.by"), 401, "INVALID_INIT_DATA");
    await expectStatus("foreign Origin", createRequest("https://other.example"), 403, "INVALID_ORIGIN");
    await expectStatus("no Origin", createRequest(), 403, "INVALID_ORIGIN");
    await expectStatus("plain text", createRequest("https://mamago.by", "text/plain"), 415, "INVALID_CONTENT_TYPE");

    process.env.NEXTAUTH_URL = "http://mamago.by";
    await expectStatus("non-HTTPS origin", createRequest("https://mamago.by"), 503, "AUTH_UNAVAILABLE");
    process.env.NEXTAUTH_URL = "https://mamago.by";

    process.env.TELEGRAM_BUSINESS_DELIVERY_ENABLED = "false";
    await expectStatus("business bot disabled", createRequest("https://mamago.by"), 503, "AUTH_UNAVAILABLE");
    process.env.TELEGRAM_BUSINESS_DELIVERY_ENABLED = "true";

    delete process.env.TELEGRAM_BUSINESS_BOT_TOKEN_PROD;
    await expectStatus("business bot unconfigured", createRequest("https://mamago.by"), 503, "AUTH_UNAVAILABLE");
    console.log("Business Telegram Mini App auth negative checks: OK");
  } finally {
    for (const name of envNames) {
      const value = before[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    loader._load = originalLoad;
  }
}

void main().catch((error: unknown) => {
  console.error("Business Telegram Mini App auth checks failed", error);
  process.exitCode = 1;
});
