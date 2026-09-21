import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { LookupAddress } from "node:dns";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";

import { fetchBinary, resolveSafeRemoteAddress } from "./fetchHtml";
import { assertSafeRemoteImageUrl } from "@/lib/media/safeRemoteImageUrl";

type Step =
  | { status: number; headers?: Record<string, string>; body?: Buffer }
  | { timeout: true };

function publicDns(address = "93.184.216.34") {
  return async (): Promise<LookupAddress[]> => [{ address, family: 4 }];
}

function scriptedRequest(steps: Step[], connected: string[]) {
  return (_url: URL, options: RequestOptions, onResponse: (response: IncomingMessage) => void) => {
    const request = new EventEmitter() as ClientRequest;
    const step = steps.shift();
    let timeoutHandler: (() => void) | undefined;

    request.setTimeout = ((_ms: number, handler?: () => void) => {
      timeoutHandler = handler;
      return request;
    }) as ClientRequest["setTimeout"];
    request.destroy = ((error?: Error) => {
      if (error) queueMicrotask(() => request.emit("error", error));
      return request;
    }) as ClientRequest["destroy"];
    request.end = (() => {
      if (!step) throw new Error("Unexpected request");
      if ("timeout" in step) {
        queueMicrotask(() => timeoutHandler?.());
        return request;
      }

      const lookup = options.lookup;
      assert.equal(typeof lookup, "function", "transport must receive a pinned lookup");
      lookup!("ignored.example", {}, (error, address) => {
        assert.ifError(error);
        connected.push(String(address));
        const stream = new PassThrough();
        const response = stream as unknown as IncomingMessage;
        response.statusCode = step.status;
        response.statusMessage = "Test";
        response.headers = step.headers ?? {};
        queueMicrotask(() => {
          onResponse(response);
          stream.end(step.body ?? Buffer.from("ok"));
        });
      });
      return request;
    }) as ClientRequest["end"];

    return request;
  };
}

async function expectBlocked(promise: Promise<unknown>) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal((error as Error & { httpStatus?: number }).httpStatus, 400);
    assert.doesNotMatch(error.message, /127\.0\.0\.1|192\.168|10\.0\.0/);
    return true;
  });
}

async function main() {
  await expectBlocked(
    resolveSafeRemoteAddress(new URL("https://private.example/x"), async () => [
      { address: "10.0.0.1", family: 4 },
    ]),
  );
  await expectBlocked(
    resolveSafeRemoteAddress(new URL("https://mixed.example/x"), async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "fd00::1", family: 6 },
    ]),
  );
  await expectBlocked(
    resolveSafeRemoteAddress(new URL("https://dns-failure.example/x"), async () => {
      throw new Error("DNS failed");
    }),
  );

  // Rebinding proof: resolution occurs once and the socket lookup receives
  // the stored public answer instead of performing a second DNS query.
  let resolutions = 0;
  const reboundAnswers: LookupAddress[][] = [
    [{ address: "93.184.216.34", family: 4 }],
    [{ address: "127.0.0.1", family: 4 }],
  ];
  const connected: string[] = [];
  await fetchBinary("https://rebind.example/image.jpg", {
    maxBytes: 16,
    validateUrl: (url) => assertSafeRemoteImageUrl(url.toString()),
    resolveHostname: async () => reboundAnswers[resolutions++]!,
    request: scriptedRequest([{ status: 200 }], connected),
  });
  assert.equal(resolutions, 1);
  assert.deepEqual(connected, ["93.184.216.34"]);

  const blockedRedirectRequests: string[] = [];
  await expectBlocked(fetchBinary("https://public.example/start", {
    validateUrl: (url) => assertSafeRemoteImageUrl(url.toString()),
    resolveHostname: async (hostname) => {
      if (hostname === "private.example") return [{ address: "192.168.1.8", family: 4 }];
      return [{ address: "93.184.216.34", family: 4 }];
    },
    request: (url, options, onResponse) => {
      blockedRedirectRequests.push(url.toString());
      return scriptedRequest([
        { status: 302, headers: { location: "https://private.example/secret" } },
      ], [])(url, options, onResponse);
    },
  }));
  assert.equal(blockedRedirectRequests.length, 1, "private redirect must not be connected");

  const literalRedirectRequests: string[] = [];
  await expectBlocked(fetchBinary("https://public.example/start", {
    validateUrl: (url) => assertSafeRemoteImageUrl(url.toString()),
    resolveHostname: publicDns(),
    request: (url, options, onResponse) => {
      literalRedirectRequests.push(url.toString());
      return scriptedRequest([
        { status: 302, headers: { location: "http://127.0.0.1/metadata" } },
      ], [])(url, options, onResponse);
    },
  }));
  assert.equal(literalRedirectRequests.length, 1, "private literal redirect must not be connected");

  const publicRedirectConnections: string[] = [];
  const redirected = await fetchBinary("https://one.example/start", {
    resolveHostname: publicDns(),
    request: scriptedRequest([
      { status: 302, headers: { location: "https://two.example/image.jpg" } },
      { status: 200, body: Buffer.from("image") },
    ], publicRedirectConnections),
  });
  assert.equal(redirected.finalUrl, "https://two.example/image.jpg");
  assert.equal(publicRedirectConnections.length, 2);

  await assert.rejects(
    fetchBinary("https://loop.example/start", {
      maxRedirects: 1,
      resolveHostname: publicDns(),
      request: scriptedRequest([
        { status: 302, headers: { location: "/again" } },
        { status: 302, headers: { location: "/again" } },
      ], []),
    }),
    /перенаправлени/,
  );

  await assert.rejects(
    fetchBinary("https://slow.example/image", {
      timeoutMs: 5,
      resolveHostname: publicDns(),
      request: scriptedRequest([{ timeout: true }], []),
    }),
    (error: unknown) => (error as { httpStatus?: number }).httpStatus === 504,
  );

  let lateRequestCount = 0;
  await assert.rejects(
    fetchBinary("https://slow-dns.example/image", {
      timeoutMs: 5,
      resolveHostname: () => new Promise((resolve) => {
        setTimeout(() => resolve([{ address: "93.184.216.34", family: 4 }]), 20);
      }),
      request: (url, options, onResponse) => {
        lateRequestCount += 1;
        return scriptedRequest([{ status: 200 }], [])(url, options, onResponse);
      },
    }),
    (error: unknown) => (error as { httpStatus?: number }).httpStatus === 504,
  );
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(lateRequestCount, 0, "late DNS completion must not open a socket after timeout");

  await assert.rejects(
    fetchBinary("https://large.example/image", {
      maxBytes: 4,
      resolveHostname: publicDns(),
      request: scriptedRequest([{ status: 200, body: Buffer.alloc(5) }], []),
    }),
    /большой/,
  );

  await assert.rejects(
    fetchBinary("https://declared-large.example/image", {
      maxBytes: 4,
      resolveHostname: publicDns(),
      request: scriptedRequest([
        { status: 200, headers: { "content-length": "5" }, body: Buffer.alloc(5) },
      ], []),
    }),
    /большой/,
  );

  console.log("safe remote fetch tests: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
