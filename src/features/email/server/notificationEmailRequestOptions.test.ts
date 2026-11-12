import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Resend } from "resend";
import { notificationEmailRequestOptions, NOTIFICATION_EMAIL_TIMEOUT_MS } from "./notificationEmailRequestOptions";

async function main() {
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  const keepAlive = setInterval(() => {}, 1000);
  const resend = new Resend("synthetic");
  const payload = { from: "sender@example.test", to: "receiver@example.test", subject: "Synthetic", text: "test" };
  try {
    AbortSignal.timeout = ms => {
      assert.equal(ms, NOTIFICATION_EMAIL_TIMEOUT_MS);
      return originalTimeout(10);
    };
    for (const stage of ["headers", "body"] as const) {
      let signal: AbortSignal | null = null;
      globalThis.fetch = async (_url, options) => {
        signal = options?.signal ?? null;
        assert.ok(signal, "real Resend transport must forward the abort signal");
        const stalled = () => new Promise<never>((_resolve, reject) => {
          options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason), { once: true });
        });
        if (stage === "headers") return stalled();
        return { ok: true, headers: new Headers(), json: stalled } as unknown as Response;
      };
      const result = await resend.emails.send(payload, notificationEmailRequestOptions());
      assert.ok(result.error, stage + " timeout must surface as a failed delivery");
      assert.equal((signal as AbortSignal | null)?.aborted, true);
    }
    globalThis.fetch = async () => new Response(JSON.stringify({ id: "synthetic-id" }), { status: 200 });
    const result = await resend.emails.send(payload, notificationEmailRequestOptions());
    assert.equal(result.data?.id, "synthetic-id");
    const source = readFileSync("src/features/email/server/email-service.tsx", "utf8");
    assert.ok(source.includes('input.kind === "notification" ? notificationEmailRequestOptions() : undefined'));
  } finally {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
    clearInterval(keepAlive);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
