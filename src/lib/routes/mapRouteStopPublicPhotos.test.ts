import assert from "node:assert/strict";

import { mapRouteStopPublicPhotos } from "./mapRouteStopPublicPhotos";

function testGalleryWinsAndKeepsOrder() {
  assert.deepEqual(
    mapRouteStopPublicPhotos({
      photoUrl: "/uploads/first.webp",
      images: [
        { url: "/uploads/b.webp", sortOrder: 1 },
        { url: "/uploads/a.webp", sortOrder: 0 },
        { url: "/uploads/c.webp", sortOrder: 2 },
      ],
    }),
    ["/uploads/a.webp", "/uploads/b.webp", "/uploads/c.webp"],
  );
}

function testLegacyPhotoUrlFallback() {
  assert.deepEqual(mapRouteStopPublicPhotos({ photoUrl: "/uploads/only.webp", images: [] }), [
    "/uploads/only.webp",
  ]);
  assert.deepEqual(mapRouteStopPublicPhotos({ photoUrl: "  /uploads/only.webp  " }), ["/uploads/only.webp"]);
}

function testEmpty() {
  assert.deepEqual(mapRouteStopPublicPhotos({ photoUrl: null, images: [] }), []);
  assert.deepEqual(mapRouteStopPublicPhotos({}), []);
}

function testDedupesDuplicateGalleryUrls() {
  assert.deepEqual(
    mapRouteStopPublicPhotos({
      photoUrl: "/uploads/a.webp",
      images: [
        { url: "/uploads/a.webp", sortOrder: 0 },
        { url: "/uploads/a.webp", sortOrder: 1 },
        { url: "/uploads/b.webp", sortOrder: 2 },
      ],
    }),
    ["/uploads/a.webp", "/uploads/b.webp"],
  );
}

function main() {
  testGalleryWinsAndKeepsOrder();
  testLegacyPhotoUrlFallback();
  testEmpty();
  testDedupesDuplicateGalleryUrls();
}

main();
console.log("mapRouteStopPublicPhotos tests: OK");
