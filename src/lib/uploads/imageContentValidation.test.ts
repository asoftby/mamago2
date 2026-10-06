import assert from "node:assert/strict";
import { detectImageMimeType, validateImageContent, validateUploadFileContent } from "./imageContentValidation";

const fixtures: Array<[string, Buffer]> = [
  ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
  ["image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
  ["image/gif", Buffer.from("GIF89a")],
  ["image/webp", Buffer.from("RIFF0000WEBP")],
  ["image/avif", Buffer.from("0000ftypavif0000")],
  ["image/heic", Buffer.from("0000ftypheic0000")],
  ["image/heif", Buffer.from("0000ftypmif10000")],
];

for (const [mime, bytes] of fixtures) {
  const buffer = Buffer.from(bytes);
  if (["image/avif", "image/heic", "image/heif"].includes(mime)) buffer.writeUInt32BE(buffer.length, 0);
  assert.equal(detectImageMimeType(buffer), mime);
  assert.equal(validateImageContent(buffer, mime), mime);
  assert.equal(validateUploadFileContent(buffer, { name: `photo.${mime.split("/")[1]}`, type: mime }), mime);
}

const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const webp = Buffer.from("RIFF0000WEBP");
// Older or third-party clients may preserve the original filename after WebP conversion.
assert.equal(validateUploadFileContent(webp, { name: "photo.jpg", type: "image/webp" }), "image/webp");
assert.equal(validateUploadFileContent(webp, { name: "photo.png", type: "image/webp" }), "image/webp");
assert.throws(() => validateImageContent(svg, "image/jpeg"), /Unsupported image content/);
assert.throws(() => validateUploadFileContent(svg, { name: "photo.jpg", type: "image/jpeg" }), /Unsupported image content/);
assert.throws(() => validateUploadFileContent(svg, { name: "photo.jpg", type: "" }), /Unsupported image content/);
assert.throws(() => validateImageContent(Buffer.from([0xff, 0xd8, 0xff]), "image/png"), /mismatch/);
assert.throws(() => validateUploadFileContent(jpeg, { name: "photo.jpg", type: "image/png" }), /mismatch/);
assert.throws(() => validateImageContent(Buffer.from("not an image"), "image/jpeg"), /Unsupported image content/);
assert.throws(() => validateUploadFileContent(Buffer.from("not an image"), { name: "photo.jpg", type: "image/jpeg" }), /Unsupported image content/);
assert.equal(validateImageContent(Buffer.from([0xff, 0xd8, 0xff]), "image/jpg; charset=binary"), "image/jpeg");
