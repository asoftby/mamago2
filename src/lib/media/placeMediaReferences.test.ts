import assert from "node:assert/strict";
import { collectPlaceMediaReferenceInputs } from "./placeMediaReferences";

const refs = collectPlaceMediaReferenceInputs({
  logoImageId: "place-image-logo",
  images: [
    { id: "gallery-2", kind: "GALLERY", url: "/api/media/file/gallery-2.webp", sortOrder: 2 },
    { id: "place-image-logo", kind: "LOGO", url: "/api/media/file/logo.webp", sortOrder: 0 },
    { id: "gallery-1", kind: "GALLERY", url: "/api/media/file/gallery-1.webp", sortOrder: 1 },
  ],
});
assert.deepEqual(refs, [
  { field: "logo", reference: "/api/media/file/logo.webp", placeImageId: "place-image-logo", order: 0 },
  { field: "gallery", reference: "/api/media/file/gallery-1.webp", placeImageId: "gallery-1", order: 1 },
  { field: "gallery", reference: "/api/media/file/gallery-2.webp", placeImageId: "gallery-2", order: 2 },
]);

assert.deepEqual(collectPlaceMediaReferenceInputs({ logoImageId: "media-asset-id", images: [] }), [
  { field: "logo", reference: "media-asset-id", placeImageId: null, order: 0 },
]);
console.log("placeMediaReferences.test.ts: OK");
