import "server-only";
import { createHash } from "node:crypto";

import prisma from "@/lib/prisma";
import { confirmPartyRequest } from "./partyConfirm.service";
import { verifyPartyConfirmCallback } from "./partyTelegramActionToken";

/**
 * Call only from the verified Business Telegram webhook. Telegram identities
 * must be resolved from business bot connections, never Info Bot connections.
 * This adapter is deliberately not wired to a webhook in this PR.
 */
export async function handlePartyTelegramConfirmation(input: {
  callbackData: string;
  chatId: string;
  telegramUserId: string;
  callbackQueryId: string;
  secret: string;
  resolveBusinessBotActor: (telegramUserId: string, chatId: string) =>
    Promise<{ businessId: string; userId: string } | null>;
}) {
  if (!/^\d+$/.test(input.chatId) || !/^\d+$/.test(input.telegramUserId) ||
      input.chatId !== input.telegramUserId ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(input.callbackQueryId)) {
    return { ok: false as const, reason: "UNAUTHORIZED" as const };
  }
  const command = verifyPartyConfirmCallback({
    token: input.callbackData, chatId: input.chatId, secret: input.secret,
  });
  if (!command) return { ok: false as const, reason: "EXPIRED_OR_INVALID" as const };

  const actor = await input.resolveBusinessBotActor(input.telegramUserId, input.chatId);
  if (!actor) return { ok: false as const, reason: "UNAUTHORIZED" as const };

  // Check revoked membership at execution time, not just link issuance.
  // The quote version, stage, capacity and resource are checked transactionally
  // again inside confirmPartyRequest.
  const member = await prisma.businessMember.findFirst({
    where: {
      businessId: actor.businessId, userId: actor.userId, isActive: true,
      role: { in: ["OWNER", "MANAGER"] },
      business: { operationalStatus: "ACTIVE" },
    },
    select: { id: true },
  });
  if (!member) return { ok: false as const, reason: "UNAUTHORIZED" as const };

  try {
    const confirmed = await confirmPartyRequest({
      requestId: command.requestId,
      businessId: actor.businessId,
      actorUserId: actor.userId,
      expectedQuoteVersion: command.quoteVersion,
      // All presses of the same signed button use the same idempotency key.
      idempotencyKey: "tg_" + createHash("sha256")
        .update(input.callbackData).update("\0").update(input.chatId)
        .digest("hex").slice(0, 32),
    });
    return { ok: true as const, confirmed };
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? (error as { status: unknown }).status : undefined;
    if (status === 409 || status === 410 || status === 422) {
      return { ok: false as const, reason: "STALE_REQUEST" as const };
    }
    throw error;
  }
}
