import assert from "node:assert/strict";
import { KUDA_LISTING_PAGE_SIZE, listingPageHref, paginateKudaFeed } from "./kudaListingPagination";

assert.equal(KUDA_LISTING_PAGE_SIZE, 24);

const ids = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));
const partition = { primary: ids(30, "p"), secondary: ids(5, "s"), secondaryHeading: "Популярное у других семей" };

const p1 = paginateKudaFeed(partition, 1);
assert.equal(p1.total, 35);
assert.equal(p1.totalPages, 2);
assert.equal(p1.items.length, 24);
assert.equal(p1.offset, 1);
assert.ok(p1.items.every((item) => item.feedBucket === "primary"));

const p2 = paginateKudaFeed(partition, 2);
assert.equal(p2.items.length, 11);
assert.equal(p2.offset, 25);
assert.deepEqual(p2.items.map((i) => i.feedBucket), [...Array(6).fill("primary"), ...Array(5).fill("secondary")]);

// Pages concatenate to the exact feed order (no gaps, no duplicates).
const joined = [...p1.items, ...p2.items].map((i) => i.id);
assert.deepEqual(joined, [...partition.primary, ...partition.secondary].map((i) => i.id));

assert.equal(paginateKudaFeed(partition, 3).items.length, 0);
assert.equal(paginateKudaFeed(partition, 0).page, 1);
assert.equal(paginateKudaFeed({ primary: [], secondary: [], secondaryHeading: null }, 1).totalPages, 1);
assert.equal(paginateKudaFeed({ primary: ids(3, "p"), secondary: [], secondaryHeading: "x" }, 1).secondaryHeading, null);

assert.equal(listingPageHref("/minsk/events", "age=3-5&page=4", 1), "/minsk/events?age=3-5");
assert.equal(listingPageHref("/minsk/events", "age=3-5", 2), "/minsk/events?age=3-5&page=2");
assert.equal(listingPageHref("/minsk/events", "", 3), "/minsk/events?page=3");

console.log("Kuda listing pagination (24/page, stable order, buckets, hrefs): OK");
