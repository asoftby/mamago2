import assert from "node:assert/strict";
import test from "node:test";
import { serializeJsonLdForHtml } from "./serializeJsonLdForHtml";

test("prevents JSON-LD script-tag breakout while preserving parsed data", () => {
  const payload = {
    name: '</script><script>alert("xss")</script>',
    description: "A & B > C",
  };

  const serialized = serializeJsonLdForHtml(payload);

  assert.doesNotMatch(serialized, /<\/script/i);
  assert.doesNotMatch(serialized, /<script/i);
  assert.doesNotMatch(serialized, /[<>&]/);

  assert.deepEqual(JSON.parse(serialized), payload);
});

test("escapes line-separator characters safely", () => {
  const payload = { value: "before\u2028middle\u2029after" };
  const serialized = serializeJsonLdForHtml(payload);

  assert.equal(serialized.includes("\u2028"), false);
  assert.equal(serialized.includes("\u2029"), false);
  assert.match(serialized, /\\u2028/);
  assert.match(serialized, /\\u2029/);
  assert.deepEqual(JSON.parse(serialized), payload);
});
