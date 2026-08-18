import assert from "node:assert/strict";

import { describeFetchError, fetchHtml } from "./fetchHtml";

function createUndiciStyleFetchError() {
  const cause = Object.assign(
    new Error("connect ETIMEDOUT 178.159.46.48:443"),
    {
      code: "ETIMEDOUT",
      errno: -110,
      syscall: "connect",
      address: "178.159.46.48",
      port: 443,
    },
  );
  const error = new TypeError("fetch failed") as TypeError & { cause?: unknown };
  error.cause = cause;
  return error;
}

{
  const message = describeFetchError(createUndiciStyleFetchError());
  assert.match(message, /fetch failed/);
  assert.match(message, /ETIMEDOUT/);
  assert.match(message, /syscall=connect/);
  assert.match(message, /address=178\.159\.46\.48/);
  assert.match(message, /port=443/);
}

{
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    throw createUndiciStyleFetchError();
  };

  try {
    await assert.rejects(
      () =>
        fetchHtml("https://family.by/afisha/", {
          retries: 1,
          retryDelayMs: 0,
          nodeHttpFallback: false,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /network error/);
        assert.match(error.message, /fetch failed/);
        assert.match(error.message, /ETIMEDOUT/);
        assert.match(error.message, /178\.159\.46\.48/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls, 1);
}

console.log("fetchHtml tests: OK");
