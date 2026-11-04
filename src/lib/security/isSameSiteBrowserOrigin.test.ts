import assert from "node:assert/strict";
import test from "node:test";
import { isSameSiteBrowserOrigin as check } from "./isSameSiteBrowserOrigin";

test("LOCAL public host passes despite internal reverse-proxy address", () => {
  assert.equal(check({ origin: "http://mamago.local:3000", host: "mamago.local:3000", protocol: "http:" }), true);
  assert.equal(check({ origin: "http://localhost:3000", host: "localhost:3000", protocol: "http:" }), true);
});
test("production HTTPS host passes through HTTPS-forwarded proxy", () => {
  assert.equal(check({ origin: "https://mamago.by", host: "mamago.by", protocol: "https" }), true);
});
test("cross-site and malformed origins remain blocked", () => {
  for (const origin of ["https://evil.example", "http://mamago.by", "https://mamago.by.evil.example", "https://mamago.by/path", "null", "https://user@mamago.by"]) {
    assert.equal(check({ origin, host: "mamago.by", protocol: "https" }), false, origin);
  }
  assert.equal(check({ origin: "https://mamago.by", host: null, protocol: "https" }), false);
});
