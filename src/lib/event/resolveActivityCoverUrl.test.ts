import assert from "node:assert/strict";

import { resolveActivityCoverUrl } from "./resolveActivityCoverUrl";

function expectResolved(
  label: string,
  input: Parameters<typeof resolveActivityCoverUrl>[0],
  expected: string | null,
) {
  assert.equal(resolveActivityCoverUrl(input), expected, label);
}

expectResolved(
  "normalizes bare gallery filename",
  {
    coverImageId: null,
    coverImageUrl: null,
    images: [{ id: "img-1", url: "poster.webp" }],
  },
  "/api/media/poster.webp",
);

expectResolved(
  "uses media asset cuid when explicit cover is stored outside gallery rows",
  {
    coverImageId: "cmabcdefghijklmnopqrstuvwx",
    coverImageUrl: null,
    images: [],
  },
  "/api/media/cmabcdefghijklmnopqrstuvwx",
);

expectResolved(
  "keeps runtime media file route intact",
  {
    coverImageId: null,
    coverImageUrl: "/api/media/file/events/poster.webp",
    images: [],
  },
  "/api/media/file/events/poster.webp",
);

console.log("resolveActivityCoverUrl tests: OK");
