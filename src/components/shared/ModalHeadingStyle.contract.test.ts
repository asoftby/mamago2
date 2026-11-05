import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MODAL_HEADING_STYLE } from "./ModalHeadingStyle";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("share and save modal headings use the same visual source of truth", () => {
  const share = read("./ShareModal.tsx");
  const save = read("../activity/SaveActivityHeader.tsx");
  assert.match(share, /<h2 style=\{\{ \.\.\.MODAL_HEADING_STYLE/);
  assert.match(save, /<h2 style=\{\{ \.\.\.MODAL_HEADING_STYLE/);
  assert.match(share, /Поделиться \{entityNoun\}/);
  assert.deepEqual({ size: MODAL_HEADING_STYLE.fontSize, lineHeight: MODAL_HEADING_STYLE.lineHeight, weight: MODAL_HEADING_STYLE.fontWeight }, { size: 30, lineHeight: 1.12, weight: 400 });
});
