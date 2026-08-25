import assert from "node:assert/strict";
import {
  canonicalAliasDestination,
  decideMediaAliasRedirect,
  mediaAliasRedirectResponse,
  normalizeMediaAliasPath,
} from "./mediaUrlAlias";

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

// External / host-qualified publicUrl must still yield a relative media path only.
assert.equal(
  canonicalAliasDestination({
    ...alias,
    media: { publicUrl: "https://evil.example/api/media/file/current/photo.webp" },
  } as typeof alias),
  "/api/media/file/current/photo.webp",
);
assert.equal(
  canonicalAliasDestination({
    ...alias,
    media: { publicUrl: "https://evil.example/not-media/photo.webp" },
  } as typeof alias),
  null,
);
assert.equal(
  canonicalAliasDestination({
    ...alias,
    media: { publicUrl: "//evil.example/api/media/file/current/photo.webp" },
  } as typeof alias),
  "/api/media/file/current/photo.webp",
);

assert.deepEqual(decideMediaAliasRedirect({ alias, canServe: true, canonicalFileExists: true }), {
  status: 308,
  destination: "/api/media/file/current/photo.webp",
});
assert.deepEqual(decideMediaAliasRedirect({ alias, canServe: false, canonicalFileExists: true }), { status: 404 });
assert.deepEqual(decideMediaAliasRedirect({ alias, canServe: true, canonicalFileExists: false }), { status: 404 });

for (const legacyPath of ["old-1.webp", "old-2.webp", "old-3.webp"]) {
  assert.equal(canonicalAliasDestination({ ...alias, legacyPath }), "/api/media/file/current/photo.webp");
}

const redirect = mediaAliasRedirectResponse("/api/media/file/current/photo.webp");
assert.equal(redirect.status, 308);
assert.equal(redirect.headers.get("Location"), "/api/media/file/current/photo.webp");
assert.equal(redirect.headers.get("Location")?.includes("0.0.0.0"), false);
assert.equal(redirect.headers.get("Location")?.includes("://"), false);
// Destination must not depend on any request host — helper takes only the path.
assert.throws(() => mediaAliasRedirectResponse("https://mamago.by/api/media/file/x.webp"), /non-relative/);
assert.throws(() => mediaAliasRedirectResponse("//evil/api/media/file/x.webp"), /non-relative/);
assert.throws(() => mediaAliasRedirectResponse("/other/path.webp"), /non-relative/);

console.log("mediaUrlAlias.test.ts: OK");
