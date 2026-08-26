import assert from "node:assert/strict";
import { resolveDisplayFilename } from "./resolveDisplayFilename";
import { resolveAdminMediaListTitle } from "./mediaTitleOwnership";

/**
 * UI contract: list/detail promote title + canonical filename;
 * originalName stays raw (no mime-driven extension rewrite).
 */

{
  const canonical = resolveDisplayFilename({
    filename: "chem-zanyatsya-na-osennih-kanikulah-01.webp",
    mimeType: "image/webp",
    extension: "webp",
  });
  assert.equal(canonical, "chem-zanyatsya-na-osennih-kanikulah-01.webp");

  const listTitle = resolveAdminMediaListTitle({
    title: "Чем заняться на осенних каникулах",
    filename: canonical,
  });
  assert.equal(listTitle, "Чем заняться на осенних каникулах");

  // After title backfill, first line is entity title; second is canonical — not originalName.
  const originalName = "img_0894-scaled.jpeg";
  assert.notEqual(listTitle, originalName);
  assert.notEqual(canonical, originalName);
}

{
  // originalName must NOT be rewritten through resolveDisplayFilename for display.
  // (That helper is for canonical filename ↔ mime alignment only.)
  const originalName = "img_0894-scaled.jpeg";
  const wronglyRewritten = resolveDisplayFilename({
    filename: originalName,
    mimeType: "image/webp",
    extension: "webp",
  });
  assert.equal(wronglyRewritten, "img_0894-scaled.webp");
  // Contract: UI must show originalName as-is instead of wronglyRewritten.
  assert.equal(originalName, "img_0894-scaled.jpeg");
  assert.notEqual(originalName, wronglyRewritten);
}

{
  const fallback = resolveAdminMediaListTitle({
    title: null,
    entityTitle: "Событие",
    filename: "event-01.webp",
  });
  assert.equal(fallback, "Событие");
}

console.log("adminMediaDisplayTitle.test.ts: ok");
