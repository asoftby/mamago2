import "server-only";

import type { TelegramEnvironment } from "@prisma/client";
import { createOpenRouterClient, readCaptureModelConfig } from "@/lib/ai/openrouterClient";
import { prismaBase } from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";
import { getTelegramConfig } from "@/server/config/telegram.config";
import type { PlanOwner } from "@/server/services/planOwner";
import type { DecodedCallback } from "./callbackCodec";
import type { ParsedCallback } from "./telegramUpdateParser";
import { createCaptureCardPresenter } from "./captureCardPresenter";
import { createCaptureCallbackService } from "./captureCallback.service";
import { createCaptureEditService, type CaptureEditIntakeResult } from "./captureEdit.service";
import {
  findTelegramConnectionByChatIdForCurrentEnvironment,
  touchTelegramConnectionByChatIdForCurrentEnvironment,
} from "@/server/services/telegram/telegramConnection.service";
import { TelegramChannel } from "../TelegramChannel";
import { CAPTURE_ALLOWLIST_ENV, parseCaptureAllowlist } from "./captureAllowlist";
import { createCaptureInboxProcessor } from "./captureProcessor";
import type { InboxProcessor } from "./inboxProcessor";
import { createInboxIntake, type IntakeNotifier, type IntakeResult } from "./inboxIntake.service";
import { getTelegramCaptureClient } from "./telegramCaptureClient";
import type { ParsedCapture } from "./telegramUpdateParser";
import { CAPTURE_PROCESSING_REPLIES } from "./captureReplies";

/** Everything the webhook needs for the capture path; injectable in tests. */
export type CaptureRoutingDeps = {
  getAllowlist: () => ReadonlySet<string>;
  findActiveConnection: (chatId: string) => Promise<{ userId: string } | null>;
  touchConnection: (chatId: string) => Promise<void>;
  getEnvironment: () => TelegramEnvironment;
  tryEdit: (owner: PlanOwner, environment: TelegramEnvironment, capture: ParsedCapture) => Promise<CaptureEditIntakeResult | null>;
  receive: (owner: PlanOwner, environment: TelegramEnvironment, capture: ParsedCapture) => Promise<IntakeResult>;
  handleCallback: (owner: PlanOwner, callback: ParsedCallback, decoded: DecodedCallback) => Promise<void>;
  acknowledgeCallback: (callbackQueryId: string) => Promise<void>;
};

function createNotifier(): IntakeNotifier {
  return {
    async reply(chatId, text) {
      try {
        await new TelegramChannel().sendMessage({ chatId: String(chatId), text });
      } catch {
        console.error("[telegram:capture] code=REPLY_FAILED");
      }
    },
    async typing(chatId) {
      await getTelegramCaptureClient().sendChatAction(chatId, "typing");
    },
    async progress(chatId, partKind) {
      try {
        const sent = await new TelegramChannel().sendMessage({
          chatId: String(chatId),
          text: CAPTURE_PROCESSING_REPLIES[partKind],
        });
        return sent.message_id;
      } catch {
        console.error("[telegram:capture] code=PROGRESS_SEND_FAILED");
        return null;
      }
    },
    async failed(chatId, messageId, text) {
      if (messageId !== null) {
        try {
          await new TelegramChannel().editMessageText({
            chatId: String(chatId),
            messageId,
            text,
          });
          return;
        } catch {
          console.error("[telegram:capture] code=FAILURE_STATUS_EDIT_FAILED");
        }
      }
      try {
        await new TelegramChannel().sendMessage({ chatId: String(chatId), text });
      } catch {
        console.error("[telegram:capture] code=FAILURE_REPLY_FAILED");
      }
    },
  };
}

/** The real inbox processor with production wiring; shared by the webhook and the recover cron. */
export function createDefaultCaptureProcessor(): InboxProcessor {
  const channel = new TelegramChannel();
  const presenter = createCaptureCardPresenter({ db: prismaBase, channel });
  return createCaptureInboxProcessor({
    db: prismaBase,
    openrouter: createOpenRouterClient(),
    telegram: getTelegramCaptureClient(),
    models: () => readCaptureModelConfig(),
    presenter,
    notifier: createNotifier(),
    context: {
      db: prismaBase,
      city: {
        findCityIdBySlug: async (slug) => (await findCityBySlug(slug, { select: { id: true } }))?.id ?? null,
      },
      places: { publicPlaceWhere: getPublicPublishedPlaceWhere() },
    },
  });
}

export function createDefaultCaptureRoutingDeps(): CaptureRoutingDeps {
  const channel = new TelegramChannel();
  const presenter = createCaptureCardPresenter({ db: prismaBase, channel });
  const callbacks = createCaptureCallbackService({ db: prismaBase, channel, presenter });
  const notifier = createNotifier();
  const edits = createCaptureEditService({
    db: prismaBase,
    openrouter: createOpenRouterClient(),
    models: () => readCaptureModelConfig(),
    presenter,
    notifier,
    context: {
      db: prismaBase,
      city: {
        findCityIdBySlug: async (slug) =>
          (await findCityBySlug(slug, { select: { id: true } }))?.id ?? null,
      },
      places: { publicPlaceWhere: getPublicPublishedPlaceWhere() },
    },
  });
  let intake: ReturnType<typeof createInboxIntake> | null = null;
  const getIntake = () => {
    intake ??= createInboxIntake({
      db: prismaBase,
      notifier,
      processor: createDefaultCaptureProcessor(),
    });
    return intake;
  };

  return {
    getAllowlist: () => parseCaptureAllowlist(process.env[CAPTURE_ALLOWLIST_ENV]),
    findActiveConnection: async (chatId) => {
      const connection = await findTelegramConnectionByChatIdForCurrentEnvironment(chatId);
      return connection?.isActive ? { userId: connection.userId } : null;
    },
    touchConnection: (chatId) => touchTelegramConnectionByChatIdForCurrentEnvironment(chatId).then(() => undefined),
    getEnvironment: () => getTelegramConfig().environment,
    tryEdit: (owner, environment, capture) => edits.tryReceive(owner, environment, capture),
    receive: (owner, environment, capture) => getIntake().receive(owner, environment, capture),
    handleCallback: (owner, callback, decoded) => callbacks.handle(owner, callback, decoded),
    acknowledgeCallback: async (callbackQueryId) => {
      await getTelegramCaptureClient().answerCallbackQuery(callbackQueryId);
    },
  };
}
