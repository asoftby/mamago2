import assert from "node:assert/strict";
import { canonicalAliasDestination, decideMediaAliasRedirect, normalizeMediaAliasPath } from "./mediaUrlAlias";

assert.equal(normalizeMediaAliasPath("/api/media/file/old/photo.webp"), "old/photo.webp");
assert.equal(normalizeMediaAliasPath("/uploads/old/photo.webp"), "old/photo.webp");
assert.equal(normalizeMediaAliasPath("old/photo.webp"), "old/photo.webp");
assert.equal(normalizeMediaAliasPath("../secret"), null);
assert.equal(normalizeMediaAliasPath("old/../secret"), null);
assert.equal(normalizeMediaAliasPath("old\\..\\secret"), null);

const alias = {
  id: "alias-1",
  mediaId: "media-1",
  legacyPath: "old/photo.webp",
  reason: null,
  source: null,
  createdAt: new Date(),
  media: { publicUrl: "/api/media/file/current/photo.webp" },
} as Parameters<typeof canonicalAliasDestination>[0];
assert.equal(canonicalAliasDestination(alias), "/api/media/file/current/photo.webp");
assert.equal(canonicalAliasDestination({ ...alias, legacyPath: "current/photo.webp" }), null);
assert.deepEqual(decideMediaAliasRedirect({ alias, canServe: true, canonicalFileExists: true }), {
  status: 308,
  destination: "/api/media/file/current/photo.webp",
});
assert.deepEqual(decideMediaAliasRedirect({ alias, canServe: false, canonicalFileExists: true }), { status: 404 });
assert.deepEqual(decideMediaAliasRedirect({ alias, canServe: true, canonicalFileExists: false }), { status: 404 });
for (const legacyPath of ["old-1.webp", "old-2.webp", "old-3.webp"]) {
  assert.equal(canonicalAliasDestination({ ...alias, legacyPath }), "/api/media/file/current/photo.webp");
}
console.log("mediaUrlAlias.test.ts: OK");
