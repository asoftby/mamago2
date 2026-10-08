import "server-only";

import { requireTelegramConfig } from "@/server/config/telegram.config";
import { createTelegramCaptureClient } from "./telegramCaptureClient.core";

/** Bot token comes from the same per-environment config as `TelegramChannel`. */
export function getTelegramCaptureClient() {
  return createTelegramCaptureClient({ getBotToken: () => requireTelegramConfig().botToken });
}
