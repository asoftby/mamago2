import assert from "node:assert/strict";
import test from "node:test";
import { draft } from "./captureDraft.testkit";
import {
  buildCaptureEditUserParts,
  CAPTURE_EDIT_SYSTEM_PROMPT,
} from "./capturePrompt";

const context = {
  timeZone: "Europe/Minsk",
  anchorAt: new Date("2026-10-06T09:00:00.000Z"),
  anchorIsForward: true,
  children: [{ id: "child-1", name: "Тая", age: 12 }],
  planCandidates: [],
  placeShortlist: [],
  city: { slug: "minsk", cityId: null, source: "FALLBACK_MINSK" as const },
};

test("edit prompt keeps current draft trusted and instruction isolated as untrusted data", () => {
  const currentDraft = draft();
  const parts = buildCaptureEditUserParts({
    context,
    currentDraft,
    instruction: "перенеси на 19:00",
    now: new Date("2026-10-07T09:00:00.000Z"),
  });

  assert.equal(parts.length, 1);
  assert.equal(parts[0]!.type, "text");
  if (parts[0]!.type !== "text") throw new Error("expected text part");

  assert.match(parts[0].text, /CURRENT_DRAFT \(trusted backend state/);
  assert.match(parts[0].text, /Экскурсия в музей/);
  assert.match(parts[0].text, /EDIT_INSTRUCTION \(untrusted user data/);
  assert.match(parts[0].text, /<<<EDIT_START\nперенеси на 19:00\nEDIT_END>>>/);
});

test("edit system prompt requires full-draft preservation and stable intent", () => {
  assert.match(CAPTURE_EDIT_SYSTEM_PROMPT, /Preserve every existing field/);
  assert.match(CAPTURE_EDIT_SYSTEM_PROMPT, /intent must stay the same/);
  assert.match(CAPTURE_EDIT_SYSTEM_PROMPT, /Return the complete updated draft/);
});
