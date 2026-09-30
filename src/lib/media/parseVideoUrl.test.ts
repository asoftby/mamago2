import assert from "node:assert/strict";
import { parseVideoUrl } from "./parseVideoUrl";

const cases = [
  ["https://instagram.com/reel/ABC123/?igsh=x", "instagram", "ABC123"],
  ["https://www.instagram.com/p/POST_42/", "instagram", "POST_42"],
  ["https://youtube.com/watch?v=abcDEF_123&t=12", "youtube", "abcDEF_123"],
  ["https://youtu.be/abcDEF_123?si=hello", "youtube", "abcDEF_123"],
  ["https://youtube.com/shorts/abcDEF_123?si=hello", "youtube", "abcDEF_123"],
  ["https://www.youtube.com/embed/abcDEF_123?start=3", "youtube", "abcDEF_123"],
] as const;

for (const [url, type, embedId] of cases) {
  assert.deepEqual(parseVideoUrl(url), { type, url: new URL(url).toString(), embedId, label: type === "youtube" ? "YouTube" : url.includes("/p/") ? "Post" : "Reels" });
}
assert.equal(parseVideoUrl("https://vimeo.com/123456"), null);
assert.equal(parseVideoUrl("not a url"), null);
assert.equal(parseVideoUrl("https://instagram.com/stories/example/1"), null);

console.log("video URL parser tests: OK");
