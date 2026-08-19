import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

// Contract guards for the two public persistence boundaries. These assertions
// intentionally inspect source code so a future refactor cannot bypass the
// neutral identity helper and silently reintroduce source-derived URLs.
const mediaFromUrlRoute = readFileSync(
  join(process.cwd(), "src/app/api/media/from-url/route.ts"),
  "utf8",
);
assert.doesNotMatch(mediaFromUrlRoute, /sourceUrl\s*:\s*url\.toString\s*\(/);
assert.doesNotMatch(mediaFromUrlRoute, /import-\$\{url\.hostname/);
assert.doesNotMatch(mediaFromUrlRoute, /Import:\s*\$\{url\.hostname/);
assert.match(mediaFromUrlRoute, /buildNeutralImportedMediaIdentity\(url\)/);

const importPublishService = readFileSync(
  join(process.cwd(), "src/server/modules/import/services/import-publish.service.ts"),
  "utf8",
);
assert.doesNotMatch(
  importPublishService,
  /createData\.coverImageUrl\s*=\s*fields\.coverImageUrl/,
  "remote source cover URL must never be persisted directly on Activity create",
);
assert.match(
  importPublishService,
  /createData\.coverImageUrl\s*=\s*imgResult\.publicUrl/,
  "Activity create must persist only the locally ingested media URL",
);
assert.match(
  importPublishService,
  /delete candidateUpdatesRecord\.coverImageUrl/,
  "Activity update must remove the remote cover from the generic update set",
);
assert.match(
  importPublishService,
  /allowed as Record<string, unknown>\)\.coverImageUrl = imgResult\.publicUrl/,
  "Activity update must persist only the locally ingested media URL",
);

console.log("imported media privacy tests: OK");
