import assert from "node:assert/strict";
import test from "node:test";
import { formatCardAge } from "./formatCardAge";

test("age display for bounded and adult-inclusive ranges", () => {
  assert.equal(formatCardAge(0, 1), "0–1 год");
  assert.equal(formatCardAge(1, 3), "1–3 года");
  assert.equal(formatCardAge(2, 5), "2–5 лет");
  assert.equal(formatCardAge(3, 16), "3–16 лет");
  assert.equal(formatCardAge(3, 18), "3+");
  assert.equal(formatCardAge(3, 99), "3+");
  assert.equal(formatCardAge(18, null), "18+");
  assert.equal(formatCardAge(2, null), "2+");
  assert.equal(formatCardAge(null, 16), undefined);
  assert.equal(formatCardAge(5, 3), undefined);
});
