import type { Prisma, PrismaClient } from "@prisma/client";

import { generateRawToken, hashToken } from "@/lib/auth/tokenHash";
import { prisma as defaultPrisma } from "@/lib/prisma";

import { RELEASE_NOTICE_DAYS } from "./wishlistNotifyPure";
import {
  ACTIVE_RESERVATION_STATUSES,
  CONSENT_TEXT_VERSION,
  SHARE_TOKEN_PATTERN,
  WishlistError,
  dateToDateKey,
  guestItemState,
  wishlistEnabled,
  wishlistImageSrc,
  type GuestItemState,
  type GuestReserveInput,
} from "./wishlistPure";

/**
 * Wishlist guest side (PR 2): public view by share token, reservations without
 * an account. A guest is identified only by a claim token (raw value lives in
 * their cookie, only its SHA-256 is stored). Quantity is enforced under a row
 * lock on the item, so concurrent guests can never over-book.
 */

export type PublicDeps = {
  db?: PrismaClient;
  env?: Record<string, string | undefined>;
  /** Test seam: notice to the author after a reservation. */
  notifyReserved?: (db: PrismaClient, input: { wishlistId: string; displayName: string; itemId: string }) => Promise<void>;
};
type Ctx = { db: PrismaClient };

function ctx(deps: PublicDeps = {}): Ctx {
  if (!wishlistEnabled(deps.env ?? process.env)) throw new WishlistError("disabled");
  return { db: deps.db ?? (defaultPrisma as unknown as PrismaClient) };
}

export type GuestReservationView = {
  id: string;
  quantity: number;
  status: "RESERVED" | "PURCHASED";
  displayName: string;
  /** How the guest will hear about changes; null → only the banner on the next visit. */
  contact: "telegram" | "email" | null;
};

export type PublicNotice = { reservationId: string; itemTitle: string };

export type PublicItemView = {
  id: string;
  title: string;
  url: string | null;
  comment: string | null;
  priceApprox: number | null;
  currency: string;
  quantity: number;
  priority: "LOW" | "NORMAL" | "HIGH";
  /** Ready for <img>: stored photos go through the share-token image route. */
  imageSrc: string | null;
  state: GuestItemState;
  availableQuantity: number;
  /** Only when the author enabled showReserverNamesToGuests. */
  reserverNames: string[] | null;
  /** Reservations held by the current visitor (claim token or account). */
  mine: GuestReservationView[];
};

export type PublicWishlistView = {
  title: string;
  note: string | null;
  occasion: "BIRTHDAY" | "OTHER";
  eventDate: string | null;
  recipientLabel: string | null;
  archived: boolean;
  /** Reservations of this visitor that the author has released in the last days. */
  notices: PublicNotice[];
  items: PublicItemView[];
};

const ACTIVE = [...ACTIVE_RESERVATION_STATUSES];

async function loadPublic(db: PrismaClient | Prisma.TransactionClient, shareToken: string) {
  if (!SHARE_TOKEN_PATTERN.test(shareToken)) throw new WishlistError("not_found");
  const wishlist = await db.wishlist.findUnique({
    where: { shareToken },
    select: { id: true, status: true, visibility: true },
  });
  // PRIVATE lists answer exactly like a missing one: no oracle for tokens.
  if (!wishlist || wishlist.visibility === "PRIVATE") throw new WishlistError("not_found");
  return wishlist;
}

/**
 * Attach guest reservations (identified by claim tokens) to the account the
 * visitor has since logged into / registered. Idempotent, only touches rows
 * that have no user yet.
 */
export async function linkGuestReservations(
  userId: string,
  rawClaims: string[],
  deps?: PublicDeps,
): Promise<number> {
  if (rawClaims.length === 0) return 0;
  const c = ctx(deps);
  const res = await c.db.wishlistReservation.updateMany({
    where: { claimTokenHash: { in: rawClaims.map(hashToken) }, userId: null },
    data: { userId },
  });
  return res.count;
}

export async function getPublicWishlist(
  shareToken: string,
  viewer: { userId?: string | null; rawClaims?: string[] },
  deps?: PublicDeps,
): Promise<PublicWishlistView> {
  const c = ctx(deps);
  const head = await loadPublic(c.db, shareToken);
  const rawClaims = viewer.rawClaims ?? [];
  if (viewer.userId) await linkGuestReservations(viewer.userId, rawClaims, deps);

  const row = await c.db.wishlist.findUniqueOrThrow({
    where: { id: head.id },
    select: {
      title: true,
      note: true,
      occasion: true,
      eventDate: true,
      recipientName: true,
      showReserverNamesToGuests: true,
      recipientChild: { select: { name: true } },
      items: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          reservations: {
            where: { status: { in: ACTIVE } },
            select: {
              id: true,
              quantity: true,
              status: true,
              displayName: true,
              userId: true,
              claimTokenHash: true,
              contactEmail: true,
              telegramChatId: true,
            },
          },
        },
      },
    },
  });

  const claimHashes = new Set(rawClaims.map(hashToken));
  const owners: Prisma.WishlistReservationWhereInput[] = [];
  if (claimHashes.size > 0) owners.push({ claimTokenHash: { in: [...claimHashes] } });
  if (viewer.userId) owners.push({ userId: viewer.userId });
  const released =
    owners.length === 0
      ? []
      : await c.db.wishlistReservation.findMany({
          where: {
            status: "ITEM_REMOVED",
            updatedAt: { gte: new Date(Date.now() - RELEASE_NOTICE_DAYS * 86_400_000) },
            item: { wishlistId: head.id },
            OR: owners,
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true, item: { select: { title: true } } },
        });
  return {
    notices: released.map((r) => ({ reservationId: r.id, itemTitle: r.item.title })),
    title: row.title,
    note: row.note,
    occasion: row.occasion,
    eventDate: dateToDateKey(row.eventDate),
    recipientLabel: row.recipientChild?.name ?? row.recipientName ?? null,
    archived: head.status === "ARCHIVED",
    items: row.items.map((item) => {
      const taken = Math.min(
        item.quantity,
        item.reservations.reduce((sum, r) => sum + r.quantity, 0),
      );
      const mine = item.reservations.filter(
        (r) => claimHashes.has(r.claimTokenHash) || (viewer.userId && r.userId === viewer.userId),
      );
      return {
        id: item.id,
        title: item.title,
        url: item.url,
        comment: item.comment,
        priceApprox: item.priceApprox === null ? null : Number(item.priceApprox),
        currency: item.currency,
        quantity: item.quantity,
        priority: item.priority,
        imageSrc: wishlistImageSrc(item.imageUrl, `/api/w/${shareToken}/items/${item.id}/image`),
        state: guestItemState(item.quantity, taken),
        availableQuantity: Math.max(0, item.quantity - taken),
        reserverNames: row.showReserverNamesToGuests ? item.reservations.map((r) => r.displayName) : null,
        mine: mine.map((r) => ({
          id: r.id,
          quantity: r.quantity,
          status: r.status as "RESERVED" | "PURCHASED",
          displayName: r.displayName,
          contact: r.telegramChatId ? ("telegram" as const) : r.contactEmail ? ("email" as const) : null,
        })),
      };
    }),
  };
}

/** Stored photo of an item for the share-token image route. PRIVATE/unknown tokens answer not_found. */
export async function getPublicItemImageUrl(shareToken: string, itemId: string, deps?: PublicDeps): Promise<string | null> {
  const c = ctx(deps);
  const head = await loadPublic(c.db, shareToken);
  const item = await c.db.wishlistItem.findFirst({
    where: { id: itemId, wishlistId: head.id, deletedAt: null },
    select: { imageUrl: true },
  });
  if (!item) throw new WishlistError("not_found");
  return item.imageUrl;
}

export async function reserveItem(
  shareToken: string,
  itemId: string,
  input: GuestReserveInput,
  viewer: { userId?: string | null },
  deps?: PublicDeps,
): Promise<{ reservationId: string; rawClaimToken: string }> {
  const c = ctx(deps);
  const quantity = input.quantity ?? 1;
  const email = input.contactEmail || null;
  if (email && input.consent !== true) {
    throw new WishlistError("invalid_input", "Подтвердите согласие на уведомления или уберите email");
  }
  const rawClaimToken = generateRawToken();
  const now = new Date();

  let wishlistId = "";
  const reservation = await c.db.$transaction(async (tx) => {
    const wishlist = await loadPublic(tx, shareToken);
    wishlistId = wishlist.id;
    if (wishlist.status === "ARCHIVED") throw new WishlistError("archived", "Вишлист в архиве");
    const locked = await tx.$queryRaw<Array<{ id: string; quantity: number }>>`
      SELECT "id", "quantity" FROM "WishlistItem"
      WHERE "id" = ${itemId} AND "wishlistId" = ${wishlist.id} AND "deletedAt" IS NULL
      FOR UPDATE`;
    const item = locked[0];
    if (!item) throw new WishlistError("not_found");
    const agg = await tx.wishlistReservation.aggregate({
      where: { itemId: item.id, status: { in: ACTIVE } },
      _sum: { quantity: true },
    });
    const taken = agg._sum.quantity ?? 0;
    if (taken + quantity > item.quantity) {
      throw new WishlistError("sold_out", "Этот подарок уже забронировали", {
        availableQuantity: Math.max(0, item.quantity - taken),
      });
    }
    return tx.wishlistReservation.create({
      data: {
        itemId: item.id,
        quantity,
        userId: viewer.userId ?? null,
        displayName: input.displayName.trim(),
        contactEmail: email,
        claimTokenHash: hashToken(rawClaimToken),
        consentAt: email ? now : null,
        consentTextVersion: email ? CONSENT_TEXT_VERSION : null,
      },
      select: { id: true },
    });
  });
  try {
    const notify = deps?.notifyReserved ?? (await import("./wishlistNotify")).notifyAuthorReserved;
    await notify(c.db, { wishlistId, displayName: input.displayName.trim(), itemId });
  } catch (error) {
    console.error("[wishlist] author notice failed", error instanceof Error ? error.name : typeof error);
  }
  return { reservationId: reservation.id, rawClaimToken };
}

/**
 * Cancel or mark as purchased. Allowed only to the holder of the claim token or
 * to the registered account that owns the reservation.
 */
export async function updateOwnReservation(
  shareToken: string,
  reservationId: string,
  action: "cancel" | "purchased",
  viewer: { userId?: string | null; rawClaims?: string[] },
  deps?: PublicDeps,
): Promise<void> {
  const c = ctx(deps);
  const wishlist = await loadPublic(c.db, shareToken);
  if (wishlist.status === "ARCHIVED") throw new WishlistError("archived", "Вишлист в архиве");
  const reservation = await c.db.wishlistReservation.findFirst({
    where: { id: reservationId, item: { wishlistId: wishlist.id } },
    select: { id: true, status: true, userId: true, claimTokenHash: true },
  });
  if (!reservation) throw new WishlistError("not_found");
  const hashes = new Set((viewer.rawClaims ?? []).map(hashToken));
  const allowed = hashes.has(reservation.claimTokenHash) || (!!viewer.userId && reservation.userId === viewer.userId);
  if (!allowed) throw new WishlistError("forbidden", "Это не ваша бронь");

  // Transitions are conditional on the stored status, so a concurrent author release or
  // item edit (CANCELLED / ITEM_REMOVED) can never be overwritten by a stale read.
  if (action === "cancel") {
    if (reservation.status === "CANCELLED" || reservation.status === "ITEM_REMOVED") return;
    await c.db.wishlistReservation.updateMany({
      where: { id: reservation.id, status: { in: ["RESERVED", "PURCHASED"] } },
      data: { status: "CANCELLED" },
    });
    return;
  }
  if (reservation.status === "PURCHASED") return;
  if (reservation.status !== "RESERVED") throw new WishlistError("not_found");
  const moved = await c.db.wishlistReservation.updateMany({
    where: { id: reservation.id, status: "RESERVED" },
    data: { status: "PURCHASED" },
  });
  if (moved.count === 0) {
    const now = await c.db.wishlistReservation.findUnique({ where: { id: reservation.id }, select: { status: true } });
    if (now?.status !== "PURCHASED") throw new WishlistError("not_found");
  }
}
