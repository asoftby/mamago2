import assert from "node:assert/strict";
import {
  buildMasterFilename,
  buildMediaStem,
  buildResponsiveFilename,
  safeMediaStem,
  timestampMediaStem,
  buildEntityMediaFilename,
  canRenamePublishedMedia,
  canonicalOwnershipGate,
} from "@/lib/media/mediaNamingCore";

assert.equal(safeMediaStem("Kuda shodit / Minsk"), "kuda-shodit-minsk");
assert.equal(safeMediaStem("Куда сходить"), "kuda-skhodit");
assert.equal(
  buildMediaStem({ type: "ARTICLE", id: "a", title: "Article", slug: "kuda-shodit-s-rebenkom-v-minske", sequence: 1 }),
  "kuda-shodit-s-rebenkom-v-minske-01",
);
assert.equal(
  timestampMediaStem(new Date("2026-08-25T16:17:42.000Z"), "a8f3"),
  "20260825-161742-a8f3",
);

const stem = buildMediaStem({ type: "CONTEXTLESS", createdAt: new Date("2026-08-25T16:17:42.000Z"), unique: "a8f3" });
assert.equal(buildMasterFilename(stem), "20260825-161742-a8f3.webp");
assert.equal(buildResponsiveFilename(stem, "xl"), "20260825-161742-a8f3-xl.webp");
assert.equal(buildResponsiveFilename("article-slug-01", "lg"), "article-slug-01-lg.webp");
assert.equal(buildEntityMediaFilename({ entityType: "ARTICLE", slug: "article", title: "A", field: "cover", sequence: 1 }), "article-01.webp");
assert.equal(buildEntityMediaFilename({ entityType: "EVENT", slug: "event", title: "E", field: "cover", sequence: 2 }), "event-02.webp");
assert.equal(buildEntityMediaFilename({ entityType: "OFFER", slug: "offer", title: "O", field: "gallery", sequence: 3 }), "offer-03.webp");
assert.equal(buildEntityMediaFilename({ entityType: "PLACE", slug: "place", title: "P", field: "logo", sequence: 1 }), "place-logo.webp");
assert.equal(buildEntityMediaFilename({ entityType: "PLACE", slug: null, title: "Детский центр", field: "gallery", sequence: 2 }), "detskii-tsentr-02.webp");
assert.equal(buildEntityMediaFilename({ entityType: "ROUTE", slug: "family-route", title: "Route", field: "cover", sequence: 1 }), "family-route-01.webp");
assert.deepEqual([1, 2, 3].map((sequence) => buildEntityMediaFilename({ entityType: "ROUTE", slug: "family-route", title: "Route", field: sequence === 1 ? "cover" : "gallery", sequence })), ["family-route-01.webp", "family-route-02.webp", "family-route-03.webp"]);
assert.equal(buildEntityMediaFilename({ entityType: "ROUTE", slug: null, title: "Маршрут выходного дня", field: "cover", sequence: 1 }), "marshrut-vykhodnogo-dnya-01.webp");
assert.equal(canRenamePublishedMedia({ status: "PUBLISHED" }), false);
assert.equal(canRenamePublishedMedia({ status: "PUBLISHED", explicitMigration: true }), true);
assert.equal(canRenamePublishedMedia({ status: "DRAFT" }), true);
assert.equal(canonicalOwnershipGate({ branding: false, entityCount: 2 }), "skip-shared");
assert.equal(canonicalOwnershipGate({ branding: true, entityCount: 0 }), "skip-branding");
assert.equal(canonicalOwnershipGate({ branding: false, entityCount: 0 }), "skip-orphan");

console.log("mediaNaming.test.ts: OK");
