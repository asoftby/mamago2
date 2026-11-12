import assert from "node:assert/strict";
import test from "node:test";
import { postFamilyPicks } from "./familyPicksRequest";

test("cleanup before fetch starts is a successful no-op, not an exception", async () => {
  const previousFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => { called++; throw new Error("fetch must not start"); }) as typeof fetch;
  try {
    const controller = new AbortController();
    const result = postFamilyPicks({ action: "context", city: "minsk" }, controller.signal);
    controller.abort();
    assert.equal(await result, null);
    assert.equal(called, 0);
  } finally { globalThis.fetch = previousFetch; }
});

test("cleanup of a running request resolves quietly and ignores a late response", async () => {
  const previousFetch = globalThis.fetch;
  let resolveFetch!: (response: Response) => void;
  let fetchSignal: AbortSignal | undefined;
  globalThis.fetch = (async (_input, init) => {
    fetchSignal = init?.signal ?? undefined;
    return new Promise<Response>(resolve => { resolveFetch = resolve; });
  }) as typeof fetch;
  try {
    const controller = new AbortController();
    const work = postFamilyPicks({ action: "recommend", city: "minsk" }, controller.signal);
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    assert.equal(await work, null);
    assert.equal(fetchSignal, undefined, "lifecycle signal must not be passed to fetch");
    resolveFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await Promise.resolve();
  } finally { globalThis.fetch = previousFetch; }
});

test("HTTP failures are still failures", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch;
  try { await assert.rejects(postFamilyPicks({ action: "context" }), /home_503/); }
  finally { globalThis.fetch = previousFetch; }
});

test("genuinely hung requests report timeout, not cancellation", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Promise<Response>(() => {})) as typeof fetch;
  try { await assert.rejects(postFamilyPicks({ action: "context" }, undefined, 5), /home_request_timeout/); }
  finally { globalThis.fetch = previousFetch; }
});
