import assert from "node:assert/strict";
import { buildGalleryItems, type ActivityForEventPageInput } from "./buildEventPageDataFromPrisma";

const activity = {
  title: "Событие",
  coverImageId: "cover",
  coverImageUrl: "/cover.jpg",
  scheduleJson: { reelsUrl: "https://youtube.com/shorts/abcDEF_123?si=test" },
  images: [
    { id: "cover", url: "/cover.jpg" },
    { id: "photo-1", url: "/one.jpg" },
    { id: "photo-2", url: "/two.jpg" },
  ],
} as unknown as ActivityForEventPageInput;

const items = buildGalleryItems(activity, "/cover.jpg");
assert.deepEqual(items?.map((item) => [item.type, item.id]), [
  ["image", "photo-1"],
  ["image", "photo-2"],
  ["youtube", "youtube-video"],
]);
assert.equal(items?.[2]?.type === "youtube" && items[2].posterSrc, "https://img.youtube.com/vi/abcDEF_123/hqdefault.jpg");

const broken = { ...activity, scheduleJson: { reelsUrl: "broken" } } as ActivityForEventPageInput;
assert.deepEqual(buildGalleryItems(broken, "/cover.jpg")?.map((item) => item.type), ["image", "image"]);

console.log("event gallery sequence tests: OK");
