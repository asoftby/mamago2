import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Wishlist notifications (PR 4): pure parts — Telegram deep-link token and
 * message texts. Nothing here touches the network or the database.
 */

export type ReleaseReason = "removed" | "replaced" | "quantity" | "released";

const LINK_PREFIX = "wl";
const ID_PATTERN = /^[A-Za-z0-9]{10,36}$/;
const SIG_LENGTH = 22;

function sign(reservationId: string, secret: string): string {
  return createHmac("sha256", secret).update("wl-tg1\0").update(reservationId).digest("base64url").slice(0, SIG_LENGTH);
}

/**
 * `/start` payload that binds a Telegram chat to one reservation. Telegram caps
 * the payload at 64 chars; the signature means nothing has to be stored, and the
 * link is only ever shown to the holder of the reservation.
 */
export function telegramLinkPayload(reservationId: string, secret: string): string | null {
  if (!secret || !ID_PATTERN.test(reservationId)) return null;
  return `${LINK_PREFIX}_${reservationId}_${sign(reservationId, secret)}`;
}

export function parseTelegramLinkPayload(payload: string, secret: string): string | null {
  if (!secret || payload.length > 64) return null;
  const match = payload.match(/^wl_([A-Za-z0-9]{10,36})_([A-Za-z0-9_-]{22})$/);
  if (!match) return null;
  const expected = Buffer.from(sign(match[1], secret));
  const actual = Buffer.from(match[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return match[1];
}

const REASON_TEXT: Record<ReleaseReason, string> = {
  removed: "автор убрал его из списка",
  replaced: "автор заменил его на другой",
  quantity: "автор уменьшил нужное количество",
  released: "автор снял вашу бронь",
};

export function buildGuestReleaseMessage(input: {
  itemTitle: string;
  listTitle: string;
  reason: ReleaseReason;
  listUrl: string;
}): { subject: string; text: string } {
  return {
    subject: `Ваша бронь снята: ${input.itemTitle}`,
    text:
      `Подарок «${input.itemTitle}» из списка «${input.listTitle}» больше не за вами: ${REASON_TEXT[input.reason]}.\n` +
      `Посмотреть список и выбрать другой подарок: ${input.listUrl}`,
  };
}

export function buildThanksMessage(input: {
  itemTitle: string;
  listTitle: string;
  message: string | null;
  listUrl: string;
}): { subject: string; text: string } {
  return {
    subject: `Спасибо за подарок: ${input.itemTitle}`,
    text:
      `Спасибо за подарок «${input.itemTitle}» (список «${input.listTitle}»)!` +
      (input.message ? `\n\n${input.message}` : "") +
      `\n${input.listUrl}`,
  };
}

export function buildAuthorReservedMessage(input: {
  listTitle: string;
  itemTitle: string;
  displayName: string | null;
}): { title: string; body: string } {
  return input.displayName
    ? {
        title: `${input.displayName} выбрал(а) подарок`,
        body: `В списке «${input.listTitle}» забронирован подарок «${input.itemTitle}».`,
      }
    : {
        title: "Кто-то выбрал подарок",
        body: `В списке «${input.listTitle}» появилась новая бронь.`,
      };
}

/** Reservation notices stay visible to a returning guest for this long. */
export const RELEASE_NOTICE_DAYS = 7;
