import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PRIVATE_MEDIA_CACHE_CONTROL,
  PUBLIC_MEDIA_CACHE_CONTROL,
  decideMediaResponsePolicy,
} from "./mediaResponsePolicy";

const publicAnonymous = decideMediaResponsePolicy({
  publiclyServable: true,
  authorizedToServe: true,
});
assert.deepEqual(publicAnonymous, {
  canServe: true,
  cacheControl: PUBLIC_MEDIA_CACHE_CONTROL,
});
assert.match(PUBLIC_MEDIA_CACHE_CONTROL, /public/);
assert.match(PUBLIC_MEDIA_CACHE_CONTROL, /immutable/);

const privateOwner = decideMediaResponsePolicy({
  publiclyServable: false,
  authorizedToServe: true,
});
assert.deepEqual(privateOwner, {
  canServe: true,
  cacheControl: PRIVATE_MEDIA_CACHE_CONTROL,
});
assert.equal(PRIVATE_MEDIA_CACHE_CONTROL, "private, no-store");

const unauthorized = decideMediaResponsePolicy({
  publiclyServable: false,
  authorizedToServe: false,
});
assert.deepEqual(unauthorized, { canServe: false });

// Staff moderation previews and owner/team previews share the same invariant:
// authorization may allow bytes, but it cannot make private media public.
const moderationPreview = decideMediaResponsePolicy({
  publiclyServable: false,
  authorizedToServe: true,
});
assert.equal(
  moderationPreview.canServe && moderationPreview.cacheControl,
  PRIVATE_MEDIA_CACHE_CONTROL,
);

// Published business media is public only after the canonical anonymous
// predicate has approved its status and published linkage.
const publishedBusinessMedia = decideMediaResponsePolicy({
  publiclyServable: true,
  authorizedToServe: true,
});
assert.equal(
  publishedBusinessMedia.canServe && publishedBusinessMedia.cacheControl,
  PUBLIC_MEDIA_CACHE_CONTROL,
);

const routeSources = [
  "src/app/api/media/[filename]/route.ts",
  "src/app/api/media/file/[...path]/route.ts",
].map((path) => readFileSync(resolve(process.cwd(), path), "utf8"));

for (const source of routeSources) {
  assert.match(source, /canLoadMediaAnonymously\(media\)/);
  assert.match(source, /decideMediaResponsePolicy\(/);
  assert.match(source, /"Cache-Control": responsePolicy\.cacheControl/);
  assert.doesNotMatch(
    source,
    /"Cache-Control":\s*"public, max-age=31536000, immutable"/,
    "media routes must not bypass the shared public/private response policy",
  );
  assert.ok(
    source.indexOf("if (!responsePolicy.canServe)") < source.indexOf("readFile("),
    "denied media must be rejected before file bytes are read",
  );
}

console.log("media response policy tests: OK");
