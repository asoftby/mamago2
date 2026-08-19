import assert from "node:assert/strict";

import { resolveWordPressAttachmentFileUrl } from "./resolveAttachmentFileUrl";

function testAttachedFilePresentBuildsUploadsUrlFromGuidOrigin() {
  const url = resolveWordPressAttachmentFileUrl({
    guid: "https://mamago.by/?attachment_id=5391",
    attached_file: "2023/07/6c616226f44eb482200f63155b374b75.webp",
  });
  assert.equal(url, "https://mamago.by/wp-content/uploads/2023/07/6c616226f44eb482200f63155b374b75.webp");
}

function testAttachedFilePresentEvenWhenGuidIsAPrettyPermalink() {
  // Real shape confirmed 2026-07-16: guid can be a pretty-permalink
  // attachment page, not `?attachment_id=N` — only the origin is used.
  const url = resolveWordPressAttachmentFileUrl({
    guid: "https://mamago.by/places/family-slub-fjemili-klub/2021-07-11-jpg/",
    attached_file: "2023/07/2021-07-11.webp",
  });
  assert.equal(url, "https://mamago.by/wp-content/uploads/2023/07/2021-07-11.webp");
}

function testFallsBackToGuidWhenAttachedFileMissing() {
  const url = resolveWordPressAttachmentFileUrl({
    guid: "https://wp.example.com/wp-content/uploads/2020/01/cover.jpg",
    attached_file: null,
  });
  assert.equal(url, "https://wp.example.com/wp-content/uploads/2020/01/cover.jpg");
}

function testFallsBackToGuidWhenAttachedFileIsEmptyString() {
  const url = resolveWordPressAttachmentFileUrl({
    guid: "https://wp.example.com/cover.jpg",
    attached_file: "",
  });
  assert.equal(url, "https://wp.example.com/cover.jpg");
}

function testFallsBackToGuidWhenAttachedFileIsWhitespaceOnly() {
  const url = resolveWordPressAttachmentFileUrl({
    guid: "https://wp.example.com/cover.jpg",
    attached_file: "   ",
  });
  assert.equal(url, "https://wp.example.com/cover.jpg");
}

function testFallsBackToRawGuidWhenGuidIsNotAParseableUrl() {
  const url = resolveWordPressAttachmentFileUrl({
    guid: "not-a-url",
    attached_file: "2023/07/file.webp",
  });
  assert.equal(url, "not-a-url", "can't derive an origin from an unparseable guid — best-effort fallback to guid verbatim");
}

function testNullWhenNeitherFieldUsable() {
  assert.equal(resolveWordPressAttachmentFileUrl({ guid: "", attached_file: null }), null);
  assert.equal(resolveWordPressAttachmentFileUrl({ guid: "   ", attached_file: "" }), null);
}

function main() {
  testAttachedFilePresentBuildsUploadsUrlFromGuidOrigin();
  testAttachedFilePresentEvenWhenGuidIsAPrettyPermalink();
  testFallsBackToGuidWhenAttachedFileMissing();
  testFallsBackToGuidWhenAttachedFileIsEmptyString();
  testFallsBackToGuidWhenAttachedFileIsWhitespaceOnly();
  testFallsBackToRawGuidWhenGuidIsNotAParseableUrl();
  testNullWhenNeitherFieldUsable();
}

main();
console.log("resolveWordPressAttachmentFileUrl tests: OK");
