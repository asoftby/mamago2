import assert from "node:assert/strict";

import { replaceUploadFilenameExtension } from "./uploadFilename";

assert.equal(replaceUploadFilenameExtension("photo.jpg", "image/webp"), "photo.webp");
assert.equal(replaceUploadFilenameExtension("IMG_1234.HEIC", "image/jpeg"), "IMG_1234.jpg");
assert.equal(replaceUploadFilenameExtension("cover.png", "image/avif"), "cover.avif");
assert.equal(replaceUploadFilenameExtension("no-extension", "image/webp"), "no-extension.webp");
assert.equal(replaceUploadFilenameExtension("photo.jpg", "application/octet-stream"), "photo.jpg");
assert.equal(replaceUploadFilenameExtension("photo.jpeg", "image/jpeg; charset=binary"), "photo.jpg");

console.log("uploadFilename tests: OK");
