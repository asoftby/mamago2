import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TELEGRAM_REQUEST_TIMEOUT_MS } from "./telegramRequestTimeout";
import { TelegramChannel } from "./TelegramChannel";

async function main() {
  process.env.APP_ENV = "test";
  process.env.TELEGRAM_BOT_TOKEN_DEV = "synthetic";
  process.env.TELEGRAM_BOT_USERNAME_DEV = "synthetic_bot";
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  const keepAlive = setInterval(() => {}, 1000);
  try {
    AbortSignal.timeout = (ms) => {
      assert.equal(ms, TELEGRAM_REQUEST_TIMEOUT_MS);
      return originalTimeout(10);
    };
    globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      const signal = options?.signal;
      assert.ok(signal);
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    await assert.rejects(new TelegramChannel().sendMessage({ chatId: "synthetic", text: "test" }), { name: "TimeoutError" });
    globalThis.fetch = async (_url, options) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        const signal = options?.signal;
        assert.ok(signal);
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    } as Response);
    await assert.rejects(new TelegramChannel().sendMessage({ chatId: "synthetic", text: "test" }), { name: "TimeoutError" });
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, result: { message_id: 7 } }) } as Response);
    assert.deepEqual(await new TelegramChannel().sendMessage({ chatId: "synthetic", text: "test" }), { message_id: 7 });
    const business = readFileSync("src/server/services/telegram/businessTelegramDelivery.service.ts", "utf8");
    assert.ok(business.includes("signal: AbortSignal.timeout(TELEGRAM_REQUEST_TIMEOUT_MS)"));
  } finally {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
    clearInterval(keepAlive);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
