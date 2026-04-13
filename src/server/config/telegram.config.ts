import "server-only";

export type TelegramRuntimeEnvironment = "DEV" | "PROD";

type TelegramConfig = {
  environment: TelegramRuntimeEnvironment;
  botToken: string | null;
  botUsername: string | null;
  webhookSecret: string | null;
};

export function getTelegramRuntimeEnvironment(): TelegramRuntimeEnvironment {
  return process.env.NODE_ENV === "production" ? "PROD" : "DEV";
}

function normalizeUsername(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^@/, "");
}

export function getTelegramConfig(): TelegramConfig {
  const environment = getTelegramRuntimeEnvironment();

  if (environment === "PROD") {
    return {
      environment,
      botToken: process.env.TELEGRAM_BOT_TOKEN_PROD?.trim() || null,
      botUsername: normalizeUsername(process.env.TELEGRAM_BOT_USERNAME_PROD),
      webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET_PROD?.trim() || null,
    };
  }

  return {
    environment,
    botToken: process.env.TELEGRAM_BOT_TOKEN_DEV?.trim() || null,
    botUsername: normalizeUsername(process.env.TELEGRAM_BOT_USERNAME_DEV),
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET_DEV?.trim() || null,
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
