import "server-only";
import { getTelegramRuntimeEnvironment } from "./telegram.config";

export function getBusinessTelegramConfig() {
  const environment = getTelegramRuntimeEnvironment();
  const suffix = environment === "PROD" ? "PROD" : "DEV";
  // No fallback to family bot: fail closed when business bot is unconfigured.
  const botToken = process.env[`TELEGRAM_BUSINESS_BOT_TOKEN_${suffix}`]?.trim() ?? "";
  const botUsername = process.env[`TELEGRAM_BUSINESS_BOT_USERNAME_${suffix}`]?.trim().replace(/^@/, "") ?? "";
  const webhookSecret = process.env[`TELEGRAM_BUSINESS_WEBHOOK_SECRET_${suffix}`]?.trim() ?? "";
  return { environment, botToken, botUsername, webhookSecret, configured: Boolean(botToken && botUsername && webhookSecret) };
}
