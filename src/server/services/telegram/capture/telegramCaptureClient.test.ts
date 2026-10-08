import assert from "node:assert/strict";
import test from "node:test";
import { createTelegramCaptureClient } from "./telegramCaptureClient.core";

const TOKEN = "SECRET_BOT_TOKEN_123";

type Call = { url: string; init?: RequestInit };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeClient(handler: (call: Call) => Response | Promise<Response>, extra: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  const client = createTelegramCaptureClient({ getBotToken: () => TOKEN, fetchImpl, ...extra });
  return { client, calls };
}

async function captureLogs<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string }> {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  try {
    return { result: await fn(), logs: lines.join("\n") };
  } finally {
    console.error = original;
  }
}

test("sendChatAction posts typing action", async () => {
  const { client, calls } = makeClient(() => jsonResponse({ ok: true, result: true }));
  const result = await client.sendChatAction(42, "typing");
  assert.deepEqual(result, { ok: true, value: true });
  assert.ok(calls[0]!.url.endsWith("/sendChatAction"));
  assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), { chat_id: 42, action: "typing" });
});

test("editMessageText sends markup and parse mode only when given", async () => {
  const { client, calls } = makeClient(() => jsonResponse({ ok: true, result: {} }));
  await client.editMessageText("7", 9, "hi");
  assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), { chat_id: "7", message_id: 9, text: "hi" });
  await client.editMessageText("7", 9, "hi", {
    parseMode: "HTML",
    replyMarkup: { inline_keyboard: [[{ text: "ok", callback_data: "x" }]] },
  });
  const body = JSON.parse(String(calls[1]!.init?.body));
  assert.equal(body.parse_mode, "HTML");
  assert.equal(body.reply_markup.inline_keyboard[0][0].callback_data, "x");
});

test("answerCallbackQuery defaults show_alert to false", async () => {
  const { client, calls } = makeClient(() => jsonResponse({ ok: true, result: true }));
  await client.answerCallbackQuery("cb1", { text: "done" });
  assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), {
    callback_query_id: "cb1",
    text: "done",
    show_alert: false,
  });
});

test("Telegram API errors are returned as codes and never thrown or logged with details", async () => {
  const { client } = makeClient(() =>
    jsonResponse({ ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" }, 403),
  );
  const { result, logs } = await captureLogs(() => client.sendChatAction(1, "typing"));
  assert.deepEqual(result, { ok: false, code: "TG_403" });
  assert.match(logs, /code=TG_403/);
  assert.doesNotMatch(logs, /blocked|Forbidden|SECRET_BOT_TOKEN/);
});

test("network failure and timeout map to codes", async () => {
  const failing = makeClient(() => {
    throw new TypeError(`fetch failed https://api.telegram.org/bot${TOKEN}/x`);
  });
  const net = await captureLogs(() => failing.client.sendChatAction(1, "typing"));
  assert.deepEqual(net.result, { ok: false, code: "NETWORK" });
  assert.doesNotMatch(net.logs, /SECRET_BOT_TOKEN|api\.telegram\.org/);

  const slow = makeClient(
    (call) =>
      new Promise<Response>((_, reject) => {
        call.init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    { apiTimeoutMs: 20 },
  );
  const timed = await captureLogs(() => slow.client.sendChatAction(1, "typing"));
  assert.deepEqual(timed.result, { ok: false, code: "TIMEOUT" });
});

test("missing token yields NO_TOKEN without calling fetch", async () => {
  let called = false;
  const client = createTelegramCaptureClient({
    getBotToken: () => {
      throw new Error("TELEGRAM_BOT_TOKEN_DEV is not configured");
    },
    fetchImpl: (async () => {
      called = true;
      return jsonResponse({});
    }) as typeof fetch,
  });
  const { result, logs } = await captureLogs(() => client.sendChatAction(1, "typing"));
  assert.deepEqual(result, { ok: false, code: "NO_TOKEN" });
  assert.equal(called, false);
  assert.doesNotMatch(logs, /TELEGRAM_BOT_TOKEN/);
});

test("getFile returns path and size, and flags a missing path", async () => {
  const ok = makeClient(() => jsonResponse({ ok: true, result: { file_path: "photos/a.jpg", file_size: 123 } }));
  assert.deepEqual(await ok.client.getFile("fid"), { ok: true, value: { filePath: "photos/a.jpg", fileSize: 123 } });
  const missing = makeClient(() => jsonResponse({ ok: true, result: {} }));
  const { result } = await captureLogs(() => missing.client.getFile("fid"));
  assert.deepEqual(result, { ok: false, code: "NO_FILE_PATH" });
});

test("downloadFile reads the body into memory within the limit", async () => {
  const { client, calls } = makeClient(() => new Response(new Uint8Array([1, 2, 3, 4])));
  const result = await client.downloadFile("photos/a.jpg", { maxBytes: 10 });
  assert.ok(result.ok);
  assert.deepEqual([...(result.ok ? result.value : [])], [1, 2, 3, 4]);
  assert.ok(calls[0]!.url.includes("/file/bot"));
});

test("downloadFile enforces maxBytes by header and by streamed size", async () => {
  const byHeader = makeClient(
    () => new Response(new Uint8Array(4), { headers: { "content-length": "999999" } }),
  );
  const a = await captureLogs(() => byHeader.client.downloadFile("p", { maxBytes: 10 }));
  assert.deepEqual(a.result, { ok: false, code: "TOO_LARGE" });
  assert.doesNotMatch(a.logs, /SECRET_BOT_TOKEN|file\/bot/);

  const byStream = makeClient(() => new Response(new Uint8Array(50)));
  const b = await captureLogs(() => byStream.client.downloadFile("p", { maxBytes: 10 }));
  assert.deepEqual(b.result, { ok: false, code: "TOO_LARGE" });
});

test("downloadFile maps HTTP errors and timeouts to codes", async () => {
  const notFound = makeClient(() => new Response("nope", { status: 404 }));
  const a = await captureLogs(() => notFound.client.downloadFile("p", { maxBytes: 10 }));
  assert.deepEqual(a.result, { ok: false, code: "HTTP_404" });

  const slow = makeClient(
    (call) =>
      new Promise<Response>((_, reject) => {
        call.init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    { downloadTimeoutMs: 20 },
  );
  const b = await captureLogs(() => slow.client.downloadFile("p", { maxBytes: 10 }));
  assert.deepEqual(b.result, { ok: false, code: "TIMEOUT" });
});
