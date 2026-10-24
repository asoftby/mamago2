import "server-only";

import type { Notification } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { getBusinessTelegramConfig } from "@/server/config/businessTelegram.config";
import type { TelegramReplyMarkup } from "@/server/services/telegram/TelegramChannel";
import { listPartyConfirmChoices } from "./partyConfirmChoices.service";
import { PartyApiError } from "./partyDraft.validation";
import { createPartyConfirmCallback } from "./partyTelegramActionToken";
import { canConfirmPartyWithOneTap } from "./partyTelegramButtonPolicy";

type Recipient = { chatId: string; businessId: string };

/**
 * Buttons are generated only for authenticated BUSINESS recipients of a
 * PARTY_QUOTE_ACCEPTED outbox notification. Never derive the action from
 * mutable notification text or allow an old/stale request to confirm.
 *
 * The business dashboard link remains available for all valid accepted quotes;
 * an inline confirmation is offered only when the resource is unambiguous.
 * The actual POST callback re-verifies quote, membership, availability and
 * exclusive allocation under transaction locks.
 */
export async function buildPartyConfirmationTelegramKeyboard(
  notification: Pick<Notification, "audience" | "entityType" | "entityId" | "metadata">,
  recipient: Recipient,
): Promise<TelegramReplyMarkup | undefined> {
  if (notification.audience !== "BUSINESS" ||
      notification.entityType !== "BOOKING" || !notification.entityId ||
      !/^\d+$/.test(recipient.chatId)) return undefined;

  const metadata = notification.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) ||
      metadata.source !== "PARTY_OUTBOX" ||
      typeof metadata.outboxId !== "string") return undefined;

  const outbox = await prisma.partyOutbox.findFirst({
    where: {
      id: metadata.outboxId, aggregateId: notification.entityId,
      eventType: "PARTY_QUOTE_ACCEPTED",
    },
    select: { id: true },
  });
  if (!outbox) return undefined;

  const request = await prisma.bookingRequest.findFirst({
    where: {
      id: notification.entityId, businessId: recipient.businessId,
      kind: "PARTY", partyStage: "AWAITING_RECONFIRM",
      status: "NEW", responseDueAt: { gt: new Date() },
    },
    select: {
      offerId: true,
      partyQuotes: {
        orderBy: { version: "desc" }, take: 1,
        select: { version: true, status: true, bookingUnitId: true },
      },
    },
  });
  const quote = request?.partyQuotes[0];
  if (!request?.offerId || !quote || quote.status !== "ACCEPTED") return undefined;

  const keyboard: TelegramReplyMarkup["inline_keyboard"] = [];
  const config = getBusinessTelegramConfig();

  // The availability preview is only advisory: callback confirmation always
  // checks the resource again. Multiple mapped rooms require a manual choice.
  if (config.configured) {
    try {
      const [choices, activeMappedUnitCount] = await Promise.all([
        listPartyConfirmChoices(recipient.businessId, notification.entityId),
        prisma.bookingUnitOffer.count({
          where: {
            offerId: request.offerId,
            bookingUnit: { businessId: recipient.businessId, status: "ACTIVE" },
          },
        }),
      ]);
      if (choices.quoteVersion === quote.version && canConfirmPartyWithOneTap({
        availableUnitIds: choices.units.map((unit) => unit.id),
        activeMappedUnitCount,
        acceptedQuoteUnitId: quote.bookingUnitId,
        manualAllowed: choices.manualAllowed,
      })) {
        keyboard.push([{
          text: "Подтвердить заявку",
          callback_data: createPartyConfirmCallback({
            requestId: notification.entityId, quoteVersion: quote.version,
            chatId: recipient.chatId, secret: config.webhookSecret,
          }),
        }]);
      }
    } catch (error) {
      // A stale/closed request must not get a confirmation button.
      // Transient preview failures also fail closed, but preserve the dashboard link.
      if (!(error instanceof PartyApiError)) {
        console.error("[business-telegram] Cannot build party confirm button");
      }
    }
  }

  const baseUrl = getCanonicalPublicAppUrl();
  if (baseUrl.startsWith("https://")) {
    keyboard.push([{
      text: "Открыть в кабинете",
      url: new URL("/business/bookings?tab=action&kind=party", baseUrl).toString(),
    }]);
  }
  return keyboard.length ? { inline_keyboard: keyboard } : undefined;
}
