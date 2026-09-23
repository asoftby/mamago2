import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { rootCertificates } from "node:tls";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";

import {
  getFamilyByIntermediateCertificates,
  resolveSourceSpecificTlsCa,
} from "./familyByTls";
import { describeFetchError, fetchHtml } from "./fetchHtml";
import { assertSafeFamilyByImportUrl } from "./familyByUrlPolicy";

const FAMILY_BY_REGRESSION_URL =
  "https://family.by/uploads/posts/2026-08/thumbs/1787118815_ebru.jpg";

function testDescribeFetchError() {
  const cause = Object.assign(new Error("connect ETIMEDOUT 178.159.46.48:443"), {
    code: "ETIMEDOUT",
    address: "178.159.46.48",
    port: 443,
  });
  const error = Object.assign(new Error("remote request failed"), { cause });
  const message = describeFetchError(error);
  assert.match(message, /ETIMEDOUT/);
  assert.match(message, /178\.159\.46\.48/);
}

function testFamilyByCaBundle() {
  const familyByCa = resolveSourceSpecificTlsCa(new URL("https://family.by/afisha/"));
  const wwwFamilyByCa = resolveSourceSpecificTlsCa(new URL("https://www.family.by/afisha/"));

  assert.ok(familyByCa);
  assert.equal(familyByCa, wwwFamilyByCa);
  assert.equal(familyByCa.length, rootCertificates.length + 4);
  assert.equal(resolveSourceSpecificTlsCa(new URL("http://family.by/afisha/")), undefined);
  assert.equal(resolveSourceSpecificTlsCa(new URL("https://example.com/")), undefined);

  const intermediates = getFamilyByIntermediateCertificates();
  assert.equal(intermediates.length, 4);

  const regressionCa = resolveSourceSpecificTlsCa(new URL(FAMILY_BY_REGRESSION_URL));
  assert.ok(regressionCa);
  assert.equal(regressionCa.length, rootCertificates.length + 4);
}

function successfulRequest(body: Buffer) {
  return (_url: URL, options: RequestOptions, onResponse: (response: IncomingMessage) => void) => {
    const request = new EventEmitter() as ClientRequest;
    request.setTimeout = ((_ms: number, _handler?: () => void) => request) as ClientRequest["setTimeout"];
    request.destroy = ((error?: Error) => {
      if (error) queueMicrotask(() => request.emit("error", error));
      return request;
    }) as ClientRequest["destroy"];
    request.end = (() => {
      const lookup = options.lookup;
      assert.equal(typeof lookup, "function", "HTML transport must receive pinned DNS lookup");
      lookup!("family.by", {}, (error, address) => {
        assert.ifError(error);
        assert.equal(String(address), "93.184.216.34");

        const stream = new PassThrough();
        const response = stream as unknown as IncomingMessage;
        response.statusCode = 200;
        response.statusMessage = "OK";
        response.headers = { "content-type": "text/html" };
        queueMicrotask(() => {
          onResponse(response);
          stream.end(body);
        });
      });
      return request;
    }) as ClientRequest["end"];
    return request;
  };
}

async function testHtmlUsesPinnedTransport() {
  let resolutions = 0;
  const result = await fetchHtml("https://family.by/afisha/", {
    retries: 1,
    validateUrl: (url) => assertSafeFamilyByImportUrl(url, { pathPrefix: "/afisha/" }),
    resolveHostname: async () => {
      resolutions += 1;
      return [{ address: "93.184.216.34", family: 4 }];
    },
    request: successfulRequest(Buffer.from("<html>safe</html>", "utf8")),
  });

  assert.equal(resolutions, 1);
  assert.equal(result.status, 200);
  assert.equal(result.html, "<html>safe</html>");
  assert.equal(result.finalUrl, "https://family.by/afisha/");
}

async function testHtmlRejectsPrivateTargets() {
  for (const url of [
    "http://127.0.0.1/?family.by",
    "http://169.254.169.254/latest/meta-data/?family.by",
    "http://10.0.0.5/?family.by",
  ]) {
    await assert.rejects(
      fetchHtml(url, { retries: 1 }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { httpStatus?: number }).httpStatus, 400);
        return true;
      },
      url,
    );
  }

  await assert.rejects(
    fetchHtml("https://family.by/afisha/", {
      retries: 1,
      validateUrl: (url) => assertSafeFamilyByImportUrl(url, { pathPrefix: "/afisha/" }),
      resolveHostname: async () => [{ address: "127.0.0.1", family: 4 }],
    }),
    (error: unknown) => (error as Error & { httpStatus?: number }).httpStatus === 400,
  );

  await assert.rejects(
    fetchHtml("https://family.by/afisha/", {
      retries: 1,
      validateUrl: (url) => assertSafeFamilyByImportUrl(url, { pathPrefix: "/afisha/" }),
      resolveHostname: async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "fd00::1", family: 6 },
      ],
    }),
    (error: unknown) => (error as Error & { httpStatus?: number }).httpStatus === 400,
  );
}

async function main() {
  testDescribeFetchError();
  testFamilyByCaBundle();
  await testHtmlUsesPinnedTransport();
  await testHtmlRejectsPrivateTargets();
  console.log("fetchHtml security tests: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
