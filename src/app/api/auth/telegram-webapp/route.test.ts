import assert from "node:assert/strict";
import NodeModule from "node:module";
import { NextRequest } from "next/server";

// Match the repository's route-test convention for transitive server-only imports.
const patchableModule = NodeModule as unknown as {
  _load: (request: string, ...rest: unknown[]) => unknown;
};
const originalLoad = patchableModule._load;
patchableModule._load = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.apply(this, [request, ...rest]);
};

type ProxyHeaders = Record<string, string>;

function request(origin?: string, extraHeaders: ProxyHeaders = {}): NextRequest {
  const headers = new Headers({ "content-type": "application/json", ...extraHeaders });
  if (origin !== undefined) headers.set("origin", origin);
  // The internal HTTP hop must not affect a browser's public HTTPS Origin.
  return new NextRequest("http://app-internal:3000/api/auth/telegram-webapp", {
    method: "POST",
    headers,
    body: JSON.stringify({ initData: "unsigned-webapp-data" }),
  });
}

async function main(): Promise<void> {
  const savedEnv = {
    APP_ENV: process.env.APP_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    TELEGRAM_BOT_TOKEN_PROD: process.env.TELEGRAM_BOT_TOKEN_PROD,
    TELEGRAM_BOT_USERNAME_PROD: process.env.TELEGRAM_BOT_USERNAME_PROD,
  };
  try {
    process.env.APP_ENV = "production";
    process.env.NEXTAUTH_URL = "https://mamago.by";
    process.env.TELEGRAM_BOT_TOKEN_PROD = "123456:test-token";
    process.env.TELEGRAM_BOT_USERNAME_PROD = "mamago_bot";

    const { POST } = await import("./route");

    async function expectResponse(
      label: string,
      req: NextRequest,
      status: number,
      error: string,
    ): Promise<void> {
      const result = await POST(req);
      assert.equal(result.status, status, label);
      assert.deepEqual(await result.json(), { error }, label);
      assert.equal(result.headers.get("cache-control"), "no-store", label);
    }

    // Correct public origin proceeds past CSRF, reaching mandatory initData verification.
    await expectResponse("public HTTPS origin", request("https://mamago.by"), 401, "INVALID_INIT_DATA");

    await expectResponse("foreign origin", request("https://other.example"), 403, "INVALID_ORIGIN");
    await expectResponse("missing origin", request(), 403, "INVALID_ORIGIN");
    await expectResponse("null origin", request("null"), 403, "INVALID_ORIGIN");
    await expectResponse("HTTP origin", request("http://mamago.by"), 403, "INVALID_ORIGIN");
    await expectResponse("origin with path", request("https://mamago.by/path"), 403, "INVALID_ORIGIN");

    process.env.NEXTAUTH_URL = "invalid URL";
    await expectResponse("malformed NEXTAUTH_URL", request("https://mamago.by"), 503, "AUTH_UNAVAILABLE");
    for (const invalid of ["http://mamago.by", "https://mamago.by/path", "https://name:secret@mamago.by", "https://mamago.by/?x=1"]) {
      process.env.NEXTAUTH_URL = invalid;
      await expectResponse(`unsafe NEXTAUTH_URL: ${invalid.split("@").at(-1)}`, request("https://mamago.by"), 503, "AUTH_UNAVAILABLE");
    }
    delete process.env.NEXTAUTH_URL;
    await expectResponse("missing NEXTAUTH_URL", request("https://mamago.by"), 503, "AUTH_UNAVAILABLE");

    process.env.NEXTAUTH_URL = "https://mamago.by";
    await expectResponse(
      "spoofed X-Forwarded-Host cannot authorize foreign origin",
      request("https://other.example", { "x-forwarded-host": "mamago.by" }),
      403,
      "INVALID_ORIGIN",
    );
    await expectResponse(
      "spoofed X-Forwarded-Proto cannot authorize foreign origin",
      request("https://other.example", { "x-forwarded-proto": "https" }),
      403,
      "INVALID_ORIGIN",
    );
    await expectResponse(
      "valid origin independent of spoofed proxy headers",
      request("https://mamago.by", {
        "x-forwarded-host": "other.example",
        "x-forwarded-proto": "http",
      }),
      401,
      "INVALID_INIT_DATA",
    );
    // A matching Origin is necessary but insufficient to authenticate.
    await expectResponse("initData is still mandatory", request("https://mamago.by"), 401, "INVALID_INIT_DATA");
    console.log("Telegram Mini App Origin regression tests: OK");
  } finally {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    patchableModule._load = originalLoad;
  }
}

void main().catch((error: unknown) => {
  console.error("Telegram Mini App Origin regression tests: FAILED", error);
  process.exitCode = 1;
});
