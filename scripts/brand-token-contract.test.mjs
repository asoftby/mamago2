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

test("family plan accents preserve independent light and dark colors", () => {
  const light = css.match(/:root\\s*\\{[^}]*--plan-family-accent:\\s*(#[\\da-fA-F]+);[^}]*--plan-accent:\\s*var\\(--plan-family-accent\\);/);
  const dark = css.match(/\\.dark\\s*\\{[^}]*--plan-family-accent:\\s*(#[\\da-fA-F]+);[^}]*--plan-accent:\\s*var\\(--plan-family-accent\\);/);
  assert.ok(light, "Light family accent must delegate to its dedicated token");
  assert.ok(dark, "Dark family accent must delegate to its dedicated token");
  assert.equal(light[1].toLowerCase(), "#e86a3a");
  assert.equal(dark[1].toLowerCase(), "#f07f52");
  assert.notEqual(light[1], dark[1]);
});
