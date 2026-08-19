import assert from "node:assert/strict";
import { rootCertificates } from "node:tls";

import {
  getFamilyByIntermediateCertificates,
  resolveSourceSpecificTlsCa,
} from "./familyByTls";
import { describeFetchError, fetchBinary, fetchHtml } from "./fetchHtml";
import { assertSafeRemoteImageUrl } from "@/lib/media/safeRemoteImageUrl";

// The exact URL that exposed the family.by incomplete-chain bug for
// POST /api/media/from-url (release blocker). Kept literal so a regression
// in either the pinned CA bundle or the family.by hostname match is caught
// against the concrete URL, not just the general host pattern.
const FAMILY_BY_REGRESSION_URL =
  "https://family.by/uploads/posts/2026-08/thumbs/1787118815_ebru.jpg";

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

function jsonHeaders(extra: Record<string, string> = {}): Headers {
  return new Headers(extra);
}

function testDescribeFetchError() {
  const message = describeFetchError(createUndiciStyleFetchError());
  assert.match(message, /fetch failed/);
  assert.match(message, /ETIMEDOUT/);
  assert.match(message, /syscall=connect/);
  assert.match(message, /address=178\.159\.46\.48/);
  assert.match(message, /port=443/);
}

function testFamilyByCaBundle() {
  const familyByCa = resolveSourceSpecificTlsCa(new URL("https://family.by/afisha/"));
  const wwwFamilyByCa = resolveSourceSpecificTlsCa(new URL("https://www.family.by/afisha/"));

  assert.ok(familyByCa, "family.by gets the source-specific CA bundle");
  assert.equal(familyByCa, wwwFamilyByCa, "www.family.by uses the same CA bundle");
  assert.equal(familyByCa.length, rootCertificates.length + 4);
  assert.equal(resolveSourceSpecificTlsCa(new URL("http://family.by/afisha/")), undefined);
  assert.equal(resolveSourceSpecificTlsCa(new URL("https://example.com/")), undefined);

  const intermediates = getFamilyByIntermediateCertificates();
  assert.deepEqual(
    intermediates.map((certificate) => certificate.subject),
    [
      "C=BE\nO=GlobalSign nv-sa\nCN=GlobalSign GCC R6 AlphaSSL CA 2025",
      "C=BE\nO=GlobalSign nv-sa\nCN=GlobalSign GCC R46 AlphaSSL CA 2025",
      "C=BE\nO=GlobalSign nv-sa\nCN=GlobalSign GCC R46 DV TLS CA 2025",
      "C=BE\nO=GlobalSign nv-sa\nCN=GlobalSign GCC R3 DV TLS CA 2020",
    ],
  );
  assert.deepEqual(
    intermediates.map((certificate) => certificate.fingerprint.toUpperCase()),
    [
      "43:19:55:E6:E5:DA:BE:85:7F:13:36:C0:23:68:E5:49:5F:14:3E:ED",
      "E7:AE:6D:3B:B2:65:B2:04:B7:EA:3D:73:2E:DE:C0:79:9A:B2:24:88",
      "41:23:21:21:F7:E4:2A:FD:A1:C6:16:F7:4A:49:D7:A1:3C:6B:6A:E7",
      "1C:61:0A:0A:87:D4:92:F4:83:22:C2:AF:D3:BE:9B:6A:D3:6B:6B:EE",
    ],
  );

  // Pin the CA bundle resolution to the exact URL that failed for
  // /api/media/from-url, not just the family.by hostname pattern in general.
  const regressionCa = resolveSourceSpecificTlsCa(new URL(FAMILY_BY_REGRESSION_URL));
  assert.ok(regressionCa, "the exact regression URL must resolve to the family.by CA bundle");
  assert.equal(regressionCa.length, rootCertificates.length + 4);
}

async function testFetchHtmlNetworkErrorClassification() {
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

async function testFetchBinaryValidatesRedirectHops() {
  // fetchBinary must validate every redirect hop, not just the initial URL —
  // otherwise a safe initial URL could redirect to a private/internal host
  // (SSRF). The unsafe target must never be requested.
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requestedUrls.push(url);
    return new Response(null, {
      status: 302,
      headers: jsonHeaders({ location: "http://127.0.0.1/secret" }),
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        fetchBinary("https://example.com/redirect-to-private", {
          nodeHttpFallback: false,
          validateUrl: (candidate) => {
            assertSafeRemoteImageUrl(candidate.toString());
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { httpStatus?: number }).httpStatus, 400);
        assert.match(error.message, /недоступен/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(
    requestedUrls,
    ["https://example.com/redirect-to-private"],
    "the private redirect target must never be requested",
  );
}

async function testFetchBinaryBoundsRedirectLoop() {
  // A malicious or misconfigured upstream that redirects forever must not
  // hang the request indefinitely — it must be bounded and rejected.
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(null, {
      status: 302,
      headers: jsonHeaders({ location: "https://example.com/next" }),
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        fetchBinary("https://example.com/loop", {
          nodeHttpFallback: false,
          maxRedirects: 2,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { httpStatus?: number }).httpStatus, 400);
        assert.match(error.message, /перенаправлени/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(calls <= 4, `redirect loop must be bounded, got ${calls} requests`);
}

async function testFetchBinaryRejectsDeclaredOversize() {
  // A declared Content-Length above the cap must be rejected without ever
  // entering our own read loop. Note: the JS engine may eagerly pull one
  // chunk into a freshly-constructed ReadableStream's internal queue ahead
  // of any demand (queuingStrategy highWaterMark), independent of whether
  // application code calls `.getReader().read()` — that single engine-level
  // prefetch is bounded and not a read loop, so the assertion below allows
  // for it and instead proves fetchBinary never advances past one chunk.
  const originalFetch = globalThis.fetch;
  let pullCount = 0;

  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream({
        pull(controller) {
          pullCount += 1;
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      }),
      { status: 200, headers: jsonHeaders({ "content-length": "99999999" }) },
    )) as typeof fetch;

  try {
    await assert.rejects(
      () => fetchBinary("https://example.com/huge.jpg", { nodeHttpFallback: false, maxBytes: 1_000 }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { httpStatus?: number }).httpStatus, 400);
        assert.match(error.message, /большой/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(
    pullCount <= 1,
    `fetchBinary must never enter a read loop once Content-Length exceeds the cap, saw ${pullCount} pulls`,
  );
}

async function testFetchBinaryCapsStreamedOversize() {
  // Without a (trustworthy) Content-Length header, the cap must still be
  // enforced by aborting the stream early instead of buffering everything.
  const originalFetch = globalThis.fetch;
  let chunksProduced = 0;

  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream({
        pull(controller) {
          chunksProduced += 1;
          if (chunksProduced > 20) {
            controller.close();
            return;
          }
          controller.enqueue(new Uint8Array(1_000));
        },
      }),
      { status: 200 },
    )) as typeof fetch;

  try {
    await assert.rejects(
      () => fetchBinary("https://example.com/streamed.jpg", { nodeHttpFallback: false, maxBytes: 5_000 }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { httpStatus?: number }).httpStatus, 400);
        assert.match(error.message, /большой/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(
    chunksProduced <= 10,
    `oversized stream must be cancelled well before it finishes, produced ${chunksProduced} chunks`,
  );
}

async function testFetchBinaryClassifiesTransportFailureAs502() {
  // A TLS/transport failure (the family.by-shaped error) must classify as a
  // controlled 502 when the Node http fallback is disabled/exhausted — never
  // a generic unclassified error.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw createUndiciStyleFetchError();
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => fetchBinary("https://family.by/some-missing-chain.jpg", { nodeHttpFallback: false }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { httpStatus?: number }).httpStatus, 502);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testFetchBinaryClassifiesTimeoutAs504() {
  // Our own timeout firing (AbortController) must classify as 504, not a
  // generic/opaque failure.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("This operation was aborted", "AbortError"));
      });
    })) as typeof fetch;

  try {
    await assert.rejects(
      () => fetchBinary("https://example.com/slow.jpg", { nodeHttpFallback: false, timeoutMs: 20 }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { httpStatus?: number }).httpStatus, 504);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main() {
  testDescribeFetchError();
  testFamilyByCaBundle();
  await testFetchHtmlNetworkErrorClassification();
  await testFetchBinaryValidatesRedirectHops();
  await testFetchBinaryBoundsRedirectLoop();
  await testFetchBinaryRejectsDeclaredOversize();
  await testFetchBinaryCapsStreamedOversize();
  await testFetchBinaryClassifiesTransportFailureAs502();
  await testFetchBinaryClassifiesTimeoutAs504();

  console.log("fetchHtml tests: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
