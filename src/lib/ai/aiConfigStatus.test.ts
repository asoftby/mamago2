import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canSeeAiConfig, DEFAULT_OPENROUTER_MODEL, getAiConfigStatus, type AiConfigItem } from "./aiConfigStatus";

const KEY = "sk-or-v1-SECRETSENTINEL-0123456789abcdef";
const FULL = {
  OPENROUTER_API_KEY: KEY,
  OPENROUTER_CAPTURE_MODEL: "google/gemini-2.5-flash",
  OPENROUTER_CAPTURE_MODEL_STRONG: "anthropic/claude-sonnet-4.5",
  OPENROUTER_MODEL: "openai/gpt-4o-mini",
  OPENROUTER_SITE_URL: "https://example.org",
  OPENROUTER_APP_NAME: "Afisha",
};

const sev = (env: Record<string, string | undefined>) =>
  Object.fromEntries(getAiConfigStatus(env).items.map((i) => [i.key, i.severity]));

// ── Nothing secret is ever returned ─────────────────────────────────────────
{
  const status = getAiConfigStatus(FULL);
  const json = JSON.stringify(status);
  assert.ok(!json.includes(KEY), "the key never appears");
  assert.ok(!json.includes("SECRETSENTINEL") && !json.includes("sk-or"), "no part of the key appears");
  assert.ok(!json.includes("example.org") && !json.includes("Afisha"), "site url / app name values never appear");
  // Only these fields exist on an item: no value, no length, no hash.
  const allowed = new Set<keyof AiConfigItem>(["key", "isSet", "severity", "modelName", "dependents", "note"]);
  for (const item of status.items) {
    assert.ok(Object.keys(item).every((k) => allowed.has(k as keyof AiConfigItem)), `unexpected field on ${item.key}`);
    if (item.key === "OPENROUTER_API_KEY" || item.key === "OPENROUTER_SITE_APP") assert.equal(item.modelName, undefined);
  }
}

// A secret that was pasted into a model variable by mistake is not echoed either.
{
  const status = getAiConfigStatus({ ...FULL, OPENROUTER_CAPTURE_MODEL: KEY, OPENROUTER_MODEL: "has spaces/and stuff" });
  const json = JSON.stringify(status);
  assert.ok(!json.includes(KEY) && !json.includes("has spaces"));
  const fast = status.items.find((i) => i.key === "OPENROUTER_CAPTURE_MODEL")!;
  assert.equal(fast.isSet, true, "it is still reported as set");
  assert.equal(fast.modelName, undefined, "but the value is not shown");
}

// The default argument reads the real environment, still without leaking it.
{
  const before = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = KEY;
  try {
    const status = getAiConfigStatus();
    assert.equal(status.items[0].isSet, true);
    assert.ok(!JSON.stringify(status).includes("SECRETSENTINEL"));
  } finally {
    if (before === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = before;
  }
}

// ── States ───────────────────────────────────────────────────────────────────
assert.deepEqual(sev(FULL), {
  OPENROUTER_API_KEY: "ok", OPENROUTER_CAPTURE_MODEL: "ok", OPENROUTER_CAPTURE_MODEL_STRONG: "ok", OPENROUTER_MODEL: "ok", OPENROUTER_SITE_APP: "ok",
});
assert.deepEqual(sev({}), {
  OPENROUTER_API_KEY: "warning", OPENROUTER_CAPTURE_MODEL: "warning", OPENROUTER_CAPTURE_MODEL_STRONG: "info", OPENROUTER_MODEL: "info", OPENROUTER_SITE_APP: "info",
});
// Blank and whitespace-only values count as not set, like the real readers.
assert.equal(getAiConfigStatus({ ...FULL, OPENROUTER_API_KEY: "   " }).items[0].isSet, false);
assert.equal(getAiConfigStatus({ ...FULL, OPENROUTER_CAPTURE_MODEL: "" }).items[1].isSet, false);

// Model names are shown (not secret); trimmed.
{
  const items = getAiConfigStatus({ ...FULL, OPENROUTER_CAPTURE_MODEL: "  google/gemini-2.5-flash  " }).items;
  assert.equal(items.find((i) => i.key === "OPENROUTER_CAPTURE_MODEL")!.modelName, "google/gemini-2.5-flash");
  assert.equal(items.find((i) => i.key === "OPENROUTER_CAPTURE_MODEL_STRONG")!.modelName, "anthropic/claude-sonnet-4.5");
}

// Channel posts are postponed exactly when the key or the fast model is missing (see normalization-notes).
assert.equal(getAiConfigStatus(FULL).channelNormalizationBlocked, false);
assert.equal(getAiConfigStatus({}).channelNormalizationBlocked, true);
assert.equal(getAiConfigStatus({ ...FULL, OPENROUTER_API_KEY: undefined }).channelNormalizationBlocked, true);
assert.equal(getAiConfigStatus({ ...FULL, OPENROUTER_CAPTURE_MODEL: undefined }).channelNormalizationBlocked, true);
assert.equal(getAiConfigStatus({ ...FULL, OPENROUTER_CAPTURE_MODEL_STRONG: undefined, OPENROUTER_MODEL: undefined }).channelNormalizationBlocked, false, "optional rows do not block");

// The warnings name the consequence an admin cares about.
{
  const notes = Object.fromEntries(getAiConfigStatus({}).items.map((i) => [i.key, i.note]));
  assert.match(notes.OPENROUTER_CAPTURE_MODEL, /посты каналов откладываются.*Capture не распознаёт скриншоты/);
  assert.match(notes.OPENROUTER_API_KEY, /все AI-функции выключены/);
  assert.match(notes.OPENROUTER_MODEL, new RegExp(DEFAULT_OPENROUTER_MODEL));
}

// ── The default model really is the one the callers use (no silent drift) ────
for (const file of ["src/lib/ai/enrichEvent.ts", "src/lib/ai/detectEventCategory.ts", "src/app/api/ai/rewrite/route.ts"]) {
  assert.ok(
    readFileSync(file, "utf8").includes(`process.env.OPENROUTER_MODEL?.trim() || "${DEFAULT_OPENROUTER_MODEL}"`),
    `${file} must default to ${DEFAULT_OPENROUTER_MODEL}`,
  );
}

// ── Admin only ───────────────────────────────────────────────────────────────
assert.equal(canSeeAiConfig({ role: "ADMIN" }), true);
for (const role of ["MODERATOR", "USER", "BUSINESS", "", null, undefined]) {
  assert.equal(canSeeAiConfig({ role }), false, String(role));
}
assert.equal(canSeeAiConfig(null), false);
assert.equal(canSeeAiConfig(undefined), false);
// The runs page gates the block with it.
const runsPage = readFileSync("src/app/admin/import/runs/page.tsx", "utf8");
assert.match(runsPage, /canSeeAiConfig\(await getCurrentUser\(\)\) \? getAiConfigStatus\(\) : null/);
assert.match(runsPage, /\{aiConfig && <AiConfigBlock status=\{aiConfig\} \/>\}/);

console.log("aiConfigStatus tests: OK");
