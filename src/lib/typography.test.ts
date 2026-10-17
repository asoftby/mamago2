import assert from "node:assert/strict";
import test from "node:test";
import { BRAND_FONTS, getBrandFontStack, normalizeBrandFont } from "./typography";

test("mamaGo has exactly three approved typography families", () => {
  assert.deepEqual(BRAND_FONTS, ["Google Sans", "PT Serif", "Menlo"]);
});

test("legacy fonts are ignored on read; approved font names remain unchanged", () => {
  for (const family of BRAND_FONTS) {
    assert.equal(normalizeBrandFont(family, "Google Sans"), family);
  }
  assert.equal(normalizeBrandFont("NTSomic", "Google Sans"), "Google Sans");
  assert.equal(normalizeBrandFont("Inter", "PT Serif"), "PT Serif");
  assert.equal(normalizeBrandFont(null, "Google Sans"), "Google Sans");
});

test("font stacks begin with the approved font and have system fallbacks", () => {
  assert.match(getBrandFontStack("Google Sans"), /^var\(--font-google-sans\)/);
  assert.match(getBrandFontStack("PT Serif"), /^var\(--font-pt-serif\)/);
  assert.match(getBrandFontStack("Menlo"), /^Menlo,/);
  assert.equal(getBrandFontStack("Roboto"), getBrandFontStack("Google Sans"));
});
