import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function token(name) {
  const match = css.match(new RegExp("^\\s*--" + name + ":\\s*([^;]+);", "m"));
  assert.ok(match, `Missing brand token --${name}`);
  return match[1].trim();
}

test("brand interactions retain distinct hover and active states", () => {
  const base = token("brand");
  assert.notEqual(token("brand-hover"), base);
  assert.notEqual(token("brand-active"), base);
  assert.notEqual(token("brand-active"), token("brand-hover"));
});

test("primary tokens delegate to canonical brand tokens", () => {
  assert.equal(token("primary"), "var(--brand)");
  assert.equal(token("primary-hover"), "var(--brand-hover)");
  assert.equal(token("primary-active"), "var(--brand-active)");
});
