import assert from "node:assert/strict";
import test from "node:test";
import { JOURNAL_CHIP, JOURNAL_CHIP_THUMB } from "./journalCategoryChipStyles";
import { SECTION_NAV_CHIP_HEIGHT } from "@/components/ui/sectionChipStyles";

test("journal and home reuse 44px section navigation chip height", () => {
  assert.equal(SECTION_NAV_CHIP_HEIGHT, "h-11");
  assert.match(JOURNAL_CHIP, /\bh-11\b/);
  assert.match(JOURNAL_CHIP, /\btext-sm\b/);
  assert.match(JOURNAL_CHIP_THUMB, /\bsize-9\b/);
  assert.match(JOURNAL_CHIP, /\bpr-5\b/);
});
