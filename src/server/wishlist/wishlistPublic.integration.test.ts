/**
 * Wishlist guest side. Disposable local DB only:
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";

import { hashToken } from "@/lib/auth/tokenHash";

import {
  addWishlistItem,
  cancelReservationAsOwner,
  createWishlist,
  getWishlist,
  removeWishlistItem,
  updateWishlist,
} from "./wishlist.service";
import {
  getPublicItemImageUrl,
  getPublicWishlist,
  linkGuestReservations,
  reserveItem,
  updateOwnReservation,
} from "./wishlistPublic.service";
import { WishlistError, createItemSchema, createWishlistSchema } from "./wishlistPure";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at a disposable test database");
if (!["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Wishlist integration tests refuse non-local databases");
}

const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const userIds: string[] = [];
const env = { WISHLIST_ENABLED: "1" };
const deps = { db, env, notifyReserved: async () => {} };

async function makeUser(label: string): Promise<string> {
  const user = await db.user.create({ data: { email: `wlp-${run}-${label}@example.test` } });
  userIds.push(user.id);
  return user.id;
}

async function setup(opts: { quantity?: number; visibility?: "PRIVATE" | "LINK"; showNames?: boolean } = {}) {
  const owner = await makeUser(`o${Math.random()}`);
  const w = await createWishlist(
    owner,
    createWishlistSchema.parse({ title: "ДР", visibility: opts.visibility ?? "LINK", showReserverNamesToGuests: opts.showNames }),
    deps,
  );
  const withItem = await addWishlistItem(owner, w.id, createItemSchema.parse({ title: "Конструктор", quantity: opts.quantity ?? 1 }), deps);
  return { owner, token: w.shareToken, wishlistId: w.id, itemId: withItem.items[0].id };
}

const guest = (displayName = "Аня", extra: Record<string, unknown> = {}) => ({ displayName, ...extra });

after(async () => {
  await db.wishlist.deleteMany({ where: { ownerUserId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

test("guest reserves without account; second guest gets sold_out", async () => {
  const s = await setup();
  const a = await reserveItem(s.token, s.itemId, guest("Аня"), {}, deps);
  const stored = await db.wishlistReservation.findUniqueOrThrow({ where: { id: a.reservationId } });
  assert.equal(stored.claimTokenHash, hashToken(a.rawClaimToken));
  assert.notEqual(stored.claimTokenHash, a.rawClaimToken, "raw token is never stored");
  await assert.rejects(
    reserveItem(s.token, s.itemId, guest("Боря"), {}, deps),
    (e: unknown) => e instanceof WishlistError && e.code === "sold_out",
  );
});

test("concurrent reservations never exceed quantity", async () => {
  const s = await setup({ quantity: 3 });
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) => reserveItem(s.token, s.itemId, guest(`G${i}`), {}, deps)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
  const sum = await db.wishlistReservation.aggregate({ where: { itemId: s.itemId }, _sum: { quantity: true } });
  assert.equal(sum._sum.quantity, 3);
});

test("quantity larger than what is left is rejected", async () => {
  const s = await setup({ quantity: 2 });
  await reserveItem(s.token, s.itemId, guest("A"), {}, deps);
  await assert.rejects(
    reserveItem(s.token, s.itemId, guest("B", { quantity: 2 }), {}, deps),
    (e: unknown) => e instanceof WishlistError && e.code === "sold_out",
  );
});

test("email needs consent and stores consent version", async () => {
  const s = await setup({ quantity: 2 });
  await assert.rejects(
    reserveItem(s.token, s.itemId, guest("A", { contactEmail: "a@example.test" }), {}, deps),
    (e: unknown) => e instanceof WishlistError && e.code === "invalid_input",
  );
  const ok = await reserveItem(s.token, s.itemId, guest("A", { contactEmail: "a@example.test", consent: true }), {}, deps);
  const row = await db.wishlistReservation.findUniqueOrThrow({ where: { id: ok.reservationId } });
  assert.equal(row.contactEmail, "a@example.test");
  assert.ok(row.consentAt);
  assert.equal(row.consentTextVersion, "wl-v1");
});

test("PRIVATE, archived and unknown tokens", async () => {
  const priv = await setup({ visibility: "PRIVATE" });
  await assert.rejects(getPublicWishlist(priv.token, {}, deps), (e: unknown) => e instanceof WishlistError && e.code === "not_found");
  await assert.rejects(getPublicWishlist("x".repeat(32), {}, deps), (e: unknown) => e instanceof WishlistError && e.code === "not_found");
  await assert.rejects(getPublicWishlist("short", {}, deps), (e: unknown) => e instanceof WishlistError && e.code === "not_found");

  const arch = await setup();
  await db.wishlist.update({ where: { id: arch.wishlistId }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  const view = await getPublicWishlist(arch.token, {}, deps);
  assert.equal(view.archived, true);
  await assert.rejects(reserveItem(arch.token, arch.itemId, guest(), {}, deps), (e: unknown) => e instanceof WishlistError && e.code === "archived");
});

test("only the claim holder (or owning account) may cancel / mark purchased", async () => {
  const s = await setup();
  const a = await reserveItem(s.token, s.itemId, guest("Аня"), {}, deps);
  await assert.rejects(
    updateOwnReservation(s.token, a.reservationId, "cancel", { rawClaims: [] }, deps),
    (e: unknown) => e instanceof WishlistError && e.code === "forbidden",
  );
  await assert.rejects(
    updateOwnReservation(s.token, a.reservationId, "cancel", { rawClaims: ["f".repeat(64)] }, deps),
    (e: unknown) => e instanceof WishlistError && e.code === "forbidden",
  );
  await updateOwnReservation(s.token, a.reservationId, "purchased", { rawClaims: [a.rawClaimToken] }, deps);
  assert.equal((await db.wishlistReservation.findUniqueOrThrow({ where: { id: a.reservationId } })).status, "PURCHASED");
  await updateOwnReservation(s.token, a.reservationId, "cancel", { rawClaims: [a.rawClaimToken] }, deps);
  // freed: another guest can now take it
  await reserveItem(s.token, s.itemId, guest("Боря"), {}, deps);
});

test("a released reservation is never resurrected by purchased or cancel", async () => {
  const s = await setup();
  const a = await reserveItem(s.token, s.itemId, guest("Аня"), {}, deps);
  await db.wishlistReservation.update({ where: { id: a.reservationId }, data: { status: "ITEM_REMOVED" } });
  await assert.rejects(
    updateOwnReservation(s.token, a.reservationId, "purchased", { rawClaims: [a.rawClaimToken] }, deps),
    (e: unknown) => e instanceof WishlistError && e.code === "not_found",
  );
  await updateOwnReservation(s.token, a.reservationId, "cancel", { rawClaims: [a.rawClaimToken] }, deps);
  assert.equal(
    (await db.wishlistReservation.findUniqueOrThrow({ where: { id: a.reservationId } })).status,
    "ITEM_REMOVED",
    "author-side status is kept",
  );
});

test("reservation from another wishlist is not reachable through this token", async () => {
  const s1 = await setup();
  const s2 = await setup();
  const a = await reserveItem(s1.token, s1.itemId, guest(), {}, deps);
  await assert.rejects(
    updateOwnReservation(s2.token, a.reservationId, "cancel", { rawClaims: [a.rawClaimToken] }, deps),
    (e: unknown) => e instanceof WishlistError && e.code === "not_found",
  );
  await assert.rejects(reserveItem(s2.token, s1.itemId, guest("B"), {}, deps), (e: unknown) => e instanceof WishlistError && e.code === "not_found");
});

test("guest view hides names unless the author allows, and marks own reservations", async () => {
  const hidden = await setup({ quantity: 2 });
  const a = await reserveItem(hidden.token, hidden.itemId, guest("Аня"), {}, deps);
  const v1 = await getPublicWishlist(hidden.token, {}, deps);
  assert.equal(v1.items[0].reserverNames, null);
  assert.equal(v1.items[0].state, "PARTIAL");
  assert.equal(v1.items[0].availableQuantity, 1);
  assert.equal(v1.items[0].mine.length, 0);
  assert.ok(!JSON.stringify(v1).includes("Аня"), "no name leaks to other guests");
  const mine = await getPublicWishlist(hidden.token, { rawClaims: [a.rawClaimToken] }, deps);
  assert.equal(mine.items[0].mine.length, 1);

  const shown = await setup({ showNames: true });
  await reserveItem(shown.token, shown.itemId, guest("Аня"), {}, deps);
  const v2 = await getPublicWishlist(shown.token, {}, deps);
  assert.deepEqual(v2.items[0].reserverNames, ["Аня"]);
  assert.equal(v2.items[0].state, "TAKEN");
});

test("guest reservation is linked to the account after login, then works without the cookie", async () => {
  const s = await setup();
  const a = await reserveItem(s.token, s.itemId, guest(), {}, deps);
  const user = await makeUser("guest");
  const linked = await linkGuestReservations(user, [a.rawClaimToken], deps);
  assert.equal(linked, 1);
  assert.equal(await linkGuestReservations(user, [a.rawClaimToken], deps), 0, "idempotent");
  const view = await getPublicWishlist(s.token, { userId: user }, deps);
  assert.equal(view.items[0].mine.length, 1);
  await updateOwnReservation(s.token, a.reservationId, "cancel", { userId: user }, deps);
});

test("author releases a reservation; surprise mode keeps working", async () => {
  const s = await setup();
  const a = await reserveItem(s.token, s.itemId, guest(), {}, deps);
  await updateWishlist(s.owner, s.wishlistId, { hideReservationsFromOwner: true }, deps);
  const hidden = await getWishlist(s.owner, s.wishlistId, deps);
  assert.equal(hidden.items[0].takenQuantity, 1);
  assert.deepEqual(hidden.items[0].reservations, []);
  const after = await cancelReservationAsOwner(s.owner, s.wishlistId, a.reservationId, deps);
  assert.equal(after.items[0].takenQuantity, 0);
  const stranger = await makeUser("stranger");
  await assert.rejects(
    cancelReservationAsOwner(stranger, s.wishlistId, a.reservationId, deps),
    (e: unknown) => e instanceof WishlistError && e.code === "not_found",
  );
});

test("flag off: everything is disabled", async () => {
  await assert.rejects(
    getPublicWishlist("x".repeat(32), {}, { db, env: {} }),
    (e: unknown) => e instanceof WishlistError && e.code === "disabled",
  );
});

test("author is told about a reservation; a failing notifier does not break it", async () => {
  const s = await setup({ quantity: 2 });
  const seen: Array<{ wishlistId: string; displayName: string; itemId: string }> = [];
  const rec = { ...deps, notifyReserved: async (_db: unknown, input: { wishlistId: string; displayName: string; itemId: string }) => { seen.push(input); } };
  await reserveItem(s.token, s.itemId, guest("Аня"), {}, rec as never);
  assert.deepEqual(seen, [{ wishlistId: s.wishlistId, displayName: "Аня", itemId: s.itemId }]);

  const boom = { ...deps, notifyReserved: async () => { throw new Error("down"); } };
  const ok = await reserveItem(s.token, s.itemId, guest("Боря"), {}, boom as never);
  assert.ok(ok.reservationId);
});

test("guest sees a notice after the author removes the gift; others and old notices do not", async () => {
  const s = await setup();
  const a = await reserveItem(s.token, s.itemId, guest("Аня"), {}, deps);
  const other = await reserveItem(s.token, s.itemId, guest("Боря"), {}, deps).catch(() => null);
  assert.equal(other, null);
  await removeWishlistItem(s.owner, s.wishlistId, s.itemId, { confirmReserved: true }, { ...deps, notifyReleased: async () => {} } as never);

  const mine = await getPublicWishlist(s.token, { rawClaims: [a.rawClaimToken] }, deps);
  assert.equal(mine.notices.length, 1);
  assert.equal(mine.notices[0].itemTitle, "Конструктор");
  const stranger = await getPublicWishlist(s.token, { rawClaims: ["e".repeat(64)] }, deps);
  assert.deepEqual(stranger.notices, []);
  assert.deepEqual((await getPublicWishlist(s.token, {}, deps)).notices, []);

  await db.wishlistReservation.update({ where: { id: a.reservationId }, data: { updatedAt: new Date(Date.now() - 8 * 86_400_000) } });
  assert.deepEqual((await getPublicWishlist(s.token, { rawClaims: [a.rawClaimToken] }, deps)).notices, [], "notice expires after a week");
});

test("public view reports only the contact kind", async () => {
  const s = await setup({ quantity: 3 });
  const email = await reserveItem(s.token, s.itemId, guest("A", { contactEmail: "a@example.test", consent: true }), {}, deps);
  const tg = await reserveItem(s.token, s.itemId, guest("B"), {}, deps);
  await db.wishlistReservation.update({ where: { id: tg.reservationId }, data: { telegramChatId: "42" } });
  const view = await getPublicWishlist(s.token, { rawClaims: [email.rawClaimToken, tg.rawClaimToken] }, deps);
  const kinds = view.items[0].mine.map((m) => m.contact).sort();
  assert.deepEqual(kinds, ["email", "telegram"]);
  assert.ok(!JSON.stringify(view).includes("a@example.test"));
  assert.ok(!JSON.stringify(view).includes("42\""));
});

test("guest photo route: stored image only through a valid public token", async () => {
  const s = await setup();
  await db.wishlistItem.update({ where: { id: s.itemId }, data: { imageUrl: "/api/media/file/wl/pic42.webp" } });
  const view = await getPublicWishlist(s.token, {}, deps);
  assert.equal(view.items[0].imageSrc, `/api/w/${s.token}/items/${s.itemId}/image?v=pic42`);
  assert.equal(await getPublicItemImageUrl(s.token, s.itemId, deps), "/api/media/file/wl/pic42.webp");
  await assert.rejects(getPublicItemImageUrl("x".repeat(32), s.itemId, deps), (e: unknown) => e instanceof WishlistError && e.code === "not_found");
  const other = await setup();
  await assert.rejects(getPublicItemImageUrl(other.token, s.itemId, deps), (e: unknown) => e instanceof WishlistError && e.code === "not_found", "item of another list");
  const priv = await setup({ visibility: "PRIVATE" });
  await assert.rejects(getPublicItemImageUrl(priv.token, priv.itemId, deps), (e: unknown) => e instanceof WishlistError && e.code === "not_found");
});
