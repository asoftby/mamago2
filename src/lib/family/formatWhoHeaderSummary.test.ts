import assert from "node:assert/strict";
import test from "node:test";
import { formatWhoHeaderSummary } from "./formatWhoHeaderSummary";

test("manual 18+ selection remains visible in global who summary", () => {
  const base = { hasSelectedChildren: false, selectedPersonaIds: [], personas: [], fallbackAgeValues: ["18+"] };
  assert.equal(formatWhoHeaderSummary(base), "#nokids");
  assert.equal(formatWhoHeaderSummary({ ...base, fallbackAgeValues: [] }), "Свободный поиск");
});
