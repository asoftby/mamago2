import assert from "node:assert/strict";

import { convertHeicFileToJpegIfNeeded, isHeicFile } from "./heicConversion";

function file(name: string, type: string): File {
  return new File(["fake-bytes"], name, { type });
}

function testDetectsByMimeType() {
  assert.equal(isHeicFile(file("photo.heic", "image/heic")), true);
  assert.equal(isHeicFile(file("photo.heif", "image/heif")), true);
  assert.equal(isHeicFile(file("photo.jpg", "image/jpeg")), false);
  assert.equal(isHeicFile(file("photo.png", "image/png")), false);
}

function testDetectsByExtensionWhenMimeTypeIsEmpty() {
  // iPhones sometimes report an empty/generic MIME type for HEIC files.
  assert.equal(isHeicFile(file("IMG_1234.HEIC", "")), true);
  assert.equal(isHeicFile(file("IMG_1234.heif", "application/octet-stream")), true);
  assert.equal(isHeicFile(file("IMG_1234.jpg", "")), false);
}

async function testNonHeicFileIsReturnedUnchanged() {
  const original = file("photo.jpg", "image/jpeg");
  const result = await convertHeicFileToJpegIfNeeded(original);
  assert.equal(result, original);
}

async function main() {
  testDetectsByMimeType();
  testDetectsByExtensionWhenMimeTypeIsEmpty();
  await testNonHeicFileIsReturnedUnchanged();
}

main().then(() => console.log("heicConversion tests: OK"));
