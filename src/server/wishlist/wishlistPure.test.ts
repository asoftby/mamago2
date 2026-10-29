import assert from "node:assert/strict";

import {
  archiveCutoff,
  sameDayNextYear,
  thanksSchema,
  SHARE_TOKEN_PATTERN,
  MAX_CLAIMS_PER_COOKIE,
  breakingItemChange,
  createItemSchema,
  createWishlistSchema,
  dateKeyToDate,
  generateShareToken,
  guestItemState,
  guestReserveSchema,
  parseClaimCookie,
  serializeClaimCookie,
  wishlistErrorStatus,
  summarizeItemForOwner,
  updateItemSchema,
  wishlistEnabled,
  wishlistScopeWhere,
  type ReservationRow,
} from "./wishlistPure";

// flag: off by default
assert.equal(wishlistEnabled({}), false);
assert.equal(wishlistEnabled({ WISHLIST_ENABLED: "0" }), false);
assert.equal(wishlistEnabled({ WISHLIST_ENABLED: "1" }), true);
assert.equal(wishlistEnabled({ WISHLIST_ENABLED: " TRUE " }), true);

// share token: 32 url-safe chars, unique
const tokens = new Set(Array.from({ length: 200 }, generateShareToken));
assert.equal(tokens.size, 200);
for (const t of tokens) assert.match(t, SHARE_TOKEN_PATTERN);

// ACL: family reads off or no family → owner only; on → family OR owner
assert.deepEqual(wishlistScopeWhere({ userId: "u", familyId: "f" }, false), { ownerUserId: "u" });
assert.deepEqual(wishlistScopeWhere({ userId: "u", familyId: null }, true), { ownerUserId: "u" });
assert.deepEqual(wishlistScopeWhere({ userId: "u", familyId: "f" }, true), {
  OR: [{ familyId: "f" }, { ownerUserId: "u" }],
});

// input: urls
assert.equal(createItemSchema.parse({ title: " Лего ", url: "https://21vek.by/x" }).url, "https://21vek.by/x");
assert.equal(createItemSchema.parse({ title: "Лего", url: "" }).url, null);
assert.equal(createItemSchema.parse({ title: "Лего" }).url, undefined);
assert.throws(() => createItemSchema.parse({ title: "Лего", url: "javascript:alert(1)" }));
assert.throws(() => createItemSchema.parse({ title: "Лего", url: "not a url" }));
assert.throws(() => createItemSchema.parse({ title: "  " }));
assert.throws(() => createItemSchema.parse({ title: "x", quantity: 0 }));
assert.throws(() => createItemSchema.parse({ title: "x", quantity: 100 }));
assert.throws(() => createItemSchema.parse({ title: "x", priceApprox: -1 }));
assert.equal(createItemSchema.parse({ title: "x" }).quantity, 1);
assert.equal(updateItemSchema.parse({}).title, undefined);

// input: wishlist
const w = createWishlistSchema.parse({ title: "ДР", recipientName: "  " });
assert.equal(w.recipientName, null);
assert.equal(w.visibility, "LINK");
assert.equal(w.occasion, "BIRTHDAY");
assert.throws(() => createWishlistSchema.parse({ title: "ДР", eventDate: "05.12.2026" }));
assert.equal(dateKeyToDate("2026-12-05")?.toISOString(), "2026-12-05T00:00:00.000Z");
assert.equal(dateKeyToDate(null), null);
assert.equal(dateKeyToDate(undefined), undefined);

// owner view
const res = (over: Partial<ReservationRow>): ReservationRow => ({
  id: "r",
  quantity: 1,
  status: "RESERVED",
  displayName: "Аня",
  contactEmail: null,
  telegramChatId: null,
  ...over,
});
assert.equal(summarizeItemForOwner(1, [], false).state, "FREE");
assert.equal(summarizeItemForOwner(1, [res({ status: "CANCELLED" }), res({ status: "ITEM_REMOVED" })], false).state, "FREE");
assert.equal(summarizeItemForOwner(2, [res({})], false).state, "PARTIAL");
assert.equal(summarizeItemForOwner(1, [res({})], false).state, "RESERVED");
assert.equal(summarizeItemForOwner(1, [res({ status: "PURCHASED" })], false).state, "PURCHASED");
const mixed = summarizeItemForOwner(2, [res({ id: "a", status: "PURCHASED" }), res({ id: "b" })], false);
assert.equal(mixed.state, "RESERVED");
assert.equal(mixed.reservations.length, 2);
assert.equal(summarizeItemForOwner(1, [res({ telegramChatId: "1" })], false).reservations[0].hasContact, true);
assert.equal(summarizeItemForOwner(1, [res({})], false).reservations[0].hasContact, false);

// surprise mode: owner learns only how many units are taken
const hidden = summarizeItemForOwner(2, [res({ status: "PURCHASED", quantity: 2 })], true);
assert.equal(hidden.state, "RESERVED", "no reserved-vs-purchased leak");
assert.equal(hidden.takenQuantity, 2);
assert.deepEqual(hidden.reservations, [], "no names in surprise mode");

// breaking changes
assert.equal(breakingItemChange({ url: "https://a", quantity: 2 }, { title: "x" } as never, 0), null);
assert.equal(breakingItemChange({ url: "https://a", quantity: 1 }, { url: "https://b" }, 0), null, "nothing reserved");
assert.equal(breakingItemChange({ url: "https://a", quantity: 1 }, { url: "https://b" }, 1), "url_changed");
assert.equal(breakingItemChange({ url: "https://a", quantity: 1 }, { url: "https://a" }, 1), null, "same url");
assert.equal(breakingItemChange({ url: null, quantity: 1 }, { url: null }, 1), null);
assert.equal(breakingItemChange({ url: null, quantity: 3 }, { quantity: 1 }, 2), "quantity_below_taken");
assert.equal(breakingItemChange({ url: null, quantity: 3 }, { quantity: 2 }, 2), null);

// guest helpers (PR 2)
{
  const raw = "a".repeat(64);
  assert.deepEqual(parseClaimCookie(`${raw},bad,${raw},${"b".repeat(64)}`), [raw, "b".repeat(64)], "dedupe, drop malformed");
  assert.deepEqual(parseClaimCookie(undefined), []);
  const many = Array.from({ length: 40 }, (_, i) => i.toString(16).padStart(64, "0"));
  assert.equal(parseClaimCookie(many.join(",")).length, MAX_CLAIMS_PER_COOKIE);
  assert.equal(serializeClaimCookie([raw, raw]), raw);
  assert.equal(guestItemState(2, 0), "FREE");
  assert.equal(guestItemState(2, 1), "PARTIAL");
  assert.equal(guestItemState(2, 2), "TAKEN");
  assert.equal(guestReserveSchema.parse({ displayName: " Аня " }).displayName, "Аня");
  assert.equal(guestReserveSchema.parse({ displayName: "Аня", contactEmail: "" }).contactEmail, null);
  assert.throws(() => guestReserveSchema.parse({ displayName: "  " }));
  assert.throws(() => guestReserveSchema.parse({ displayName: "A", contactEmail: "nope" }));
  assert.equal(wishlistErrorStatus("sold_out"), 409);
  assert.equal(wishlistErrorStatus("forbidden"), 403);
  assert.equal(wishlistErrorStatus("rate_limited"), 429);
}

// lifecycle (PR 6)
{
  assert.equal(sameDayNextYear("2026-11-03"), "2027-11-03");
  assert.equal(sameDayNextYear("2028-02-29"), "2029-03-01", "29 Feb rolls to 1 Mar");
  assert.equal(archiveCutoff(new Date("2026-11-10T15:30:00Z")).toISOString(), "2026-11-03T00:00:00.000Z");
  assert.equal(thanksSchema.parse({}).message, null);
  assert.equal(thanksSchema.parse({ message: "  Спасибо!  " }).message, "Спасибо!");
  assert.equal(thanksSchema.parse({ message: "" }).message, null);
  assert.throws(() => thanksSchema.parse({ message: "x".repeat(301) }));
}

console.log("wishlistPure ok");
