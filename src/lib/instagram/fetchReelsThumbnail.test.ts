import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeInstagramPageUrl,
  extractInstagramThumbnailUrlFromHtml,
  fetchReelsThumbnail,
} from "./fetchReelsThumbnail";

test("accepts only explicit HTTPS Instagram page hosts", () => {
  for (const value of [
    "https://instagram.com/p/abc/",
    "https://www.instagram.com/reel/abc/",
    "https://m.instagram.com/p/abc/",
  ]) {
    assert.equal(assertSafeInstagramPageUrl(value).toString(), value);
  }
});

test("rejects non-Instagram, private, non-HTTPS and credentialed targets", () => {
  for (const value of [
    "http://www.instagram.com/reel/abc/",
    "https://127.0.0.1/reel/abc/",
    "https://169.254.169.254/latest/meta-data/",
    "https://localhost/reel/abc/",
    "https://instagram.com.evil.example/reel/abc/",
    "https://evil.instagram.com/reel/abc/",
    "https://example.com/reel/abc/",
    "https://user:pass@www.instagram.com/reel/abc/",
  ]) {
    assert.throws(() => assertSafeInstagramPageUrl(value), { name: "Error" }, value);
  }
});

test("unsafe Reels URL fails closed before any remote fetch", async () => {
  assert.equal(await fetchReelsThumbnail("http://127.0.0.1/internal"), null);
  assert.equal(await fetchReelsThumbnail("https://169.254.169.254/latest/meta-data/"), null);
  assert.equal(await fetchReelsThumbnail("https://example.com/video"), null);
});

test("extracts Instagram thumbnail from supported HTML forms", () => {
  assert.equal(
    extractInstagramThumbnailUrlFromHtml(
      '<meta property="og:image" content="https://cdn.example/img.jpg?x=1&amp;y=2">',
    ),
    "https://cdn.example/img.jpg?x=1&y=2",
  );

  assert.equal(
    extractInstagramThumbnailUrlFromHtml(
      '<meta content="https://cdn.example/second.jpg" property="og:image">',
    ),
    "https://cdn.example/second.jpg",
  );

  assert.equal(
    extractInstagramThumbnailUrlFromHtml(
      '{"thumbnail_url":"https://cdn.example/thumb.jpg?x=1\\u0026y=2"}',
    ),
    "https://cdn.example/thumb.jpg?x=1&y=2",
  );
});
