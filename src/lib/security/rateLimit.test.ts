import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimit } from "./rateLimit";

console.log("Starting rateLimit tests...");

const KEY = "test-key";
const LIMIT = 3;
const WINDOW = 1000; // 1 second

// 1. Initial attempt
const r1 = checkRateLimit(KEY, LIMIT, WINDOW);
assert.strictEqual(r1.allowed, true, "First attempt should be allowed");
assert.strictEqual(r1.remaining, LIMIT - 1, "Remaining count should be limit - 1");

// 2. Second attempt
const r2 = checkRateLimit(KEY, LIMIT, WINDOW);
assert.strictEqual(r2.allowed, true, "Second attempt should be allowed");
assert.strictEqual(r2.remaining, LIMIT - 2, "Remaining count should be limit - 2");

// 3. Third attempt (last allowed)
const r3 = checkRateLimit(KEY, LIMIT, WINDOW);
assert.strictEqual(r3.allowed, true, "Third attempt should be allowed");
assert.strictEqual(r3.remaining, 0, "Remaining count should be 0");

// 4. Fourth attempt (blocked)
const r4 = checkRateLimit(KEY, LIMIT, WINDOW);
assert.strictEqual(r4.allowed, false, "Fourth attempt should be blocked");
assert.strictEqual(r4.remaining, 0, "Remaining count should stay 0");

// 5. Reset
resetRateLimit(KEY);
const r5 = checkRateLimit(KEY, LIMIT, WINDOW);
assert.strictEqual(r5.allowed, true, "Attempt after reset should be allowed");
assert.strictEqual(r5.remaining, LIMIT - 1, "Remaining count should reset");

// 6. Expiry (wait for WINDOW + a bit)
async function testExpiry() {
  console.log("Testing expiry (waiting 1.1s)...");
  const EXPIRY_KEY = "expiry-key";
  checkRateLimit(EXPIRY_KEY, 1, 1000);
  const rBefore = checkRateLimit(EXPIRY_KEY, 1, 1000);
  assert.strictEqual(rBefore.allowed, false, "Should be blocked before expiry");

  await new Promise(resolve => setTimeout(resolve, 1100));

  const rAfter = checkRateLimit(EXPIRY_KEY, 1, 1000);
  assert.strictEqual(rAfter.allowed, true, "Should be allowed after expiry");
  console.log("Expiry test: OK");
}

testExpiry().then(() => {
  console.log("rateLimit tests: ALL OK");
}).catch(err => {
  console.error("rateLimit tests: FAILED", err);
  process.exit(1);
});
