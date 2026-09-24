import assert from "node:assert/strict";
import { canOptimizeWithNextImage } from "./nextImagePolicy";

for (const url of [
  "/api/media/foo.webp",
  "/uploads/foo.webp",
  "/images/foo.webp",
  "https://family.by/foo.webp",
  "https://images.unsplash.com/foo.jpg",
  "https://cdn.unsplash.com/foo.jpg",
  "https://lh3.googleusercontent.com/foo.webp",
]) {
  assert.equal(canOptimizeWithNextImage(url), true, `${url} should use Next/Image`);
}

for (const url of [
  "https://example.com/foo.jpg",
  "https://cdn.some-business.by/foo.webp",
  "http://family.by/foo.webp",
  "https://googleusercontent.com/foo.webp",
  "//example.com/foo.jpg",
]) {
  assert.equal(canOptimizeWithNextImage(url), false, `${url} should use the plain img fallback`);
}

console.log("next image policy tests: OK");
