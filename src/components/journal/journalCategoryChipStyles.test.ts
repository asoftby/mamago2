import assert from "node:assert/strict";
import test from "node:test";
import { JOURNAL_CHIP, JOURNAL_CHIP_THUMB } from "./journalCategoryChipStyles";

test("journal and home reuse the compact 40px navigation chip geometry", () => {
  assert.match(JOURNAL_CHIP, /\bh-10\b/);
  assert.match(JOURNAL_CHIP, /\btext-sm\b/);
  assert.match(JOURNAL_CHIP_THUMB, /\bsize-8\b/);
});
