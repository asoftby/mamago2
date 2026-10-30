import "server-only";

import type { PrismaClient } from "@prisma/client";

import { sendEmail } from "@/lib/email/emailAdapter";
import { getBaseUrl } from "@/lib/routing/cityPaths";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { getTelegramBotProfileUrl, getTelegramConfig } from "@/server/config/telegram.config";
import { createNotification } from "@/server/services/notification.service";
import { TelegramChannel } from "@/server/services/telegram/TelegramChannel";

import {
  buildAuthorReservedMessage,
  buildGuestReleaseMessage,
  buildThanksMessage,
  parseTelegramLinkPayload,
  telegramLinkPayload,
  type ReleaseReason,
} from "./wishlistNotifyPure";

/**
 * Wishlist notifications (PR 4). Everything here is best-effort: a failed
 * message must never fail the reservation or the author's edit.
 */

/** `itemTitle` is the title the guest reserved (captured before the author's edit); falls back to the current one. */
export type ReleasedReservation = { reservationId: string; reason: ReleaseReason; itemTitle?: string };

/**
 * SYSTEM is a registered notification type (in-app + Telegram on by default). SYSTEM_INFO is not in
 * the registry, so with default settings it reaches nobody. Adding dedicated wishlist types needs an
 * enum migration and is tracked in the backlog.
 */
const NOTICE_TYPE = "SYSTEM" as const;

const AUTHOR_THROTTLE_MS = 10 * 60_000;

function safeLog(what: string, error: unknown) {
  // Symbolic only: provider errors can echo addresses or message text.
  console.error(`[wishlist.notify] ${what}`, error instanceof Error ? error.name : typeof error);
}

/** Author: "someone picked a gift". Silent in surprise mode, throttled per list. */
export async function notifyAuthorReserved(
  db: PrismaClient,
  input: { wishlistId: string; displayName: string; itemId: string },
): Promise<void> {
  try {
    const wishlist = await db.wishlist.findUnique({
      where: { id: input.wishlistId },
      select: { id: true, title: true, ownerUserId: true, hideReservationsFromOwner: true },
    });
    if (!wishlist || wishlist.hideReservationsFromOwner) return;
    const item = await db.wishlistItem.findUnique({ where: { id: input.itemId }, select: { title: true } });
    const recent = await db.notification.findFirst({
      where: {
        userId: wishlist.ownerUserId,
        createdAt: { gte: new Date(Date.now() - AUTHOR_THROTTLE_MS) },
        metadata: { path: ["wishlistId"], equals: wishlist.id },
      },
      select: { id: true },
    });
    const message = buildAuthorReservedMessage({
      listTitle: wishlist.title,
      itemTitle: item?.title ?? "",
      // A burst of reservations collapses into one anonymous notice.
      displayName: recent ? null : input.displayName,
    });
    if (recent) return;
    await createNotification({
      userId: wishlist.ownerUserId,
      type: NOTICE_TYPE,
      title: message.title,
      body: message.body,
      ctaLabel: "Открыть список",
      actionUrl: `/me/wishlists/${wishlist.id}`,
      metadata: { wishlistId: wishlist.id, kind: "WISHLIST_RESERVED" },
    });
  } catch (error) {
    safeLog("author notice failed", error);
  }
}

type GuestRow = {
  userId: string | null;
  user: { email: string | null } | null;
  telegramChatId: string | null;
  contactEmail: string | null;
  item: { title: string; wishlist: { title: string; shareToken: string } };
};

const guestSelect = {
  id: true,
  userId: true,
  user: { select: { email: true } },
  contactEmail: true,
  telegramChatId: true,
  item: { select: { title: true, wishlist: { select: { title: true, shareToken: true } } } },
} as const;

/** Account holders get an in-app notice; anyone with a contact on the reservation also gets Telegram and/or email. */
async function deliverToGuest(
  row: GuestRow,
  message: { subject: string; text: string },
  kind: "WISHLIST_RELEASED" | "WISHLIST_THANKS",
): Promise<void> {
  if (row.userId) {
    try {
      await createNotification({
        userId: row.userId,
        type: NOTICE_TYPE,
        title: message.subject,
        body: message.text.split("\n")[0],
        ctaLabel: "Открыть список",
        actionUrl: `/w/${row.item.wishlist.shareToken}`,
        metadata: { kind },
      });
    } catch (error) {
      safeLog("account notice failed", error);
    }
  }
  // Contacts left on the reservation itself are honoured for account holders too.
  if (row.telegramChatId) {
    try {
      await new TelegramChannel().sendMessage({ chatId: row.telegramChatId, text: message.text });
    } catch (error) {
      safeLog("telegram failed", error);
    }
  }
  if (row.contactEmail && row.contactEmail.toLowerCase() !== (row.user?.email ?? "").toLowerCase()) {
    try {
      await sendEmail({ to: row.contactEmail, subject: message.subject, text: message.text });
    } catch (error) {
      safeLog("email failed", error);
    }
  }
}

/**
 * Guests whose reservation the author just released.
 * Guests without a contact see a banner on their next visit (public view).
 */
export async function notifyReleasedGuests(db: PrismaClient, released: ReleasedReservation[]): Promise<void> {
  if (released.length === 0) return;
  let rows;
  try {
    rows = await db.wishlistReservation.findMany({
      where: { id: { in: released.map((r) => r.reservationId) } },
      select: guestSelect,
    });
  } catch (error) {
    safeLog("load released failed", error);
    return;
  }
  const reasonById = new Map(released.map((r) => [r.reservationId, r.reason]));
  const titleById = new Map(released.map((r) => [r.reservationId, r.itemTitle]));
  const base = getBaseUrl();
  await Promise.all(
    rows.map((row) =>
      deliverToGuest(
        row,
        buildGuestReleaseMessage({
          itemTitle: titleById.get(row.id) ?? row.item.title,
          listTitle: row.item.wishlist.title,
          reason: reasonById.get(row.id) ?? "released",
          listUrl: `${base}/w/${row.item.wishlist.shareToken}`,
        }),
        "WISHLIST_RELEASED",
      ),
    ),
  );
}

/** The author thanks everyone who holds a gift. Returns how many reservations were addressed. */
export async function notifyThanksGuests(
  db: PrismaClient,
  reservationIds: string[],
  message: string | null,
): Promise<number> {
  if (reservationIds.length === 0) return 0;
  const rows = await db.wishlistReservation.findMany({
    where: { id: { in: reservationIds }, status: { in: ["RESERVED", "PURCHASED"] } },
    select: guestSelect,
  });
  const base = getBaseUrl();
  await Promise.all(
    rows.map((row) =>
      deliverToGuest(
        row,
        buildThanksMessage({
          itemTitle: row.item.title,
          listTitle: row.item.wishlist.title,
          message,
          listUrl: `${base}/w/${row.item.wishlist.shareToken}`,
        }),
        "WISHLIST_THANKS",
      ),
    ),
  );
  return rows.length;
}

/** Deep link that binds the guest's Telegram chat to their reservation; null if the bot is not configured. */
export function wishlistTelegramUrl(reservationId: string): string | null {
  const config = getTelegramConfig();
  if (!config.botToken || !config.botUsername || !config.webhookSecret) return null;
  const payload = telegramLinkPayload(reservationId, config.webhookSecret);
  return payload ? `${getTelegramBotProfileUrl(config.botUsername)}?start=${payload}` : null;
}

/** Webhook side of the deep link. Returns the reply text, or null when the payload is not ours/valid. */
export async function bindWishlistTelegram(
  payload: string,
  chatId: string,
  db: PrismaClient = defaultPrisma as unknown as PrismaClient,
): Promise<string | null> {
  const secret = getTelegramConfig().webhookSecret;
  const reservationId = secret ? parseTelegramLinkPayload(payload, secret) : null;
  if (!reservationId) return null;
  const reservation = await db.wishlistReservation.findFirst({
    where: { id: reservationId, status: { in: ["RESERVED", "PURCHASED"] } },
    select: { id: true, consentAt: true, item: { select: { title: true } } },
  });
  if (!reservation) return null;
  await db.wishlistReservation.update({
    where: { id: reservation.id },
    data: {
      telegramChatId: chatId,
      // Opening the bot link is an explicit opt-in to messages about this gift.
      consentAt: reservation.consentAt ?? new Date(),
      consentTextVersion: "wl-v1-tg",
    },
  });
  return `Готово. Напишу сюда, если автор изменит или уберёт подарок «${reservation.item.title}».`;
}
