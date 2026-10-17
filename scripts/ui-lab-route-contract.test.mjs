import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("all legacy and unified lab routes are gated at the layout level", () => {
  const unified = read("src/app/(ui)/ui-lab/layout.tsx");
  const legacy = read("src/app/(ui)/ui-lab-admin/layout.tsx");
  assert.match(unified, /await requireUiLabAccess\(\)/);
  assert.match(legacy, /await requireUiLabAccess\(\)/);
  assert.match(unified, /force-dynamic/);
  assert.match(legacy, /force-dynamic/);
});

test("older entrypoints cannot serve their unprotected pages", () => {
  assert.match(read("src/app/(ui)/ui-lab-admin/page.tsx"), /redirect\("\/ui-lab\?tab=admin"\)/);
  assert.match(read("src/app/(ui)/ui-lab-admin/wizard/page.tsx"), /redirect\("\/ui-lab\/wizard"\)/);
  assert.doesNotMatch(read("src/app/(ui)/ui-lab/cards/page.tsx"), /NODE_ENV === "production"/);
});

test("no catalog variant is automatically approved", () => {
  const catalog = read("src/lib/ui-lab/catalog.ts");
  assert.match(catalog, /"review"/);
  assert.match(catalog, /"legacy"/);
  assert.doesNotMatch(catalog, /status:\s*"approved"/);
});

test("preview uses iframe (real responsive viewport) under gated layout", () => {
  const workbench = read("src/app/(ui)/ui-lab/_components/PreviewWorkbench.tsx");
  assert.match(workbench, /<iframe/);
  for (const width of [320, 375, 768, 1200]) assert.match(workbench, new RegExp("px: " + width));
  assert.match(read("src/app/(ui)/ui-lab/preview/page.tsx"), /PreviewCanvas/);
});
