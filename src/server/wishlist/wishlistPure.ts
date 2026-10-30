import { randomBytes } from "node:crypto";
import type { Prisma, WishlistReservationStatus } from "@prisma/client";
import { z } from "zod";

/**
 * Wishlist (PR 1): pure, DB-free helpers — flag, ACL fragment, input schemas,
 * owner-facing item status. The service layer composes these with Prisma.
 */

export function wishlistEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.WISHLIST_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export type WishlistErrorCode =
  | "disabled"
  | "not_found"
  | "invalid_input"
  | "invalid_recipient"
  | "item_reserved"
  | "archived"
  | "sold_out"
  | "forbidden"
  | "rate_limited";

export class WishlistError extends Error {
  constructor(
    public readonly code: WishlistErrorCode,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
    this.name = "WishlistError";
  }
}

export function wishlistErrorStatus(code: WishlistErrorCode): number {
  switch (code) {
    case "disabled":
    case "not_found":
      return 404;
    case "item_reserved":
    case "archived":
    case "sold_out":
      return 409;
    case "forbidden":
      return 403;
    case "rate_limited":
      return 429;
    default:
      return 400;
  }
}

/**
 * Public-link capability token. 24 random bytes → 32 base64url chars: short
 * enough for a Telegram /start payload later, far beyond guessing range.
 */
export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

/**
 * Same family-ACL policy as Child/PlanItem (familyScope.ts): with FAMILY_CORE_READS
 * on, every active adult of the family sees and edits the family's wishlists;
 * the creator always keeps access to their own (e.g. a list made before joining).
 */
export function wishlistScopeWhere(
  scope: { userId: string; familyId: string | null },
  familyReads: boolean,
): Prisma.WishlistWhereInput {
  if (!familyReads || !scope.familyId) return { ownerUserId: scope.userId };
  return { OR: [{ familyId: scope.familyId }, { ownerUserId: scope.userId }] };
}

// ─── Input schemas ───────────────────────────────────────────────────────────

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .union([trimmed(max), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v && v.length > 0 ? v : null));

/** Only http(s) links are stored; anything else is rejected, never rewritten. */
export const wishlistUrlSchema = z
  .union([z.string().trim().max(2048), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;
    if (!v) return null;
    let parsed: URL;
    try {
      parsed = new URL(v);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Некорректная ссылка" });
      return z.NEVER;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ссылка должна начинаться с http(s)://" });
      return z.NEVER;
    }
    return parsed.toString();
  });

const dateKeySchema = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
  .optional();

export const createWishlistSchema = z.object({
  title: trimmed(120).min(1, "Название обязательно"),
  note: optionalText(1000),
  recipientChildId: z.string().min(1).nullish(),
  recipientName: optionalText(60),
  occasion: z.enum(["BIRTHDAY", "OTHER"]).default("BIRTHDAY"),
  eventDate: dateKeySchema,
  visibility: z.enum(["PRIVATE", "LINK"]).default("LINK"),
  hideReservationsFromOwner: z.boolean().optional(),
  showReserverNamesToGuests: z.boolean().optional(),
});

export const updateWishlistSchema = z.object({
  title: trimmed(120).min(1).optional(),
  note: optionalText(1000),
  recipientChildId: z.string().min(1).nullish(),
  recipientName: optionalText(60),
  occasion: z.enum(["BIRTHDAY", "OTHER"]).optional(),
  eventDate: dateKeySchema,
  visibility: z.enum(["PRIVATE", "LINK"]).optional(),
  hideReservationsFromOwner: z.boolean().optional(),
  showReserverNamesToGuests: z.boolean().optional(),
});

const priceSchema = z
  .union([z.number().nonnegative().max(99_999_999), z.null()])
  .optional();

export const createItemSchema = z.object({
  title: trimmed(200).min(1, "Название подарка обязательно"),
  url: wishlistUrlSchema,
  comment: optionalText(1000),
  priceApprox: priceSchema,
  quantity: z.number().int().min(1).max(99).default(1),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  imageUrl: wishlistUrlSchema,
});

export const updateItemSchema = z.object({
  title: trimmed(200).min(1).optional(),
  url: wishlistUrlSchema,
  comment: optionalText(1000),
  priceApprox: priceSchema,
  quantity: z.number().int().min(1).max(99).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).optional(),
  imageUrl: wishlistUrlSchema,
  /** Required to change a reserved item in a way that breaks reservations. */
  confirmReserved: z.boolean().optional(),
});

export const reorderItemsSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(500),
});

/** zod transforms yield required-but-possibly-undefined keys; callers may omit them. */
type Loose<T> = { [K in keyof T]?: T[K] };

export type CreateWishlistInput = Loose<z.infer<typeof createWishlistSchema>> & { title: string };
export type UpdateWishlistInput = Loose<z.infer<typeof updateWishlistSchema>>;
export type CreateItemInput = Loose<z.infer<typeof createItemSchema>> & { title: string };
export type UpdateItemInput = Loose<z.infer<typeof updateItemSchema>>;

/** YYYY-MM-DD → UTC midnight Date for a @db.Date column. */
export function dateKeyToDate(key: string | null | undefined): Date | null | undefined {
  if (key === undefined) return undefined;
  if (key === null) return null;
  const date = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new WishlistError("invalid_input", "Некорректная дата");
  return date;
}

export function dateToDateKey(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

// ─── Reservations as seen by the owner ───────────────────────────────────────

/** Statuses that hold quantity of an item. */
export const ACTIVE_RESERVATION_STATUSES: readonly WishlistReservationStatus[] = ["RESERVED", "PURCHASED"];

export function isActiveReservation(status: WishlistReservationStatus): boolean {
  return ACTIVE_RESERVATION_STATUSES.includes(status);
}

export type ReservationRow = {
  id: string;
  quantity: number;
  status: WishlistReservationStatus;
  displayName: string;
  contactEmail: string | null;
  telegramChatId: string | null;
};

export type OwnerItemState = "FREE" | "PARTIAL" | "RESERVED" | "PURCHASED";

export type OwnerReservationView = {
  id: string;
  displayName: string;
  quantity: number;
  status: "RESERVED" | "PURCHASED";
  /** The guest can be notified about changes (Telegram or email). */
  hasContact: boolean;
};

/**
 * Owner view of an item. In surprise mode the owner learns only how many units
 * are taken — never by whom, never reserved-vs-purchased.
 */
export function summarizeItemForOwner(
  quantity: number,
  reservations: ReservationRow[],
  hideReservationsFromOwner: boolean,
): { state: OwnerItemState; takenQuantity: number; reservations: OwnerReservationView[] } {
  const active = reservations.filter((r) => isActiveReservation(r.status));
  const takenQuantity = Math.min(
    quantity,
    active.reduce((sum, r) => sum + r.quantity, 0),
  );
  let state: OwnerItemState = "FREE";
  if (takenQuantity >= quantity) {
    state =
      !hideReservationsFromOwner && active.length > 0 && active.every((r) => r.status === "PURCHASED")
        ? "PURCHASED"
        : "RESERVED";
  } else if (takenQuantity > 0) {
    state = "PARTIAL";
  }
  return {
    state,
    takenQuantity,
    reservations: hideReservationsFromOwner
      ? []
      : active.map((r) => ({
          id: r.id,
          displayName: r.displayName,
          quantity: r.quantity,
          status: r.status as "RESERVED" | "PURCHASED",
          hasContact: Boolean(r.contactEmail || r.telegramChatId),
        })),
  };
}

/**
 * Which item changes invalidate existing reservations: removal, pointing the
 * item at a different product (url), or lowering quantity below what is taken.
 * Cosmetic edits (title typo, comment, price, image, priority) never do.
 */
export function breakingItemChange(
  current: { url: string | null; quantity: number },
  patch: { url?: string | null; quantity?: number },
  takenQuantity: number,
): "url_changed" | "quantity_below_taken" | null {
  if (takenQuantity <= 0) return null;
  if (patch.url !== undefined && (patch.url ?? null) !== (current.url ?? null)) return "url_changed";
  if (patch.quantity !== undefined && patch.quantity < takenQuantity) return "quantity_below_taken";
  return null;
}

// ─── Guest side (PR 2) ───────────────────────────────────────────────────────

export const CONSENT_TEXT_VERSION = "wl-v1";
export const MAX_CLAIMS_PER_COOKIE = 30;

export const guestReserveSchema = z.object({
  displayName: z.string().trim().min(1, "Укажите имя").max(60),
  quantity: z.number().int().min(1).max(99).default(1),
  contactEmail: z
    .union([z.string().trim().toLowerCase().email("Некорректный email").max(254), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  /** Required when a contact is left: the guest agrees to be notified about changes. */
  consent: z.boolean().optional(),
});
export type GuestReserveInput = { displayName: string; quantity?: number; contactEmail?: string | null; consent?: boolean };

export const guestActionSchema = z.object({ action: z.enum(["cancel", "purchased"]) });

/** One cookie per list; value = comma-separated raw claim tokens (64 hex each). */
export function claimCookieName(shareToken: string): string {
  return `wl_c_${shareToken}`;
}

const RAW_CLAIM_PATTERN = /^[a-f0-9]{64}$/;

export function parseClaimCookie(value: string | undefined | null): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").filter((t) => RAW_CLAIM_PATTERN.test(t)))].slice(-MAX_CLAIMS_PER_COOKIE);
}

export function serializeClaimCookie(tokens: string[]): string {
  return [...new Set(tokens)].slice(-MAX_CLAIMS_PER_COOKIE).join(",");
}

/** Guest-facing state of an item. Names are never part of it unless the author allowed. */
export type GuestItemState = "FREE" | "PARTIAL" | "TAKEN";

export function guestItemState(quantity: number, taken: number): GuestItemState {
  if (taken >= quantity) return "TAKEN";
  return taken > 0 ? "PARTIAL" : "FREE";
}

// ─── Stored images ───────────────────────────────────────────────────────────

const STORED_MEDIA_PREFIX = "/api/media/file/";

/** Photos we saved ourselves (link previews). They have no MediaAsset, so /api/media/file would 404. */
export function isStoredMediaUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith(STORED_MEDIA_PREFIX);
}

/**
 * What an <img> should load. Our own files go through the wishlist image routes
 * (ACL by owner or share token); external links the author typed are used as is.
 * `proxyPath` is the route without query. The `v` stamp busts the cache when the photo changes.
 */
export function wishlistImageSrc(imageUrl: string | null, proxyPath: string): string | null {
  if (!imageUrl) return null;
  if (!isStoredMediaUrl(imageUrl)) return imageUrl;
  const stem = (imageUrl.split("/").pop() ?? "").split(".")[0].slice(0, 48);
  return `${proxyPath}?v=${encodeURIComponent(stem)}`;
}
