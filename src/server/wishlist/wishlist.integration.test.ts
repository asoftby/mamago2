/**
 * Wishlist author side. Disposable local DB only:
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";

import {
  addWishlistItem,
  createWishlist,
  getWishlist,
  cancelReservationAsOwner,
  listWishlists,
  refreshItemPreview,
  removeWishlistItem,
  reorderWishlistItems,
  rotateShareToken,
  setWishlistArchived,
  updateWishlist,
  updateWishlistItem,
} from "./wishlist.service";
import { WishlistError, createItemSchema, createWishlistSchema } from "./wishlistPure";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at a disposable test database");
if (!["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Wishlist integration tests refuse non-local databases");
}

const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const userIds: string[] = [];
const env = { WISHLIST_ENABLED: "1", FAMILY_CORE_READS: "1" };
const deps = { db, env, notifyReleased: async () => {} };

async function makeUser(label: string): Promise<string> {
  const user = await db.user.create({ data: { email: `wl-${run}-${label}@example.test` } });
  userIds.push(user.id);
  return user.id;
}

async function joinFamily(userId: string, familyId: string) {
  await db.familyMembership.create({ data: { userId, familyId, role: "ADULT", historyAccess: "ALL" } });
}

const wl = (title = "ДР") => createWishlistSchema.parse({ title });
const item = (title: string, extra: Record<string, unknown> = {}) => createItemSchema.parse({ title, ...extra });

async function reserve(itemId: string, over: { quantity?: number; status?: "RESERVED" | "PURCHASED" } = {}) {
  return db.wishlistReservation.create({
    data: {
      itemId,
      quantity: over.quantity ?? 1,
      status: over.status ?? "RESERVED",
      displayName: "Аня",
      telegramChatId: "111",
      claimTokenHash: randomUUID(),
    },
  });
}

after(async () => {
  const families = await db.familyMembership.findMany({ where: { userId: { in: userIds } }, select: { familyId: true } });
  await db.wishlist.deleteMany({ where: { ownerUserId: { in: userIds } } });
  await db.child.deleteMany({ where: { parentId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.family.deleteMany({ where: { id: { in: families.map((f) => f.familyId) } } });
  await db.$disconnect();
});

test("flag off: every operation is refused", async () => {
  const owner = await makeUser("flag");
  await assert.rejects(
    () => createWishlist(owner, wl(), { db, env: {} }),
    (e: unknown) => e instanceof WishlistError && e.code === "disabled",
  );
});

test("create: family ensured, unique 32-char token, defaults", async () => {
  const owner = await makeUser("create");
  const a = await createWishlist(owner, wl("A"), deps);
  const b = await createWishlist(owner, wl("B"), deps);
  assert.equal(a.shareToken.length, 32);
  assert.notEqual(a.shareToken, b.shareToken);
  assert.equal(a.sharePath, `/w/${a.shareToken}`);
  assert.equal(a.visibility, "LINK");
  assert.equal(a.hideReservationsFromOwner, false);
  assert.equal(a.showReserverNamesToGuests, false);
  const row = await db.wishlist.findUniqueOrThrow({ where: { id: a.id } });
  assert.ok(row.familyId, "family created lazily");
});

test("recipient child must belong to the family; child name wins over free text", async () => {
  const owner = await makeUser("child");
  const stranger = await makeUser("stranger");
  const first = await createWishlist(owner, wl(), deps);
  const familyId = (await db.wishlist.findUniqueOrThrow({ where: { id: first.id } })).familyId!;
  const child = await db.child.create({ data: { name: "Степан", parentId: owner, familyId, createdById: owner } });
  const foreign = await db.child.create({ data: { name: "Чужой", parentId: stranger, createdById: stranger } });

  const ok = await createWishlist(
    owner,
    createWishlistSchema.parse({ title: "Для Степана", recipientChildId: child.id, recipientName: "ignored" }),
    deps,
  );
  assert.equal(ok.recipientLabel, "Степан");
  assert.equal(ok.recipientName, null);

  await assert.rejects(
    () => createWishlist(owner, createWishlistSchema.parse({ title: "x", recipientChildId: foreign.id }), deps),
    (e: unknown) => e instanceof WishlistError && e.code === "invalid_recipient",
  );

  const byChild = await listWishlists(owner, { recipientChildId: child.id }, deps);
  assert.deepEqual(byChild.map((w) => w.id), [ok.id]);
});

test("ACL: family members share lists, outsiders get not_found", async () => {
  const owner = await makeUser("acl-owner");
  const spouse = await makeUser("acl-spouse");
  const outsider = await makeUser("acl-outsider");
  const created = await createWishlist(owner, wl("Семейный"), deps);
  const familyId = (await db.wishlist.findUniqueOrThrow({ where: { id: created.id } })).familyId!;
  await joinFamily(spouse, familyId);

  const seen = await getWishlist(spouse, created.id, deps);
  assert.equal(seen.isOwner, false);
  await addWishlistItem(spouse, created.id, item("От супруга"), deps);
  assert.equal((await getWishlist(owner, created.id, deps)).items.length, 1);

  await assert.rejects(() => getWishlist(outsider, created.id, deps), (e: unknown) => e instanceof WishlistError && e.code === "not_found");
  await assert.rejects(
    () => addWishlistItem(outsider, created.id, item("x"), deps),
    (e: unknown) => e instanceof WishlistError && e.code === "not_found",
  );
  assert.deepEqual(await listWishlists(outsider, {}, deps), []);
});

test("items: ordered, reorder validates the full set, soft delete hides", async () => {
  const owner = await makeUser("items");
  const created = await createWishlist(owner, wl(), deps);
  await addWishlistItem(owner, created.id, item("Первый"), deps);
  await addWishlistItem(owner, created.id, item("Второй", { url: "https://21vek.by/a" }), deps);
  const view = await addWishlistItem(owner, created.id, item("Третий", { quantity: 3 }), deps);
  assert.deepEqual(view.items.map((i) => i.title), ["Первый", "Второй", "Третий"]);
  assert.equal(view.items[2].quantity, 3);

  const ids = view.items.map((i) => i.id);
  const reordered = await reorderWishlistItems(owner, created.id, [ids[2], ids[0], ids[1]], deps);
  assert.deepEqual(reordered.items.map((i) => i.title), ["Третий", "Первый", "Второй"]);

  await assert.rejects(
    () => reorderWishlistItems(owner, created.id, [ids[0], ids[1]], deps),
    (e: unknown) => e instanceof WishlistError && e.code === "invalid_input",
    "missing id",
  );
  await assert.rejects(
    () => reorderWishlistItems(owner, created.id, [ids[0], ids[1], "nope"], deps),
    (e: unknown) => e instanceof WishlistError && e.code === "invalid_input",
    "unknown id",
  );

  const removed = await removeWishlistItem(owner, created.id, ids[0], {}, deps);
  assert.equal(removed.items.length, 2);
  const row = await db.wishlistItem.findUniqueOrThrow({ where: { id: ids[0] } });
  assert.ok(row.deletedAt, "soft deleted, row kept");
  await assert.rejects(() => removeWishlistItem(owner, created.id, ids[0], {}, deps), (e: unknown) => e instanceof WishlistError && e.code === "not_found");
});

test("reserved item: cosmetic edit passes, breaking edit/removal needs confirmation", async () => {
  const owner = await makeUser("reserved");
  const created = await createWishlist(owner, wl(), deps);
  const view = await addWishlistItem(owner, created.id, item("Лего", { url: "https://21vek.by/lego", quantity: 2 }), deps);
  const itemId = view.items[0].id;
  const r1 = await reserve(itemId);

  // cosmetic
  const typo = await updateWishlistItem(owner, created.id, itemId, { title: "Лего Сити", comment: "красная коробка" }, deps);
  assert.equal(typo.items[0].title, "Лего Сити");
  assert.equal(typo.items[0].state, "PARTIAL");
  assert.equal((await db.wishlistReservation.findUniqueOrThrow({ where: { id: r1.id } })).status, "RESERVED");

  // different product: refused without confirmation, details carry names + contact flag
  await assert.rejects(
    () => updateWishlistItem(owner, created.id, itemId, { url: "https://21vek.by/other" }, deps),
    (e: unknown) =>
      e instanceof WishlistError &&
      e.code === "item_reserved" &&
      (e.details as { reservers: Array<{ displayName: string; hasContact: boolean }> }).reservers[0].displayName === "Аня" &&
      (e.details as { reservers: Array<{ hasContact: boolean }> }).reservers[0].hasContact === true,
  );
  assert.equal((await db.wishlistItem.findUniqueOrThrow({ where: { id: itemId } })).url, "https://21vek.by/lego", "unchanged");

  // removal refused, then confirmed → ITEM_REMOVED
  await assert.rejects(() => removeWishlistItem(owner, created.id, itemId, {}, deps), (e: unknown) => e instanceof WishlistError && e.code === "item_reserved");
  const after = await removeWishlistItem(owner, created.id, itemId, { confirmReserved: true }, deps);
  assert.equal(after.items.length, 0);
  assert.equal((await db.wishlistReservation.findUniqueOrThrow({ where: { id: r1.id } })).status, "ITEM_REMOVED");
});

test("confirmed URL replacement removes every reservation, even with simultaneous quantity change", async () => {
  const owner = await makeUser("url-replacement");
  const created = await createWishlist(owner, wl(), deps);
  const view = await addWishlistItem(owner, created.id, item("Old gift", {
    url: "https://21vek.by/old", quantity: 3,
  }), deps);
  const itemId = view.items[0].id;
  const reserved = await reserve(itemId, { status: "RESERVED", quantity: 1 });
  const purchased = await reserve(itemId, { status: "PURCHASED", quantity: 2 });
  await assert.rejects(
    () => updateWishlistItem(owner, created.id, itemId, {
      url: "https://21vek.by/new", quantity: 1,
    }, deps),
    (e: unknown) => e instanceof WishlistError && e.code === "item_reserved",
  );
  const updated = await updateWishlistItem(owner, created.id, itemId, {
    url: "https://21vek.by/new", quantity: 1, confirmReserved: true,
  }, deps);
  assert.equal(updated.items[0].url, "https://21vek.by/new");
  assert.equal(updated.items[0].quantity, 1);
  assert.equal(updated.items[0].state, "FREE");
  assert.equal(updated.items[0].takenQuantity, 0);
  const statuses = await db.wishlistReservation.findMany({
    where: { id: { in: [reserved.id, purchased.id] } },
    select: { status: true },
  });
  assert.deepEqual(statuses.map(r => r.status), ["ITEM_REMOVED", "ITEM_REMOVED"]);
});

test("quantity below taken: earliest reservations kept, newest dropped on confirm", async () => {
  const owner = await makeUser("qty");
  const created = await createWishlist(owner, wl(), deps);
  const view = await addWishlistItem(owner, created.id, item("Книги", { quantity: 3 }), deps);
  const itemId = view.items[0].id;
  const first = await reserve(itemId, { quantity: 2 });
  await new Promise((r) => setTimeout(r, 15));
  const second = await reserve(itemId, { quantity: 1 });

  await assert.rejects(
    () => updateWishlistItem(owner, created.id, itemId, { quantity: 2 }, deps),
    (e: unknown) => e instanceof WishlistError && e.code === "item_reserved",
  );
  await updateWishlistItem(owner, created.id, itemId, { quantity: 2, confirmReserved: true }, deps);
  assert.equal((await db.wishlistReservation.findUniqueOrThrow({ where: { id: first.id } })).status, "RESERVED");
  assert.equal((await db.wishlistReservation.findUniqueOrThrow({ where: { id: second.id } })).status, "ITEM_REMOVED");
  const v = await getWishlist(owner, created.id, deps);
  assert.equal(v.items[0].quantity, 2);
  assert.equal(v.items[0].state, "RESERVED");
});

test("surprise mode: owner sees no names and no statuses, conflict hides reservers", async () => {
  const owner = await makeUser("surprise");
  const created = await createWishlist(owner, createWishlistSchema.parse({ title: "Сюрприз", hideReservationsFromOwner: true }), deps);
  const view = await addWishlistItem(owner, created.id, item("Часы", { url: "https://a.by/1" }), deps);
  const itemId = view.items[0].id;
  await reserve(itemId, { status: "PURCHASED" });

  const v = await getWishlist(owner, created.id, deps);
  assert.equal(v.items[0].state, "RESERVED");
  assert.equal(v.items[0].takenQuantity, 1);
  assert.deepEqual(v.items[0].reservations, []);

  await assert.rejects(
    () => updateWishlistItem(owner, created.id, itemId, { url: "https://a.by/2" }, deps),
    (e: unknown) =>
      e instanceof WishlistError &&
      e.code === "item_reserved" &&
      (e.details as { reservers: unknown[]; reservedCount: number }).reservers.length === 0 &&
      (e.details as { reservedCount: number }).reservedCount === 1,
  );
});

test("rotate link: new token, old one gone, reservations kept", async () => {
  const owner = await makeUser("rotate");
  const created = await createWishlist(owner, wl(), deps);
  const view = await addWishlistItem(owner, created.id, item("X"), deps);
  const r = await reserve(view.items[0].id);
  const rotated = await rotateShareToken(owner, created.id, deps);
  assert.notEqual(rotated.shareToken, created.shareToken);
  assert.equal(await db.wishlist.count({ where: { shareToken: created.shareToken } }), 0);
  assert.equal((await db.wishlistReservation.findUniqueOrThrow({ where: { id: r.id } })).status, "RESERVED");
});

test("archive: blocks edits, restores, hides from default list", async () => {
  const owner = await makeUser("archive");
  const created = await createWishlist(owner, wl("Старый"), deps);
  await setWishlistArchived(owner, created.id, true, deps);
  assert.deepEqual(await listWishlists(owner, {}, deps), []);
  assert.equal((await listWishlists(owner, { includeArchived: true }, deps)).length, 1);
  await assert.rejects(() => addWishlistItem(owner, created.id, item("x"), deps), (e: unknown) => e instanceof WishlistError && e.code === "archived");
  await assert.rejects(() => updateWishlist(owner, created.id, { title: "y" }, deps), (e: unknown) => e instanceof WishlistError && e.code === "archived");
  const back = await setWishlistArchived(owner, created.id, false, deps);
  assert.equal(back.status, "ACTIVE");
  await addWishlistItem(owner, created.id, item("ok"), deps);
});

test("update wishlist: partial patch keeps untouched fields; date and visibility", async () => {
  const owner = await makeUser("update");
  const created = await createWishlist(owner, createWishlistSchema.parse({ title: "T", note: "n", eventDate: "2026-12-05" }), deps);
  assert.equal(created.eventDate, "2026-12-05");
  const patched = await updateWishlist(owner, created.id, { visibility: "PRIVATE", hideReservationsFromOwner: true }, deps);
  assert.equal(patched.title, "T");
  assert.equal(patched.note, "n");
  assert.equal(patched.eventDate, "2026-12-05");
  assert.equal(patched.visibility, "PRIVATE");
  const cleared = await updateWishlist(owner, created.id, { eventDate: null, note: null }, deps);
  assert.equal(cleared.eventDate, null);
  assert.equal(cleared.note, null);
});

test("db constraints: quantity range enforced", async () => {
  const owner = await makeUser("check");
  const created = await createWishlist(owner, wl(), deps);
  await assert.rejects(() => db.wishlistItem.create({ data: { wishlistId: created.id, title: "bad", quantity: 0 } }));
  await assert.rejects(() => db.wishlistItem.create({ data: { wishlistId: created.id, title: "bad", quantity: 100 } }));
});

test("link preview: fills photo and placeholder title, never touches link or reservations", async () => {
  const owner = await makeUser("prev");
  const w = await createWishlist(owner, wl(), deps);
  const added = await addWishlistItem(owner, w.id, item("shop.example.test", { url: "https://shop.example.test/p/1" }), deps);
  const itemId = added.items[0].id;
  const reservation = await reserve(itemId);
  const fetchPreview = async () => ({ title: "LEGO City 42", imageUrl: "/api/media/file/lego.webp" });

  const res = await refreshItemPreview(owner, w.id, itemId, { ...deps, fetchPreview });
  assert.equal(res.preview, "ok");
  const row = await db.wishlistItem.findUniqueOrThrow({ where: { id: itemId } });
  assert.equal(row.title, "LEGO City 42");
  assert.equal(row.imageUrl, "/api/media/file/lego.webp");
  assert.equal(row.url, "https://shop.example.test/p/1");
  assert.equal((await db.wishlistReservation.findUniqueOrThrow({ where: { id: reservation.id } })).status, "RESERVED");

  // a title the author typed himself is never overwritten
  await updateWishlistItem(owner, w.id, itemId, { title: "Мой выбор" }, deps);
  await refreshItemPreview(owner, w.id, itemId, { ...deps, fetchPreview });
  assert.equal((await db.wishlistItem.findUniqueOrThrow({ where: { id: itemId } })).title, "Мой выбор");
});

test("link preview: blocked shop, missing link, stale link and foreign user", async () => {
  const owner = await makeUser("prev2");
  const w = await createWishlist(owner, wl(), deps);
  const withUrl = (await addWishlistItem(owner, w.id, item("Книга", { url: "https://shop.example.test/b" }), deps)).items[0].id;
  const noUrl = (await addWishlistItem(owner, w.id, item("Без ссылки"), deps)).items[1].id;

  assert.equal((await refreshItemPreview(owner, w.id, withUrl, { ...deps, fetchPreview: async () => null })).preview, "unavailable");
  assert.equal((await refreshItemPreview(owner, w.id, noUrl, { ...deps, fetchPreview: async () => ({ title: "x", imageUrl: "/a" }) })).preview, "no_url");

  // the link changes while the page is being fetched: nothing is written
  const racing = async () => {
    await db.wishlistItem.update({ where: { id: withUrl }, data: { url: "https://shop.example.test/other" } });
    return { title: "Old product", imageUrl: "/old.webp" };
  };
  assert.equal((await refreshItemPreview(owner, w.id, withUrl, { ...deps, fetchPreview: racing })).preview, "unavailable");
  const row = await db.wishlistItem.findUniqueOrThrow({ where: { id: withUrl } });
  assert.equal(row.imageUrl, null);
  assert.equal(row.title, "Книга");

  const stranger = await makeUser("prev3");
  await assert.rejects(
    refreshItemPreview(stranger, w.id, withUrl, { ...deps, fetchPreview: async () => null }),
    (e: unknown) => e instanceof WishlistError && e.code === "not_found",
  );
});

test("author release notifies the affected guests with the right reason", async () => {
  const owner = await makeUser("notif");
  const w = await createWishlist(owner, wl(), deps);
  const calls: Array<{ id: string; reason: string }> = [];
  const rec = { ...deps, notifyReleased: async (_db: unknown, released: Array<{ reservationId: string; reason: string }>) => {
    calls.push(...released.map((r) => ({ id: r.reservationId, reason: r.reason })));
  } };

  // replaced link
  const a = (await addWishlistItem(owner, w.id, item("Книга", { url: "https://shop.example.test/a" }), deps)).items[0].id;
  const ra = await reserve(a);
  await updateWishlistItem(owner, w.id, a, { url: "https://shop.example.test/b", confirmReserved: true }, rec as never);
  assert.deepEqual(calls.splice(0), [{ id: ra.id, reason: "replaced" }]);

  // removed item
  const b = (await addWishlistItem(owner, w.id, item("Мяч"), deps)).items.find((i) => i.title === "Мяч")!.id;
  const rb = await reserve(b);
  await removeWishlistItem(owner, w.id, b, { confirmReserved: true }, rec as never);
  assert.deepEqual(calls.splice(0), [{ id: rb.id, reason: "removed" }]);

  // quantity cut: only the newest reservation is dropped and told
  const c = (await addWishlistItem(owner, w.id, item("Кубики", { quantity: 2 }), deps)).items.find((i) => i.title === "Кубики")!.id;
  const first = await reserve(c);
  const second = await reserve(c);
  await updateWishlistItem(owner, w.id, c, { quantity: 1, confirmReserved: true }, rec as never);
  assert.deepEqual(calls.splice(0), [{ id: second.id, reason: "quantity" }]);
  assert.equal((await db.wishlistReservation.findUniqueOrThrow({ where: { id: first.id } })).status, "RESERVED");

  // author releases one reservation: marked as author-side, guest is told
  const rc = await cancelReservationAsOwner(owner, w.id, first.id, rec as never);
  assert.ok(rc);
  assert.deepEqual(calls.splice(0), [{ id: first.id, reason: "released" }]);
  assert.equal((await db.wishlistReservation.findUniqueOrThrow({ where: { id: first.id } })).status, "ITEM_REMOVED");

  // a cosmetic edit tells nobody
  await updateWishlistItem(owner, w.id, a, { comment: "размер M" }, rec as never);
  assert.deepEqual(calls, []);
});

test("a failing notifier never fails the author's edit", async () => {
  const owner = await makeUser("notif2");
  const w = await createWishlist(owner, wl(), deps);
  const id = (await addWishlistItem(owner, w.id, item("Книга"), deps)).items[0].id;
  await reserve(id);
  const boom = { ...deps, notifyReleased: async () => { throw new Error("smtp down: secret@example.test"); } };
  const view = await removeWishlistItem(owner, w.id, id, { confirmReserved: true }, boom as never);
  assert.equal(view.items.length, 0);
});

const catalog: { countries: string[]; cities: string[]; places: string[]; offers: string[] } = {
  countries: [],
  cities: [],
  places: [],
  offers: [],
};
after(async () => {
  await db.offer.deleteMany({ where: { id: { in: catalog.offers } } });
  await db.place.deleteMany({ where: { id: { in: catalog.places } } });
  await db.city.deleteMany({ where: { id: { in: catalog.cities } } });
  await db.country.deleteMany({ where: { id: { in: catalog.countries } } });
});

test("catalog offer becomes a gift idea; unpublished or unknown offers are refused", async () => {
  const country = await db.country.create({ data: { name: `C ${run}`, slug: `c-${run}` } });
  const city = await db.city.create({ data: { name: `Town ${run}`, slug: `town-${run}`, countryId: country.id } });
  const placeCreator = await makeUser("placeowner");
  const place = await db.place.create({ data: { title: "Place", shortDesc: "x", createdByUserId: placeCreator, cityId: city.id, status: "PUBLISHED", slug: `p-${run}` } });
  const published = await db.offer.create({
    data: { title: "Мастер-класс", kind: "EVENT", status: "PUBLISHED", placeId: place.id, slug: `mk-${run}` },
  });
  const draft = await db.offer.create({
    data: { title: "Черновик", kind: "EVENT", status: "DRAFT", placeId: place.id, slug: `dr-${run}` },
  });
  catalog.countries.push(country.id);
  catalog.cities.push(city.id);
  catalog.places.push(place.id);
  catalog.offers.push(published.id, draft.id);

  const owner = await makeUser("offer");
  const w = await createWishlist(owner, wl(), deps);

  const view = await addWishlistItem(owner, w.id, item("Мастер-класс", { offerId: published.id }), deps);
  const row = await db.wishlistItem.findUniqueOrThrow({ where: { id: view.items[0].id } });
  assert.equal(row.offerId, published.id);
  assert.ok(row.url?.endsWith(`/town-${run}/offers/mk-${run}`), "the catalog page is the link");

  // an explicit link wins over the catalog page
  const own = await addWishlistItem(owner, w.id, item("Свой", { offerId: published.id, url: "https://shop.example.test/x" }), deps);
  assert.equal(own.items.find((i) => i.title === "Свой")!.url, "https://shop.example.test/x");

  for (const offerId of [draft.id, "no-such-offer"]) {
    await assert.rejects(
      addWishlistItem(owner, w.id, item("X", { offerId }), deps),
      (e: unknown) => e instanceof WishlistError && e.code === "invalid_input",
    );
  }
  assert.equal((await getWishlist(owner, w.id, deps)).items.length, 2, "refused offers add nothing");
});
