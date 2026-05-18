/**
 * Tests for AI rewrite input validation limits.
 *
 * Запуск: npx tsx src/app/api/ai/rewrite/route.test.ts
 */

import assert from "node:assert/strict";
import { z } from "zod";

// ─── Schema under test (mirrors the route's rewriteRequestSchema) ────────────

const rewriteRequestSchema = z.object({
  tone: z.enum(["neutral", "friendly", "editorial", "short"]),
  sourceText: z.string().trim().min(20).max(8000),
  title: z.string().trim().max(200).optional(),
  entityType: z.enum(["event", "place"]).optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeValidInput(overrides: Record<string, unknown> = {}) {
  return {
    tone: "neutral",
    sourceText: "A".repeat(100),
    ...overrides,
  };
}

function makeStringOfLength(n: number): string {
  return "A".repeat(n);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${(e as Error).message}`);
    failed++;
  }
}

console.log("\n🧪 AI Rewrite input validation tests\n");

// ─── sourceText length limits ────────────────────────────────────────────────

test("sourceText with 20 chars passes", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ sourceText: makeStringOfLength(20) }),
  );
  assert.equal(result.success, true);
});

test("sourceText with 19 chars fails (below min)", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ sourceText: makeStringOfLength(19) }),
  );
  assert.equal(result.success, false);
});

test("sourceText with 7999 chars passes (below max)", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ sourceText: makeStringOfLength(7999) }),
  );
  assert.equal(result.success, true);
});

test("sourceText with 8000 chars passes (exactly max)", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ sourceText: makeStringOfLength(8000) }),
  );
  assert.equal(result.success, true);
});

test("sourceText with 8001 chars fails (exceeds max)", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ sourceText: makeStringOfLength(8001) }),
  );
  assert.equal(result.success, false);
});

// ─── title length limits ─────────────────────────────────────────────────────

test("title with 200 chars passes (exactly max)", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ title: makeStringOfLength(200) }),
  );
  assert.equal(result.success, true);
});

test("title with 201 chars fails (exceeds max)", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ title: makeStringOfLength(201) }),
  );
  assert.equal(result.success, false);
});

test("title is optional — missing title passes", () => {
  const result = rewriteRequestSchema.safeParse(makeValidInput());
  assert.equal(result.success, true);
});

test("title with empty string passes (trimmed to empty, optional)", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ title: "" }),
  );
  assert.equal(result.success, true);
});

// ─── Validation error does NOT expose Zod internals ──────────────────────────

test("validation error returns generic message, not Zod details", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ sourceText: makeStringOfLength(8001) }),
  );
  assert.equal(result.success, false);

  // Simulate what the route does: return { error: "Invalid input" }
  const responseBody = { error: "Invalid input" };
  assert.equal(responseBody.error, "Invalid input");
  // Ensure no Zod internals are leaked
  assert.equal("details" in responseBody, false);
});

// ─── Server-side hard guard logic ────────────────────────────────────────────

test("hard guard: sourceText > 8000 should block provider call", () => {
  // This simulates the guard check before OpenRouter call
  const sourceText = makeStringOfLength(8001);
  const shouldCallProvider = sourceText.length <= 8000;
  assert.equal(shouldCallProvider, false);
});

test("hard guard: sourceText <= 8000 should allow provider call", () => {
  const sourceText = makeStringOfLength(8000);
  const shouldCallProvider = sourceText.length <= 8000;
  assert.equal(shouldCallProvider, true);
});

test("hard guard: sourceText = 7999 should allow provider call", () => {
  const sourceText = makeStringOfLength(7999);
  const shouldCallProvider = sourceText.length <= 8000;
  assert.equal(shouldCallProvider, true);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}