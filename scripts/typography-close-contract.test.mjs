import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("local font configuration uses real PT Serif and no legacy NT Somic", () => {
  const fonts = read("src/lib/fonts.ts");
  const layout = read("src/app/layout.tsx");
  assert.match(fonts, /PT_Serif-Web-Regular\.ttf/);
  assert.match(fonts, /PT_Serif-Web-Bold\.ttf/);
  assert.match(fonts, /PT_Serif-Web-Italic\.ttf/);
  assert.doesNotMatch(fonts, /SourceSerifPro|export const ntSomic/);
  assert.doesNotMatch(layout, /ntSomic|--font-ntsomic/);
});

test("UI Lab shows exactly the approved font specimens", () => {
  const section = read("src/app/(ui)/ui-lab/_sections/FoundationsSection.tsx");
  assert.match(section, /Google Sans/);
  assert.match(section, /PT Serif/);
  assert.match(section, /Menlo/);
  assert.doesNotMatch(section, /NT Somic/);
});

test("all core close-button surfaces use the same CloseIcon", () => {
  const glyph = read("src/components/ui/close-icon.tsx");
  const modal = read("src/components/ui/modal-close-button.tsx");
  const page = read("src/components/ui/page-close-button.tsx");
  const bottom = read("src/components/ui/bottom-sheet.tsx");
  const lab = read("src/app/(ui)/ui-lab/_sections/DesignSystemFoundationSection.tsx");
  assert.match(glyph, /strokeWidth=\{2\.5\}/);
  assert.match(modal, /<CloseIcon \/>/);
  assert.match(page, /<ModalCloseButton/);
  assert.match(bottom, /<ModalCloseButton/);
  assert.match(modal, /aria-label="Закрыть"/);
  assert.match(lab, /ModalCloseButton/);
});
