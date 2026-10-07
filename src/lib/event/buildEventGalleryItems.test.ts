import assert from "node:assert/strict";
import {
  buildEventPageDataFromPrismaActivity,
  buildGalleryItems,
  type ActivityForEventPageInput,
} from "./buildEventPageDataFromPrisma";

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

const pageData = buildEventPageDataFromPrismaActivity({
  id: "event-1",
  slug: "event-1",
  title: "Событие",
  shortDesc: "Короткое описание",
  description: null,
  format: "OFFLINE",
  ageTags: [],
  agePolicy: "UNKNOWN",
  priceText: null,
  priceFrom: null,
  currency: "BYN",
  priceDetails: null,
  scheduleJson: {
    priceDetails: "<p>Детали стоимости из расписания</p>",
    organizer: { name: "ООО Тест", unp: "123456789" },
  },
  coverImageUrl: null,
  images: [],
  sessions: [],
  place: null,
  venue: null,
  eventCategory: null,
  organizer: null,
} as unknown as ActivityForEventPageInput);

assert.equal(pageData.priceDetails, "<p>Детали стоимости из расписания</p>");
assert.deepEqual(pageData.organizer, { name: "ООО Тест", unp: "123456789" });

console.log("event gallery/page-data tests: OK");
