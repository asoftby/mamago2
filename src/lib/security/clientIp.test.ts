/**
 * getTrustedClientIp() unit tests — pure, no DB.
 * Запуск: npx tsx src/lib/security/clientIp.test.ts
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { getTrustedClientIp } from "./clientIp";

function req(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/whatever", { headers });
}

function main() {
  // 1. gate false + X-Real-IP present => null
  assert.equal(
    getTrustedClientIp(req({ "x-real-ip": "203.0.113.10" }), false),
    null,
    "gate off must ignore even a well-formed X-Real-IP",
  );

  // 2. gate true + valid IPv4 X-Real-IP => returned
  assert.equal(
    getTrustedClientIp(req({ "x-real-ip": "203.0.113.10" }), true),
    "203.0.113.10",
  );

  // 3. gate true + valid IPv6 => returned
  assert.equal(
    getTrustedClientIp(req({ "x-real-ip": "2001:db8::1" }), true),
    "2001:db8::1",
  );

  // 4. malformed X-Real-IP => null
  assert.equal(
    getTrustedClientIp(req({ "x-real-ip": "not-an-ip" }), true),
    null,
  );

  // 5. whitespace normalized
  assert.equal(
    getTrustedClientIp(req({ "x-real-ip": "  203.0.113.10  " }), true),
    "203.0.113.10",
  );

  // 6. CF-Connecting-IP only => ignored
  assert.equal(
    getTrustedClientIp(req({ "cf-connecting-ip": "198.51.100.1" }), true),
    null,
    "CF-Connecting-IP must never be trusted, gate on or off",
  );

  // 7. X-Forwarded-For only => ignored
  assert.equal(
    getTrustedClientIp(req({ "x-forwarded-for": "198.51.100.1" }), true),
    null,
    "X-Forwarded-For must never be trusted, gate on or off",
  );

  // 8. forged CF + valid X-Real-IP => X-Real-IP wins
  assert.equal(
    getTrustedClientIp(
      req({ "cf-connecting-ip": "6.6.6.6", "x-real-ip": "203.0.113.10" }),
      true,
    ),
    "203.0.113.10",
    "a forged CF-Connecting-IP alongside a real X-Real-IP must not change the result",
  );

  // 9. forged XFF + valid X-Real-IP => X-Real-IP wins
  assert.equal(
    getTrustedClientIp(
      req({ "x-forwarded-for": "6.6.6.6, 7.7.7.7", "x-real-ip": "203.0.113.10" }),
      true,
    ),
    "203.0.113.10",
    "a forged X-Forwarded-For alongside a real X-Real-IP must not change the result",
  );

  // 10. no header at all => null
  assert.equal(getTrustedClientIp(req({}), true), null);

  console.log("clientIp.test.ts: OK");
}

main();
