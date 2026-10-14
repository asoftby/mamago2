import assert from "node:assert/strict";
import { ensurePrimaryPlacements, shortDescriptionFromDescription } from "./mappers";

{
  // short description is derived from the primary description and stays within 120 chars
  const long = `<p>${"слово ".repeat(60)}</p>`;
  const short = shortDescriptionFromDescription(long);
  assert.ok(short.length <= 120 && short.length > 0);
  assert.equal(shortDescriptionFromDescription(null), "");
  assert.equal(shortDescriptionFromDescription("<p>Коротко</p>"), "Коротко");
  const exactly120 = "а".repeat(120);
  assert.equal(shortDescriptionFromDescription(exactly120), exactly120);
}

{
  // legacy offer saved without its primary placement gets it back; others are kept
  assert.deepEqual(ensurePrimaryPlacements(["CLASSES"], "CAMP"), ["CLASSES", "CAMPS"]);
  assert.deepEqual(ensurePrimaryPlacements(["CAMPS", "CLASSES"], "CAMP"), ["CAMPS", "CLASSES"]);
  assert.deepEqual(ensurePrimaryPlacements([], "REGULAR_ACTIVITY"), ["CLASSES"]);
}

console.log("descriptionPlacements contract tests passed");
