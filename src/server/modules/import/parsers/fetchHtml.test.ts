import assert from "node:assert/strict";
import { rootCertificates } from "node:tls";

import {
  getFamilyByIntermediateCertificates,
  resolveSourceSpecificTlsCa,
} from "./familyByTls";
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
  const familyByCa = resolveSourceSpecificTlsCa(new URL("https://family.by/afisha/"));
  const wwwFamilyByCa = resolveSourceSpecificTlsCa(new URL("https://www.family.by/afisha/"));

  assert.ok(familyByCa, "family.by gets the source-specific CA bundle");
  assert.equal(familyByCa, wwwFamilyByCa, "www.family.by uses the same CA bundle");
  assert.equal(familyByCa.length, rootCertificates.length + 2);
  assert.equal(resolveSourceSpecificTlsCa(new URL("http://family.by/afisha/")), undefined);
  assert.equal(resolveSourceSpecificTlsCa(new URL("https://example.com/")), undefined);

  const intermediates = getFamilyByIntermediateCertificates();
  assert.deepEqual(
    intermediates.map((certificate) => certificate.subject),
    [
      "C=BE\nO=GlobalSign nv-sa\nCN=GlobalSign GCC R6 AlphaSSL CA 2025",
      "C=BE\nO=GlobalSign nv-sa\nCN=GlobalSign GCC R46 AlphaSSL CA 2025",
    ],
  );
  assert.deepEqual(
    intermediates.map((certificate) => certificate.fingerprint.toUpperCase()),
    [
      "43:19:55:E6:E5:DA:BE:85:7F:13:36:C0:23:68:E5:49:5F:14:3E:ED",
      "E7:AE:6D:3B:B2:65:B2:04:B7:EA:3D:73:2E:DE:C0:79:9A:B2:24:88",
    ],
  );
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
