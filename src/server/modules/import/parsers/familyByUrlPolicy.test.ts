import assert from "node:assert/strict";

import { assertSafeFamilyByImportUrl } from "./familyByUrlPolicy";

for (const value of [
  "https://family.by/afisha/",
  "https://www.family.by/afisha/2026/09/23/",
  "https://family.by/spravka/dosug/",
]) {
  assert.equal(assertSafeFamilyByImportUrl(value).hostname.replace(/^www\./u, ""), "family.by");
}

assert.equal(
  assertSafeFamilyByImportUrl("https://family.by/spravka/dosug/", {
    pathPrefix: "/spravka/",
  }).pathname,
  "/spravka/dosug/",
);

for (const value of [
  "http://family.by/afisha/",
  "http://127.0.0.1/?family.by",
  "http://169.254.169.254/latest/meta-data/?family.by",
  "https://family.by.evil.example/afisha/",
  "https://evil.example/family.by/afisha/",
  "https://user:pass@family.by/afisha/",
  "https://localhost/?family.by/spravka",
]) {
  assert.throws(() => assertSafeFamilyByImportUrl(value), { name: "Error" }, value);
}

assert.throws(
  () =>
    assertSafeFamilyByImportUrl("https://family.by/afisha/", {
      pathPrefix: "/spravka/",
    }),
  /spravka/,
);

console.log("family.by import URL policy tests: OK");
