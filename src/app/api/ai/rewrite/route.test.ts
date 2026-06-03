/**
 * Tests for AI rewrite input validation limits.
 *
 * Запуск: npx tsx src/app/api/ai/rewrite/route.test.ts
 */

import assert from "node:assert/strict";
import { z } from "zod";

const contextValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
]);

const rewriteRequestSchema = z
  .object({
    action: z.enum(["generate", "improve", "shorten", "warm", "sell"]),
    sourceText: z.string().trim().max(8000).optional().default(""),
    title: z.string().trim().max(200).optional(),
    entityType: z.enum(["event", "place", "offer"]),
    context: z.record(z.string(), contextValueSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action !== "generate" && data.sourceText.trim().length < 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceText"],
        message: "sourceText must be at least 20 characters",
      });
    }

    if (data.action === "generate" && !data.title?.trim() && !data.context) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["context"],
        message: "title or context is required for generate",
      });
    }
  });

function makeValidInput(overrides: Record<string, unknown> = {}) {
  return {
    action: "improve",
    entityType: "event",
    sourceText: "A".repeat(100),
    ...overrides,
  };
}

function makeStringOfLength(n: number): string {
  return "A".repeat(n);
}

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

test("improve with 20 chars passes", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ sourceText: makeStringOfLength(20) }),
  );
  assert.equal(result.success, true);
});

test("improve with 19 chars fails", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ sourceText: makeStringOfLength(19) }),
  );
  assert.equal(result.success, false);
});

test("generate allows empty sourceText when title exists", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({
      action: "generate",
      sourceText: "",
      title: "Место для семейного отдыха",
      entityType: "place",
    }),
  );
  assert.equal(result.success, true);
});

test("generate fails without title and context", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({
      action: "generate",
      sourceText: "",
      title: "",
      context: undefined,
      entityType: "offer",
    }),
  );
  assert.equal(result.success, false);
});

test("sourceText with 8000 chars passes", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ sourceText: makeStringOfLength(8000) }),
  );
  assert.equal(result.success, true);
});

test("sourceText with 8001 chars fails", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ sourceText: makeStringOfLength(8001) }),
  );
  assert.equal(result.success, false);
});

test("title with 200 chars passes", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ title: makeStringOfLength(200) }),
  );
  assert.equal(result.success, true);
});

test("title with 201 chars fails", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ title: makeStringOfLength(201) }),
  );
  assert.equal(result.success, false);
});

test("offer entityType passes", () => {
  const result = rewriteRequestSchema.safeParse(
    makeValidInput({ entityType: "offer", action: "sell" }),
  );
  assert.equal(result.success, true);
});

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
