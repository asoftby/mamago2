import assert from "node:assert/strict";
import type { OpenRouterCallInput, OpenRouterCallResult } from "@/lib/ai/openrouterClient";
import { createExtractionCall, type ExtractionUsage } from "./modelCall";

type Step = OpenRouterCallResult | ((input: OpenRouterCallInput) => OpenRouterCallResult);

const ok = (content: string, tokensIn = 10, tokensOut = 5): OpenRouterCallResult => ({
  ok: true,
  content,
  model: "echo",
  tokensIn,
  tokensOut,
});
const fail = (code: Extract<OpenRouterCallResult, { ok: false }>["code"], retryable: boolean): OpenRouterCallResult => ({
  ok: false,
  code,
  retryable,
});

function setup(steps: Step[]) {
  const models: string[] = [];
  const tokenLimits: Array<number | undefined> = [];
  const queue = [...steps];
  const usage: ExtractionUsage = { tokensIn: null, tokensOut: null, model: null };
  const call = createExtractionCall<string>({
    openrouter: {
      async chat(input) {
        models.push(input.model);
        tokenLimits.push(input.maxTokens);
        const next = queue.shift();
        assert.ok(next, "unexpected extra model call");
        const result = typeof next === "function" ? next(input) : next;
        return result.ok ? { ...result, model: input.model } : result;
      },
    },
    systemPrompt: "system",
    userParts: [{ type: "text", text: "hi" }],
    responseFormat: { type: "json_object" },
    parse: (content) => (content.startsWith("good") ? { ok: true, value: content } : { ok: false }),
    usage,
  });
  return { call, models, tokenLimits, usage };
}

async function main() {
  // Fast model succeeds first time.
  {
    const t = setup([ok("good-1")]);
    const out = await t.call.runWithRetry({ fast: "fast", strong: "strong" });
    assert.deepEqual(out, { ok: true, value: "good-1", escalation: null });
    assert.deepEqual(t.models, ["fast"]);
    assert.deepEqual(t.usage, { tokensIn: 10, tokensOut: 5, model: "fast" });
  }

  // Retryable infra error is retried once on the fast model; usage sums only successful calls.
  {
    const t = setup([fail("OPENROUTER_HTTP_5XX", true), ok("good-2")]);
    const out = await t.call.runWithRetry({ fast: "fast", strong: "strong" });
    assert.equal(out.ok, true);
    assert.deepEqual(t.models, ["fast", "fast"]);
    assert.deepEqual(t.tokenLimits, [undefined, undefined]);
  }

  // Not configured is final and never retried.
  {
    const t = setup([fail("OPENROUTER_NOT_CONFIGURED", false)]);
    const out = await t.call.runWithRetry({ fast: "fast", strong: "strong" });
    assert.deepEqual(out, { ok: false, reason: "NOT_CONFIGURED", escalated: false, escalation: null });
    assert.deepEqual(t.models, ["fast"]);
  }

  // Non-retryable infra error fails without escalation.
  {
    const t = setup([fail("OPENROUTER_HTTP_4XX", false)]);
    const out = await t.call.runWithRetry({ fast: "fast", strong: "strong" });
    assert.deepEqual(out, { ok: false, reason: "INFRA", escalated: false, escalation: null });
    assert.deepEqual(t.models, ["fast"]);
  }

  // Invalid output twice escalates once to the strong model.
  {
    const t = setup([ok("bad"), ok("bad"), ok("good-3")]);
    const out = await t.call.runWithRetry({ fast: "fast", strong: "strong" });
    assert.deepEqual(out, { ok: true, value: "good-3", escalation: "INVALID_JSON" });
    assert.deepEqual(t.models, ["fast", "fast", "strong"]);
    assert.deepEqual(t.tokenLimits, [undefined, 4000, 4000]);
    assert.equal(t.usage.model, "strong");
    assert.equal(t.usage.tokensIn, 30);
  }

  // Invalid output twice without a strong model fails as INVALID, not escalated.
  {
    const t = setup([ok("bad"), ok("bad")]);
    const out = await t.call.runWithRetry({ fast: "fast", strong: null });
    assert.deepEqual(out, { ok: false, reason: "INVALID", escalated: false, escalation: null });
  }

  // Strong model also invalid -> INVALID, escalated.
  {
    const t = setup([ok("bad"), ok("bad"), ok("bad")]);
    const out = await t.call.runWithRetry({ fast: "fast", strong: "strong" });
    assert.deepEqual(out, { ok: false, reason: "INVALID", escalated: true, escalation: "INVALID_JSON" });
  }

  // Bad provider response after the retry escalates; a failing strong call is INFRA, escalated.
  {
    const t = setup([fail("OPENROUTER_BAD_RESPONSE", true), fail("OPENROUTER_BAD_RESPONSE", true), fail("OPENROUTER_TIMEOUT", true)]);
    const out = await t.call.runWithRetry({ fast: "fast", strong: "strong" });
    assert.deepEqual(out, { ok: false, reason: "INFRA", escalated: true, escalation: "BAD_RESPONSE" });
    assert.deepEqual(t.models, ["fast", "fast", "strong"]);
    assert.deepEqual(t.tokenLimits, [undefined, 4000, 4000]);
  }

  // Bad provider response without a strong model is a plain INFRA failure.
  {
    const t = setup([fail("OPENROUTER_BAD_RESPONSE", true), fail("OPENROUTER_BAD_RESPONSE", true)]);
    const out = await t.call.runWithRetry({ fast: "fast", strong: null });
    assert.deepEqual(out, { ok: false, reason: "INFRA", escalated: false, escalation: null });
  }

  // A strong model that is "not configured" is INFRA, matching Capture's behaviour.
  {
    const t = setup([ok("bad"), ok("bad"), fail("OPENROUTER_NOT_CONFIGURED", false)]);
    const out = await t.call.runWithRetry({ fast: "fast", strong: "strong" });
    assert.deepEqual(out, { ok: false, reason: "INFRA", escalated: true, escalation: "INVALID_JSON" });
  }

  console.log("modelCall tests passed");
}

void main();
