import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = [
  "src/server/modules/import/parsers/family-by-place.parser.ts",
  "src/server/modules/import/parsers/family-by-playcenter-place.parser.ts",
  "src/server/modules/import/parsers/family-by-afisha-event.parser.ts",
  "src/server/modules/import/parsers/family-by-directory-place.parser.ts",
];

for (const path of files) {
  const source = readFileSync(path, "utf8");
  assert.match(source, /assertSafeFamilyByImportUrl/, `${path} must use exact family.by URL policy`);
  assert.match(source, /validateUrl\s*:/, `${path} must revalidate every redirect hop`);
  assert.doesNotMatch(
    source,
    /\.includes\(["']family\.by(?:\/spravka)?["']\)/,
    `${path} must not use substring hostname validation`,
  );
}

console.log("family.by import SSRF wiring tests: OK");
