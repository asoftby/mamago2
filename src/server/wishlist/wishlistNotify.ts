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
  parseTelegramLinkPayload,
  telegramLinkPayload,
  type ReleaseReason,
} from "./wishlistNotifyPure";

/**
 * Wishlist notifications (PR 4). Everything here is best-effort: a failed
 * message must never fail the reservation or the author's edit.
 */

export type ReleasedReservation = { reservationId: string; reason: ReleaseReason };

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
      type: "SYSTEM_INFO",
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

/**
 * Guests whose reservation the author just released. Registered guests get an
 * in-app notice; others get Telegram and/or email if they left a contact.
 * Guests without a contact see a banner on their next visit (public view).
 */
export async function notifyReleasedGuests(db: PrismaClient, released: ReleasedReservation[]): Promise<void> {
  if (released.length === 0) return;
  let rows;
  try {
    rows = await db.wishlistReservation.findMany({
      where: { id: { in: released.map((r) => r.reservationId) } },
      select: {
        id: true,
        userId: true,
        contactEmail: true,
        telegramChatId: true,
        item: { select: { title: true, wishlist: { select: { title: true, shareToken: true } } } },
      },
    });
  } catch (error) {
    safeLog("load released failed", error);
    return;
  }
  const reasonById = new Map(released.map((r) => [r.reservationId, r.reason]));
  const base = getBaseUrl();

  await Promise.all(
    rows.map(async (row) => {
      const listUrl = `${base}/w/${row.item.wishlist.shareToken}`;
      const message = buildGuestReleaseMessage({
        itemTitle: row.item.title,
        listTitle: row.item.wishlist.title,
        reason: reasonById.get(row.id) ?? "released",
        listUrl,
      });
      if (row.userId) {
        try {
          await createNotification({
            userId: row.userId,
            type: "SYSTEM_INFO",
            title: message.subject,
            body: message.text.split("\n")[0],
            ctaLabel: "Открыть список",
            actionUrl: `/w/${row.item.wishlist.shareToken}`,
            metadata: { kind: "WISHLIST_RELEASED" },
          });
        } catch (error) {
          safeLog("account notice failed", error);
        }
        return;
      }
      if (row.telegramChatId) {
        try {
          await new TelegramChannel().sendMessage({ chatId: row.telegramChatId, text: message.text });
        } catch (error) {
          safeLog("telegram failed", error);
        }
      }
      if (row.contactEmail) {
        try {
          await sendEmail({ to: row.contactEmail, subject: message.subject, text: message.text });
        } catch (error) {
          safeLog("email failed", error);
        }
      }
    }),
  );
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
