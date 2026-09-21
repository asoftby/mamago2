import assert from "node:assert/strict";

import { assertSafeRemoteImageUrl, isPublicIpAddress } from "./safeRemoteImageUrl";

function expectRejected(raw: string, messagePattern: RegExp) {
  assert.throws(
    () => assertSafeRemoteImageUrl(raw),
    (error: unknown) => {
      assert.ok(error instanceof Error, `expected an Error for ${JSON.stringify(raw)}`);
      assert.match(error.message, messagePattern);
      // /api/media/from-url classifies errors by this tag, not by message
      // text — every rejection here must carry it.
      assert.equal(
        (error as Error & { httpStatus?: number }).httpStatus,
        400,
        `expected httpStatus 400 for ${JSON.stringify(raw)}`,
      );
      return true;
    },
  );
}

expectRejected("", /Пустой/);
expectRejected("   ", /Пустой/);
expectRejected("not a url", /Некорректный/);
expectRejected("ftp://example.com/file.jpg", /Разрешены/);
expectRejected("javascript:alert(1)", /Разрешены/);

// Private/reserved hosts: this branch previously threw without an
// `httpStatus` tag and fell through to a generic 500 in
// /api/media/from-url instead of 400 — regression-guard it explicitly.
expectRejected("http://localhost/x.jpg", /недоступен/);
expectRejected("http://127.0.0.1/x.jpg", /недоступен/);
expectRejected("http://0.0.0.0/x.jpg", /недоступен/);
expectRejected("http://169.254.169.254/latest/meta-data/", /недоступен/); // cloud metadata endpoint
expectRejected("http://10.0.0.5/x.jpg", /недоступен/);
expectRejected("http://192.168.1.5/x.jpg", /недоступен/);
expectRejected("http://172.16.0.5/x.jpg", /недоступен/);
expectRejected("http://[::1]/x.jpg", /недоступен/);
expectRejected("http://[::ffff:127.0.0.1]/x.jpg", /недоступен/);
expectRejected("http://localhost./x.jpg", /недоступен/);
expectRejected("http://2130706433/x.jpg", /недоступен/);
expectRejected("http://0x7f000001/x.jpg", /недоступен/);
expectRejected("http://0177.0.0.1/x.jpg", /недоступен/);
expectRejected("http://user:password@example.com/x.jpg", /not allowed/);

assert.equal(isPublicIpAddress("8.8.8.8"), true);
assert.equal(isPublicIpAddress("100.64.0.1"), false);
assert.equal(isPublicIpAddress("169.254.169.254"), false);
assert.equal(isPublicIpAddress("224.0.0.1"), false);
assert.equal(isPublicIpAddress("240.0.0.1"), false);
assert.equal(isPublicIpAddress("::1"), false);
assert.equal(isPublicIpAddress("fe80::1"), false);
assert.equal(isPublicIpAddress("fc00::1"), false);
assert.equal(isPublicIpAddress("::ffff:127.0.0.1"), false);
assert.equal(isPublicIpAddress("2606:4700:4700::1111"), true);

{
  const url = assertSafeRemoteImageUrl("https://family.by/uploads/posts/2026-08/thumbs/1787118815_ebru.jpg");
  assert.equal(url.hostname, "family.by");
  assert.equal(url.protocol, "https:");
}

{
  const url = assertSafeRemoteImageUrl("  https://example.com/a.jpg  ");
  assert.equal(url.toString(), "https://example.com/a.jpg");
}

console.log("safeRemoteImageUrl tests: OK");
