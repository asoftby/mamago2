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
  getOwnerItemImageUrl,
  getWishlist,
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
const deps = { db, env };

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

test("link preview: an edit made while the preview was loading is never overwritten", async () => {
  const owner = await makeUser("prev-race");
  const w = await createWishlist(owner, wl(), deps);
  const added = await addWishlistItem(owner, w.id, item("shop.example.test", { url: "https://shop.example.test/p/9" }), deps);
  const itemId = added.items[0].id;
  // the author fixes the title and photo while the (slow) fetch is still running
  const slow = async () => {
    await updateWishlistItem(owner, w.id, itemId, { title: "Свой заголовок", imageUrl: "https://img.example.test/mine.jpg" }, deps);
    return { title: "Магазин: товар", imageUrl: "/api/media/file/shop.webp" };
  };
  const res = await refreshItemPreview(owner, w.id, itemId, { ...deps, fetchPreview: slow });
  assert.equal(res.preview, "unavailable");
  const row = await db.wishlistItem.findUniqueOrThrow({ where: { id: itemId } });
  assert.equal(row.title, "Свой заголовок");
  assert.equal(row.imageUrl, "https://img.example.test/mine.jpg");
});

test("stored photos are served through the wishlist route (ACL), external links stay as typed", async () => {
  const owner = await makeUser("img");
  const stranger = await makeUser("img-out");
  const w = await createWishlist(owner, wl(), deps);
  const added = await addWishlistItem(owner, w.id, item("Книга"), deps);
  // only the preview job can store such a path; the input schema rejects it
  await db.wishlistItem.update({ where: { id: added.items[0].id }, data: { imageUrl: "/api/media/file/wl/abc123.webp" } });
  assert.throws(() => item("Хак", { imageUrl: "/api/media/file/secret.webp" }), "internal paths are not accepted from the client");
  const view = (await getWishlist(owner, w.id, deps)).items[0];
  assert.equal(view.imageUrl, "/api/media/file/wl/abc123.webp", "raw value kept for editing");
  assert.equal(view.imageSrc, `/api/wishlists/${w.id}/items/${view.id}/image?v=abc123`);
  const ext = (await addWishlistItem(owner, w.id, item("Мяч", { imageUrl: "https://img.example.test/b.jpg" }), deps)).items.find((i) => i.title === "Мяч")!;
  assert.equal(ext.imageSrc, "https://img.example.test/b.jpg");
  assert.equal(await getOwnerItemImageUrl(owner, w.id, view.id, deps), "/api/media/file/wl/abc123.webp");
  await assert.rejects(getOwnerItemImageUrl(stranger, w.id, view.id, deps), (e) => e instanceof WishlistError && e.code === "not_found");
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
