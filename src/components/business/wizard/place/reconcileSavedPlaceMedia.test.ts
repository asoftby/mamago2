import assert from "node:assert/strict";
import { getDefaultFormData } from "./defaults";
import { reconcileSavedPlaceMedia } from "./reconcileSavedPlaceMedia";

const current = {
  ...getDefaultFormData(),
  title: "Test place",
  logoImageId: "temp-logo",
  logoUrl: "/logo.webp",
  tempLogoMediaId: "temp-logo",
  tempGalleryMediaIds: ["temp-gallery"],
  images: [
    { id: "temp-logo", kind: "LOGO", url: "/logo.webp", width: null, height: null, blurhash: null, sortOrder: 0 },
    { id: "temp-gallery", kind: "GALLERY", url: "/gallery.webp", width: null, height: null, blurhash: null, sortOrder: 0 },
  ],
};
const persisted = {
  logoImageId: "place-logo",
  images: [
    { id: "place-logo", kind: "LOGO", url: "/logo.webp", width: null, height: null, blurhash: null, sortOrder: 0 },
    { id: "place-gallery", kind: "GALLERY", url: "/gallery.webp", width: null, height: null, blurhash: null, sortOrder: 0 },
  ],
};
const saved = reconcileSavedPlaceMedia(current, persisted);
assert.equal(saved.title, "Test place");
assert.equal(saved.logoImageId, "place-logo");
assert.equal(saved.logoUrl, "/logo.webp");
assert.deepEqual(saved.images.map((item) => item.id), ["place-logo", "place-gallery"]);
assert.equal(saved.tempLogoMediaId, null);
assert.deepEqual(saved.tempGalleryMediaIds, []);
assert.notEqual(saved.images, persisted.images, "draft data must not retain mutable response references");
assert.equal(reconcileSavedPlaceMedia(current, { logoImageId: null, images: [] }).logoUrl, null);
console.log("reconcileSavedPlaceMedia.test.ts: OK");
