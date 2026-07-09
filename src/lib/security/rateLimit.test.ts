/**
 * Integration test for the Postgres-backed rate limiter.
 * Requires DATABASE_URL and an applied `add_rate_limit_entry` migration:
 *   set -a; source .env; set +a; npx tsx src/lib/security/rateLimit.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, resetRateLimit } from "./rateLimit";

const KEY = `test:${randomUUID()}`;
const EXPIRY_KEY = `test:${randomUUID()}`;
const LIMIT = 3;
const WINDOW = 1000; // 1 second

async function main() {
  console.log("Starting rateLimit tests...");

  // 1. Initial attempt
  const r1 = await checkRateLimit(KEY, LIMIT, WINDOW * 60);
  assert.strictEqual(r1.allowed, true, "First attempt should be allowed");
  assert.strictEqual(r1.remaining, LIMIT - 1, "Remaining count should be limit - 1");

  // 2. Second attempt
  const r2 = await checkRateLimit(KEY, LIMIT, WINDOW * 60);
  assert.strictEqual(r2.allowed, true, "Second attempt should be allowed");
  assert.strictEqual(r2.remaining, LIMIT - 2, "Remaining count should be limit - 2");

  // 3. Third attempt (last allowed)
  const r3 = await checkRateLimit(KEY, LIMIT, WINDOW * 60);
  assert.strictEqual(r3.allowed, true, "Third attempt should be allowed");
  assert.strictEqual(r3.remaining, 0, "Remaining count should be 0");

  // 4. Fourth attempt (blocked); the window must not extend on repeat hits
  const r4 = await checkRateLimit(KEY, LIMIT, WINDOW * 60);
  assert.strictEqual(r4.allowed, false, "Fourth attempt should be blocked");
  assert.strictEqual(r4.remaining, 0, "Remaining count should stay 0");
  assert.strictEqual(r4.resetAt, r3.resetAt, "Window must not extend on repeat hits");

  // 5. Reset (reset-on-success semantics for login / otp_verify)
  await resetRateLimit(KEY);
  const r5 = await checkRateLimit(KEY, LIMIT, WINDOW * 60);
  assert.strictEqual(r5.allowed, true, "Attempt after reset should be allowed");
  assert.strictEqual(r5.remaining, LIMIT - 1, "Remaining count should reset");

  // 6. Expiry (wait for WINDOW + a bit)
  console.log("Testing expiry (waiting 1.1s)...");
  await checkRateLimit(EXPIRY_KEY, 1, WINDOW);
  const rBefore = await checkRateLimit(EXPIRY_KEY, 1, WINDOW);
  assert.strictEqual(rBefore.allowed, false, "Should be blocked before expiry");

  await new Promise((resolve) => setTimeout(resolve, 1100));

  const rAfter = await checkRateLimit(EXPIRY_KEY, 1, WINDOW);
  assert.strictEqual(rAfter.allowed, true, "Should be allowed after expiry");
  console.log("Expiry test: OK");
}

main()
  .then(async () => {
    console.log("rateLimit tests: ALL OK");
  })
  .catch((err) => {
    console.error("rateLimit tests: FAILED", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.rateLimitEntry.deleteMany({
      where: { key: { in: [KEY, EXPIRY_KEY] } },
    });
    await prisma.$disconnect();
  });
