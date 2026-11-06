import assert from "node:assert/strict";
import test from "node:test";
import { buildCollectionEventMedia } from "./collectionEventMedia";

test("collection event gallery orders cover, unique photos, and video last", () => {
  const items = buildCollectionEventMedia({
    title: "Спектакль", coverImageId: "cover", coverImageUrl: "/cover.jpg",
    images: [{ id: "cover", url: "/cover.jpg" }, { id: "one", url: "/one.jpg" }, { id: "dup", url: "/one.jpg" }, { id: "two", url: "/two.jpg" }],
    scheduleJson: { reelsUrl: "https://instagram.com/reel/abcdef123/" },
  });
  assert.deepEqual(items.map((x) => x.type), ["image", "image", "image", "instagram"]);
  assert.deepEqual(items.slice(0, 3).map((x) => x.type === "image" ? x.src : ""), ["/cover.jpg", "/one.jpg", "/two.jpg"]);
  assert.equal(items[3].type === "instagram" && items[3].title, "Reels");
});

test("post after images, empty gallery, unsupported link ignored", () => {
  const post = buildCollectionEventMedia({ title: "A", coverImageUrl: null, images: [{ id: "photo", url: "/photo.jpg" }], scheduleJson: { reelsUrl: "https://www.instagram.com/p/AbCdEfG/" } });
  assert.deepEqual(post.map((x) => x.type), ["image", "instagram"]);
  assert.equal(post[1].type === "instagram" && post[1].title, "Post");
  assert.deepEqual(buildCollectionEventMedia({ title: "A", coverImageUrl: null, scheduleJson: { reelsUrl: "javascript:alert(1)" } }), []);
});
