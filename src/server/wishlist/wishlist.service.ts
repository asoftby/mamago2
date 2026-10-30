import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "@/lib/prisma";
import { ensureFamilyForUser } from "@/server/family/ensureFamily";
import { childScopeWhere, familyReadsEnabled } from "@/server/family/familyScope";

import {
  WishlistError,
  breakingItemChange,
  dateKeyToDate,
  dateToDateKey,
  generateShareToken,
  isActiveReservation,
  wishlistImageSrc,
  summarizeItemForOwner,
  wishlistEnabled,
  wishlistScopeWhere,
  type CreateItemInput,
  type CreateWishlistInput,
  type OwnerItemState,
  type OwnerReservationView,
  type UpdateItemInput,
  type UpdateWishlistInput,
} from "./wishlistPure";
import { isProvisionalTitle } from "./linkPreviewPure";

/**
 * Wishlist author side (PR 1): create/edit lists and items. Public page and
 * guest reservations arrive in PR 2; this module already keeps reservations
 * consistent when the author edits or removes a reserved item.
 */

export type WishlistDeps = {
  db?: PrismaClient;
  env?: Record<string, string | undefined>;
  /** Test seam for link previews; defaults to the real SSRF-safe fetcher. */
  fetchPreview?: (url: string, ownerUserId: string) => Promise<{ title: string | null; imageUrl: string | null } | null>;
};

type Ctx = { db: PrismaClient; env: Record<string, string | undefined> };

function ctx(deps: WishlistDeps = {}): Ctx {
  const env = deps.env ?? process.env;
  if (!wishlistEnabled(env)) throw new WishlistError("disabled");
  return { db: deps.db ?? (defaultPrisma as unknown as PrismaClient), env };
}

async function resolveScope(c: Ctx, userId: string) {
  const reads = familyReadsEnabled(c.env);
  if (!reads) return { userId, familyId: null as string | null, reads };
  const membership = await c.db.familyMembership.findFirst({
    where: { userId, leftAt: null },
    select: { familyId: true },
  });
  return { userId, familyId: membership?.familyId ?? null, reads };
}

async function scopeWhere(c: Ctx, userId: string): Promise<Prisma.WishlistWhereInput> {
  const scope = await resolveScope(c, userId);
  return wishlistScopeWhere(scope, scope.reads);
}

async function assertRecipientChild(c: Ctx, userId: string, childId: string | null | undefined) {
  if (!childId) return;
  const scope = await resolveScope(c, userId);
  const child = await c.db.child.findFirst({
    where: { id: childId, ...childScopeWhere(scope, scope.reads) },
    select: { id: true },
  });
  if (!child) throw new WishlistError("invalid_recipient", "Ребёнок не найден в вашей семье");
}

async function loadAccessible(c: Ctx, userId: string, wishlistId: string) {
  const wishlist = await c.db.wishlist.findFirst({
    where: { id: wishlistId, ...(await scopeWhere(c, userId)) },
    select: { id: true, status: true, hideReservationsFromOwner: true },
  });
  if (!wishlist) throw new WishlistError("not_found");
  return wishlist;
}

function assertEditable(wishlist: { status: string }) {
  if (wishlist.status === "ARCHIVED") throw new WishlistError("archived", "Вишлист в архиве");
}

// ─── Views ───────────────────────────────────────────────────────────────────

export type WishlistItemView = {
  id: string;
  sortOrder: number;
  title: string;
  url: string | null;
  comment: string | null;
  priceApprox: number | null;
  currency: string;
  quantity: number;
  priority: "LOW" | "NORMAL" | "HIGH";
  imageUrl: string | null;
  /** What to render in <img>: stored photos go through the image route. */
  imageSrc: string | null;
  state: OwnerItemState;
  takenQuantity: number;
  reservations: OwnerReservationView[];
};

export type WishlistView = {
  id: string;
  title: string;
  note: string | null;
  occasion: "BIRTHDAY" | "OTHER";
  eventDate: string | null;
  recipientChildId: string | null;
  recipientName: string | null;
  recipientLabel: string | null;
  visibility: "PRIVATE" | "LINK" | "PROFILE";
  hideReservationsFromOwner: boolean;
  showReserverNamesToGuests: boolean;
  status: "ACTIVE" | "ARCHIVED";
  shareToken: string;
  sharePath: string;
  isOwner: boolean;
  items: WishlistItemView[];
  createdAt: string;
  updatedAt: string;
};

export type WishlistSummary = Omit<WishlistView, "items" | "shareToken" | "sharePath"> & {
  itemCount: number;
  takenCount: number;
};

export function wishlistSharePath(shareToken: string): string {
  return `/w/${shareToken}`;
}

const reservationSelect = {
  id: true,
  quantity: true,
  status: true,
  displayName: true,
  contactEmail: true,
  telegramChatId: true,
} satisfies Prisma.WishlistReservationSelect;

const wishlistInclude = {
  recipientChild: { select: { name: true } },
  items: {
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { reservations: { select: reservationSelect } },
  },
} satisfies Prisma.WishlistInclude;

type WishlistWithItems = Prisma.WishlistGetPayload<{ include: typeof wishlistInclude }>;

function toView(row: WishlistWithItems, userId: string): WishlistView {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    occasion: row.occasion,
    eventDate: dateToDateKey(row.eventDate),
    recipientChildId: row.recipientChildId,
    recipientName: row.recipientName,
    recipientLabel: row.recipientChild?.name ?? row.recipientName ?? null,
    visibility: row.visibility,
    hideReservationsFromOwner: row.hideReservationsFromOwner,
    showReserverNamesToGuests: row.showReserverNamesToGuests,
    status: row.status,
    shareToken: row.shareToken,
    sharePath: wishlistSharePath(row.shareToken),
    isOwner: row.ownerUserId === userId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: row.items.map((item) => {
      const summary = summarizeItemForOwner(item.quantity, item.reservations, row.hideReservationsFromOwner);
      return {
        id: item.id,
        sortOrder: item.sortOrder,
        title: item.title,
        url: item.url,
        comment: item.comment,
        priceApprox: item.priceApprox === null ? null : Number(item.priceApprox),
        currency: item.currency,
        quantity: item.quantity,
        priority: item.priority,
        imageUrl: item.imageUrl,
        imageSrc: wishlistImageSrc(item.imageUrl, `/api/wishlists/${row.id}/items/${item.id}/image`),
        state: summary.state,
        takenQuantity: summary.takenQuantity,
        reservations: summary.reservations,
      };
    }),
  };
}

// ─── Wishlists ───────────────────────────────────────────────────────────────

export async function listWishlists(
  userId: string,
  opts: { includeArchived?: boolean; recipientChildId?: string } = {},
  deps?: WishlistDeps,
): Promise<WishlistSummary[]> {
  const c = ctx(deps);
  const rows = await c.db.wishlist.findMany({
    where: {
      ...(await scopeWhere(c, userId)),
      ...(opts.includeArchived ? {} : { status: "ACTIVE" }),
      ...(opts.recipientChildId ? { recipientChildId: opts.recipientChildId } : {}),
    },
    orderBy: [{ status: "asc" }, { eventDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: wishlistInclude,
  });
  return rows.map((row) => {
    const { items, shareToken: _t, sharePath: _p, ...rest } = toView(row, userId);
    void _t;
    void _p;
    return {
      ...rest,
      itemCount: items.length,
      takenCount: items.filter((i) => i.state === "RESERVED" || i.state === "PURCHASED").length,
    };
  });
}

export async function getWishlist(userId: string, wishlistId: string, deps?: WishlistDeps): Promise<WishlistView> {
  const c = ctx(deps);
  const row = await c.db.wishlist.findFirst({
    where: { id: wishlistId, ...(await scopeWhere(c, userId)) },
    include: wishlistInclude,
  });
  if (!row) throw new WishlistError("not_found");
  return toView(row, userId);
}

export async function createWishlist(
  userId: string,
  input: CreateWishlistInput,
  deps?: WishlistDeps,
): Promise<WishlistView> {
  const c = ctx(deps);
  await assertRecipientChild(c, userId, input.recipientChildId);
  const familyId = await ensureFamilyForUser(c.db, userId);
  const created = await c.db.wishlist.create({
    data: {
      ownerUserId: userId,
      familyId,
      title: input.title,
      note: input.note ?? null,
      recipientChildId: input.recipientChildId ?? null,
      // A child recipient carries its own name; free-text name is for adults.
      recipientName: input.recipientChildId ? null : input.recipientName ?? null,
      occasion: input.occasion,
      eventDate: dateKeyToDate(input.eventDate) ?? null,
      visibility: input.visibility,
      hideReservationsFromOwner: input.hideReservationsFromOwner ?? false,
      showReserverNamesToGuests: input.showReserverNamesToGuests ?? false,
      shareToken: generateShareToken(),
    },
    select: { id: true },
  });
  return getWishlist(userId, created.id, { db: c.db, env: c.env });
}

export async function updateWishlist(
  userId: string,
  wishlistId: string,
  input: UpdateWishlistInput,
  deps?: WishlistDeps,
): Promise<WishlistView> {
  const c = ctx(deps);
  const wishlist = await loadAccessible(c, userId, wishlistId);
  assertEditable(wishlist);
  if (input.recipientChildId) await assertRecipientChild(c, userId, input.recipientChildId);
  const data: Prisma.WishlistUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.note !== undefined) data.note = input.note;
  if (input.occasion !== undefined) data.occasion = input.occasion;
  if (input.eventDate !== undefined) data.eventDate = dateKeyToDate(input.eventDate);
  if (input.visibility !== undefined) data.visibility = input.visibility;
  if (input.hideReservationsFromOwner !== undefined) data.hideReservationsFromOwner = input.hideReservationsFromOwner;
  if (input.showReserverNamesToGuests !== undefined) data.showReserverNamesToGuests = input.showReserverNamesToGuests;
  if (input.recipientChildId !== undefined) {
    data.recipientChild = input.recipientChildId
      ? { connect: { id: input.recipientChildId } }
      : { disconnect: true };
    if (input.recipientChildId) data.recipientName = null;
  }
  if (input.recipientName !== undefined && !input.recipientChildId) data.recipientName = input.recipientName;
  await c.db.wishlist.update({ where: { id: wishlist.id }, data });
  return getWishlist(userId, wishlist.id, { db: c.db, env: c.env });
}

/** New link; the old /w/{token} stops working immediately. Reservations stay. */
export async function rotateShareToken(userId: string, wishlistId: string, deps?: WishlistDeps): Promise<WishlistView> {
  const c = ctx(deps);
  const wishlist = await loadAccessible(c, userId, wishlistId);
  await c.db.wishlist.update({ where: { id: wishlist.id }, data: { shareToken: generateShareToken() } });
  return getWishlist(userId, wishlist.id, { db: c.db, env: c.env });
}

export async function setWishlistArchived(
  userId: string,
  wishlistId: string,
  archived: boolean,
  deps?: WishlistDeps,
): Promise<WishlistView> {
  const c = ctx(deps);
  const wishlist = await loadAccessible(c, userId, wishlistId);
  await c.db.wishlist.update({
    where: { id: wishlist.id },
    data: archived ? { status: "ARCHIVED", archivedAt: new Date() } : { status: "ACTIVE", archivedAt: null },
  });
  return getWishlist(userId, wishlist.id, { db: c.db, env: c.env });
}

/** Stored photo of an item for the owner image route (ACL by account/family). */
export async function getOwnerItemImageUrl(
  userId: string,
  wishlistId: string,
  itemId: string,
  deps?: WishlistDeps,
): Promise<string | null> {
  const c = ctx(deps);
  const wishlist = await loadAccessible(c, userId, wishlistId);
  const item = await c.db.wishlistItem.findFirst({
    where: { id: itemId, wishlistId: wishlist.id, deletedAt: null },
    select: { imageUrl: true },
  });
  if (!item) throw new WishlistError("not_found");
  return item.imageUrl;
}

// ─── Items ───────────────────────────────────────────────────────────────────

export async function addWishlistItem(
  userId: string,
  wishlistId: string,
  input: CreateItemInput,
  deps?: WishlistDeps,
): Promise<WishlistView> {
  const c = ctx(deps);
  const wishlist = await loadAccessible(c, userId, wishlistId);
  assertEditable(wishlist);
  const last = await c.db.wishlistItem.findFirst({
    where: { wishlistId: wishlist.id, deletedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await c.db.wishlistItem.create({
    data: {
      wishlistId: wishlist.id,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      title: input.title,
      url: input.url ?? null,
      comment: input.comment ?? null,
      priceApprox: input.priceApprox ?? null,
      quantity: input.quantity,
      priority: input.priority,
      imageUrl: input.imageUrl ?? null,
    },
  });
  await touch(c, wishlist.id);
  return getWishlist(userId, wishlist.id, { db: c.db, env: c.env });
}

type LockedItem = { id: string; url: string | null; quantity: number };

async function lockItem(tx: Prisma.TransactionClient, wishlistId: string, itemId: string): Promise<LockedItem> {
  const rows = await tx.$queryRaw<LockedItem[]>`
    SELECT "id", "url", "quantity" FROM "WishlistItem"
    WHERE "id" = ${itemId} AND "wishlistId" = ${wishlistId} AND "deletedAt" IS NULL
    FOR UPDATE`;
  const item = rows[0];
  if (!item) throw new WishlistError("not_found");
  return item;
}

function reservedConflict(
  reason: string,
  reservations: Array<{ displayName: string; contactEmail: string | null; telegramChatId: string | null }>,
  hideNames: boolean,
): WishlistError {
  return new WishlistError("item_reserved", "Подарок уже забронирован", {
    reason,
    // Surprise mode: the owner confirms without learning who reserved.
    reservers: hideNames
      ? []
      : reservations.map((r) => ({ displayName: r.displayName, hasContact: Boolean(r.contactEmail || r.telegramChatId) })),
    reservedCount: reservations.length,
  });
}

export async function updateWishlistItem(
  userId: string,
  wishlistId: string,
  itemId: string,
  input: UpdateItemInput,
  deps?: WishlistDeps,
): Promise<WishlistView> {
  const c = ctx(deps);
  const wishlist = await loadAccessible(c, userId, wishlistId);
  assertEditable(wishlist);
  await c.db.$transaction(async (tx) => {
    const item = await lockItem(tx, wishlist.id, itemId);
    const active = (
      await tx.wishlistReservation.findMany({
        where: { itemId: item.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, quantity: true, status: true, displayName: true, contactEmail: true, telegramChatId: true },
      })
    ).filter((r) => isActiveReservation(r.status));
    const taken = active.reduce((sum, r) => sum + r.quantity, 0);
    const breaking = breakingItemChange(item, input, taken);
    if (breaking && !input.confirmReserved) {
      throw reservedConflict(breaking, active, wishlist.hideReservationsFromOwner);
    }
    if (breaking === "url_changed") {
      // A changed product link represents a different gift. Invalidate every
      // existing commitment before writing the replacement URL and quantity.
      // This is in the same row-locked transaction, so no stale reservation survives.
      await tx.wishlistReservation.updateMany({
        where: { id: { in: active.map((r) => r.id) } },
        data: { status: "ITEM_REMOVED" },
      });
    } else if (breaking === "quantity_below_taken" && input.quantity !== undefined) {
      // Keep the earliest reservations; the newest ones lose the item.
      let kept = 0;
      const dropped: string[] = [];
      for (const r of active) {
        if (kept + r.quantity <= input.quantity) kept += r.quantity;
        else dropped.push(r.id);
      }
      if (dropped.length > 0) {
        await tx.wishlistReservation.updateMany({ where: { id: { in: dropped } }, data: { status: "ITEM_REMOVED" } });
      }
    }
    const data: Prisma.WishlistItemUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.url !== undefined) data.url = input.url;
    if (input.comment !== undefined) data.comment = input.comment;
    if (input.priceApprox !== undefined) data.priceApprox = input.priceApprox;
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    await tx.wishlistItem.update({ where: { id: item.id }, data });
  });
  await touch(c, wishlist.id);
  return getWishlist(userId, wishlist.id, { db: c.db, env: c.env });
}

/** Soft delete. A reserved item needs explicit confirmation; its reservations become ITEM_REMOVED. */
export async function removeWishlistItem(
  userId: string,
  wishlistId: string,
  itemId: string,
  opts: { confirmReserved?: boolean } = {},
  deps?: WishlistDeps,
): Promise<WishlistView> {
  const c = ctx(deps);
  const wishlist = await loadAccessible(c, userId, wishlistId);
  assertEditable(wishlist);
  await c.db.$transaction(async (tx) => {
    const item = await lockItem(tx, wishlist.id, itemId);
    const active = (
      await tx.wishlistReservation.findMany({
        where: { itemId: item.id },
        select: { id: true, status: true, displayName: true, contactEmail: true, telegramChatId: true },
      })
    ).filter((r) => isActiveReservation(r.status));
    if (active.length > 0 && !opts.confirmReserved) {
      throw reservedConflict("removed", active, wishlist.hideReservationsFromOwner);
    }
    if (active.length > 0) {
      await tx.wishlistReservation.updateMany({
        where: { id: { in: active.map((r) => r.id) } },
        data: { status: "ITEM_REMOVED" },
      });
    }
    await tx.wishlistItem.update({ where: { id: item.id }, data: { deletedAt: new Date() } });
  });
  await touch(c, wishlist.id);
  return getWishlist(userId, wishlist.id, { db: c.db, env: c.env });
}

export async function reorderWishlistItems(
  userId: string,
  wishlistId: string,
  itemIds: string[],
  deps?: WishlistDeps,
): Promise<WishlistView> {
  const c = ctx(deps);
  const wishlist = await loadAccessible(c, userId, wishlistId);
  assertEditable(wishlist);
  const existing = await c.db.wishlistItem.findMany({
    where: { wishlistId: wishlist.id, deletedAt: null },
    select: { id: true },
  });
  const known = new Set(existing.map((i) => i.id));
  const unique = [...new Set(itemIds)];
  if (unique.length !== known.size || unique.some((id) => !known.has(id))) {
    throw new WishlistError("invalid_input", "Список позиций устарел, обновите страницу");
  }
  await c.db.$transaction(
    unique.map((id, index) => c.db.wishlistItem.update({ where: { id }, data: { sortOrder: index } })),
  );
  await touch(c, wishlist.id);
  return getWishlist(userId, wishlist.id, { db: c.db, env: c.env });
}

async function touch(c: Ctx, wishlistId: string) {
  await c.db.wishlist.update({ where: { id: wishlistId }, data: { updatedAt: new Date() } });
}

/** Author releases a guest's reservation (e.g. the gift was already bought elsewhere). */
export async function cancelReservationAsOwner(
  userId: string,
  wishlistId: string,
  reservationId: string,
  deps?: WishlistDeps,
): Promise<WishlistView> {
  const c = ctx(deps);
  const wishlist = await loadAccessible(c, userId, wishlistId);
  assertEditable(wishlist);
  const res = await c.db.wishlistReservation.updateMany({
    where: { id: reservationId, item: { wishlistId: wishlist.id }, status: { in: ["RESERVED", "PURCHASED"] } },
    data: { status: "CANCELLED" },
  });
  if (res.count === 0) throw new WishlistError("not_found");
  await touch(c, wishlist.id);
  return getWishlist(userId, wishlist.id, { db: c.db, env: c.env });
}

export type PreviewStatus = "ok" | "unavailable" | "no_url";

/**
 * Fills the item's photo (and a placeholder title) from its product link.
 * Never changes the link, quantity or reservations. A shop that blocks us just
 * yields "unavailable": the author keeps typing the title / photo by hand.
 */
export async function refreshItemPreview(
  userId: string,
  wishlistId: string,
  itemId: string,
  deps?: WishlistDeps,
): Promise<{ wishlist: WishlistView; preview: PreviewStatus }> {
  const c = ctx(deps);
  const wishlist = await loadAccessible(c, userId, wishlistId);
  assertEditable(wishlist);
  const item = await c.db.wishlistItem.findFirst({
    where: { id: itemId, wishlistId: wishlist.id, deletedAt: null },
    select: { id: true, url: true, title: true, updatedAt: true },
  });
  if (!item) throw new WishlistError("not_found");
  const view = async (preview: PreviewStatus) => ({
    wishlist: await getWishlist(userId, wishlist.id, { db: c.db, env: c.env }),
    preview,
  });
  if (!item.url) return view("no_url");

  const fetcher = deps?.fetchPreview ?? (await import("./linkPreview")).fetchLinkPreview;
  const found = await fetcher(item.url, userId);
  if (!found) return view("unavailable");

  const data: Prisma.WishlistItemUpdateManyMutationInput = {};
  if (found.imageUrl) data.imageUrl = found.imageUrl;
  if (found.title && isProvisionalTitle(item.title, item.url)) data.title = found.title.slice(0, 200);
  // Optimistic guard: any edit since we read the item (link, title, photo, ...) bumps updatedAt,
  // so a slow preview can never overwrite what the author just typed.
  const written = await c.db.wishlistItem.updateMany({
    where: { id: item.id, url: item.url, updatedAt: item.updatedAt, deletedAt: null },
    data,
  });
  return view(written.count > 0 ? "ok" : "unavailable");
}
