import assert from "node:assert/strict";

import { convertHeicFileToJpegIfNeeded, hasJpegSignature, isHeicFile } from "./heicConversion";

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


async function testJpegSignatureVerification() {
  assert.equal(
    await hasJpegSignature(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])])),
    true,
  );
  assert.equal(
    await hasJpegSignature(new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])])),
    false,
  );
}

async function testNonHeicFileIsReturnedUnchanged() {
  const original = file("photo.jpg", "image/jpeg");
  const result = await convertHeicFileToJpegIfNeeded(original);
  assert.equal(result, original);
}

async function main() {
  testDetectsByMimeType();
  testDetectsByExtensionWhenMimeTypeIsEmpty();
  await testJpegSignatureVerification();
  await testNonHeicFileIsReturnedUnchanged();
}

main().then(() => console.log("heicConversion tests: OK"));
