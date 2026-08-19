import assert from "node:assert/strict";

import {
  buildNeutralImportedMediaIdentity,
  containsImportSourceLeak,
  importSourceLeakTokens,
} from "./importedMediaPrivacy";

const family = new URL("https://family.by/uploads/posts/2026-08/photo.jpg");
const another = new URL("https://events.example-source.com/images/a.png");

assert.deepEqual(importSourceLeakTokens(family), ["family.by", "family-by", "familyby"]);
assert.equal(containsImportSourceLeak("1787167756721-e7a7yp1dom-import-family-by.webp", family), true);
assert.equal(containsImportSourceLeak("Import: family.by", family), true);
assert.equal(containsImportSourceLeak("media.webp", family), false);

for (const sourceUrl of [family, another]) {
  const identity = buildNeutralImportedMediaIdentity(sourceUrl);
  const serialized = JSON.stringify(identity).toLowerCase();

  for (const token of importSourceLeakTokens(sourceUrl)) {
    assert.equal(
      serialized.includes(token),
      false,
      `public imported-media identity must not contain source token ${token}`,
    );
  }

  assert.equal(identity.seedFilename, "media.jpg");
  assert.equal(identity.originalName, "media.webp");
  assert.equal(identity.title, "Media");
}

console.log("imported media privacy tests: OK");
