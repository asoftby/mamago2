import "server-only";

import { isLocalAppEnv, isProductionAppEnv } from "@/lib/config/productionEnvGuard";

export type TelegramRuntimeEnvironment = "DEV" | "PROD";

type TelegramConfig = {
  environment: TelegramRuntimeEnvironment;
  botToken: string | null;
  botUsername: string | null;
  webhookSecret: string | null;
};

export function getTelegramRuntimeEnvironment(): TelegramRuntimeEnvironment {
  return isProductionAppEnv() ? "PROD" : "DEV";
}

/** Webhook secret is required on every deployed host, optional only for local `next dev`. */
export function requiresTelegramWebhookSecret(): boolean {
  return !isLocalAppEnv();
}

function firstEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function normalizeUsername(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^@/, "");
}

export function getTelegramConfig(): TelegramConfig {
  const environment = getTelegramRuntimeEnvironment();

  if (environment === "PROD") {
    return {
      environment,
      botToken: firstEnv("TELEGRAM_BOT_TOKEN_PROD", "TELEGRAM_BOT_TOKEN"),
      botUsername: normalizeUsername(
        firstEnv("TELEGRAM_BOT_USERNAME_PROD", "TELEGRAM_BOT_USERNAME"),
      ),
      webhookSecret: firstEnv("TELEGRAM_WEBHOOK_SECRET_PROD", "TELEGRAM_WEBHOOK_SECRET"),
    };
  }

  return {
    environment,
    botToken: firstEnv("TELEGRAM_BOT_TOKEN_DEV", "TELEGRAM_BOT_TOKEN"),
    botUsername: normalizeUsername(
      firstEnv("TELEGRAM_BOT_USERNAME_DEV", "TELEGRAM_BOT_USERNAME"),
    ),
    webhookSecret: firstEnv("TELEGRAM_WEBHOOK_SECRET_DEV", "TELEGRAM_WEBHOOK_SECRET"),
  };
}

export function requireTelegramConfig(): {
  environment: TelegramRuntimeEnvironment;
  botToken: string;
  botUsername: string;
} {
  const config = getTelegramConfig();

  if (!config.botToken) {
    throw new Error(
      `Telegram bot token is not configured for ${config.environment}. ` +
        `Expected ${config.environment === "PROD" ? "TELEGRAM_BOT_TOKEN_PROD" : "TELEGRAM_BOT_TOKEN_DEV"}.`,
    );
  }

  if (!config.botUsername) {
    throw new Error(
      `Telegram bot username is not configured for ${config.environment}. ` +
        `Expected ${config.environment === "PROD" ? "TELEGRAM_BOT_USERNAME_PROD" : "TELEGRAM_BOT_USERNAME_DEV"}.`,
    );
  }

  return {
    environment: config.environment,
    botToken: config.botToken,
    botUsername: config.botUsername,
  };
}

export function getTelegramBotProfileUrl(username: string): string {
  return `https://t.me/${username.replace(/^@/, "")}`;
}
