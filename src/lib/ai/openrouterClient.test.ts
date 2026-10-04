import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpenRouterClient,
  readCaptureModelConfig,
  readOpenRouterConfig,
  type OpenRouterCallInput,
} from "./openrouterClient";

const KEY = "sk-or-test-SECRET";
const config = { apiKey: KEY, siteUrl: "http://x.test", appName: "t" };

const input: OpenRouterCallInput = {
  model: "vendor/fast",
  systemPrompt: "SYSTEM_PROMPT_TEXT",
  userParts: [
    { type: "text", text: "USER_MESSAGE_TEXT" },
    { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
  ],
  responseFormat: { type: "json_object" },
};

function ok(content: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ model: "vendor/fast-2026", choices: [{ message: { content } }], usage: { prompt_tokens: 11, completion_tokens: 7 }, ...extra }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function client(handler: (init: RequestInit, n: number) => Response | Promise<Response>) {
  type SentBody = {
    model: string;
    temperature: number;
    response_format: { type: string; json_schema?: { name: string } };
    messages: Array<{ content: Array<{ type: string }> }>;
  };
  const bodies: SentBody[] = [];
  let n = 0;
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as SentBody);
    n += 1;
    return handler(init ?? {}, n);
  }) as typeof fetch;
  return { api: createOpenRouterClient({ getConfig: () => config, fetchImpl }), bodies };
}

async function withLogs<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string }> {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  try {
    return { result: await fn(), logs: lines.join("\n") };
  } finally {
    console.error = original;
  }
}

test("returns content, model and token usage; sends JSON mode, temperature 0 and image parts", async () => {
  const { api, bodies } = client(() => ok('{"intent":"NONE"}'));
  const result = await api.chat(input);
  assert.deepEqual(result, {
    ok: true,
    content: '{"intent":"NONE"}',
    model: "vendor/fast-2026",
    tokensIn: 11,
    tokensOut: 7,
  });
  assert.equal(bodies[0]!.model, "vendor/fast");
  assert.equal(bodies[0]!.temperature, 0);
  assert.deepEqual(bodies[0]!.response_format, { type: "json_object" });
  assert.equal(bodies[0]!.messages[1].content[1].type, "image_url");
});

test("missing usage becomes null tokens", async () => {
  const { api } = client(() => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] })));
  const result = await api.chat(input);
  assert.ok(result.ok);
  assert.equal(result.ok && result.tokensIn, null);
  assert.equal(result.ok && result.model, "vendor/fast");
});

test("json_schema is sent when requested and falls back to JSON mode on 400", async () => {
  const schema = { type: "object" };
  const { api, bodies } = client((_init, n) => (n === 1 ? new Response("nope", { status: 400 }) : ok("{}")));
  const result = await api.chat({ ...input, responseFormat: { type: "json_schema", name: "capture_draft", schema } });
  assert.ok(result.ok);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0]!.response_format.type, "json_schema");
  assert.equal(bodies[0]!.response_format.json_schema?.name, "capture_draft");
  assert.deepEqual(bodies[1]!.response_format, { type: "json_object" });
});

test("HTTP errors: 5xx/429 retryable, other 4xx not", async () => {
  for (const [status, code, retryable] of [
    [500, "OPENROUTER_HTTP_5XX", true],
    [429, "OPENROUTER_HTTP_5XX", true],
    [401, "OPENROUTER_HTTP_4XX", false],
  ] as const) {
    const { api } = client(() => new Response("provider says SENSITIVE", { status }));
    const { result, logs } = await withLogs(() => api.chat(input));
    assert.deepEqual(result, { ok: false, code, retryable });
    assert.doesNotMatch(logs, /SENSITIVE|SECRET|USER_MESSAGE_TEXT|SYSTEM_PROMPT/);
    assert.match(logs, new RegExp(`code=${code}`));
  }
});

test("empty or malformed responses are OPENROUTER_BAD_RESPONSE", async () => {
  for (const response of [
    () => new Response("not json", { status: 200 }),
    () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    () => ok("   "),
  ]) {
    const { api } = client(response);
    const { result } = await withLogs(() => api.chat(input));
    assert.deepEqual(result, { ok: false, code: "OPENROUTER_BAD_RESPONSE", retryable: true });
  }
});

test("network failure and timeout map to safe codes without leaking details", async () => {
  const failing = createOpenRouterClient({
    getConfig: () => config,
    fetchImpl: (async () => {
      throw new TypeError(`fetch failed for key ${KEY}`);
    }) as typeof fetch,
  });
  const net = await withLogs(() => failing.chat(input));
  assert.deepEqual(net.result, { ok: false, code: "OPENROUTER_NETWORK", retryable: true });
  assert.doesNotMatch(net.logs, /SECRET|fetch failed/);

  const slow = createOpenRouterClient({
    getConfig: () => config,
    fetchImpl: ((_url: string, init?: RequestInit) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })) as typeof fetch,
  });
  const timed = await withLogs(() => slow.chat({ ...input, timeoutMs: 20 }));
  assert.deepEqual(timed.result, { ok: false, code: "OPENROUTER_TIMEOUT", retryable: true });
});

test("missing configuration is a controlled, non-retryable failure", async () => {
  let called = false;
  const api = createOpenRouterClient({
    getConfig: () => null,
    fetchImpl: (async () => {
      called = true;
      return ok("{}");
    }) as typeof fetch,
  });
  assert.deepEqual(await api.chat(input), { ok: false, code: "OPENROUTER_NOT_CONFIGURED", retryable: false });
  assert.equal(called, false);
});

test("env readers: trimmed values, defaults, and opt-in json_schema", () => {
  assert.equal(readOpenRouterConfig({}), null);
  assert.deepEqual(readOpenRouterConfig({ OPENROUTER_API_KEY: " k " }), {
    apiKey: "k",
    siteUrl: "http://mamago.local:3000",
    appName: "mamaGo 2.0",
  });
  assert.deepEqual(readCaptureModelConfig({}), { fast: null, strong: null, responseFormat: "json_object" });
  assert.deepEqual(
    readCaptureModelConfig({
      OPENROUTER_CAPTURE_MODEL: " a/b ",
      OPENROUTER_CAPTURE_MODEL_STRONG: "c/d",
      OPENROUTER_CAPTURE_RESPONSE_FORMAT: "json_schema",
    }),
    { fast: "a/b", strong: "c/d", responseFormat: "json_schema" },
  );
});
