import "server-only";

import { getTelegramConfig, type TelegramRuntimeEnvironment } from "@/server/config/telegram.config";
import { TelegramChannel } from "@/server/services/telegram/TelegramChannel";

export const TELEGRAM_WEBHOOK_PATH = "/api/bot/webhook";

const NGROK_API_URL = "http://localhost:4040/api/tunnels";
const NGROK_API_TIMEOUT_MS = 1_500;

/**
 * Webhook URL check result.
 * - ok: webhook points at the expected origin + path
 * - mismatch: expected origin is known, webhook points elsewhere
 * - tunnel_not_found: DEV only — ngrok API on :4040 is unreachable
 * - unknown: PROD without NEXT_PUBLIC_APP_URL configured
 */
export type TelegramWebhookUrlStatus =
  | { kind: "ok"; expectedOrigin: string }
  | { kind: "mismatch"; expectedOrigin: string }
  | { kind: "tunnel_not_found" }
  | { kind: "unknown" };

export type TelegramDiagnostics = {
  environment: TelegramRuntimeEnvironment;
  botUsername: string | null;
  botError: string | null;
  webhook: {
    url: string;
    pendingUpdateCount: number;
    lastErrorMessage: string | null;
    lastErrorDate: string | null;
  } | null;
  webhookError: string | null;
  secretConfigured: boolean;
  urlStatus: TelegramWebhookUrlStatus;
};

type NgrokTunnel = {
  public_url?: string;
  config?: { addr?: string };
};

async function findDevTunnelOrigin(): Promise<string | "tunnel_not_found"> {
  const devPort = process.env.PORT?.trim() || "3000";
  try {
    const response = await fetch(NGROK_API_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(NGROK_API_TIMEOUT_MS),
    });
    if (!response.ok) return "tunnel_not_found";
    const json = (await response.json()) as { tunnels?: NgrokTunnel[] };
    for (const tunnel of json.tunnels ?? []) {
      const publicUrl = tunnel.public_url ?? "";
      const addrPort = (tunnel.config?.addr ?? "").split(":").pop();
      if (publicUrl.startsWith("https") && addrPort === devPort) {
        return new URL(publicUrl).origin;
      }
    }
    return "tunnel_not_found";
  } catch {
    return "tunnel_not_found";
  }
}

function resolveProdExpectedOrigin(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return null;
  try {
    return new URL(appUrl).origin;
  } catch {
    return null;
  }
}

async function resolveWebhookUrlStatus(
  environment: TelegramRuntimeEnvironment,
  webhookUrl: string | null,
): Promise<TelegramWebhookUrlStatus> {
  if (environment === "DEV") {
    const tunnelOrigin = await findDevTunnelOrigin();
    if (tunnelOrigin === "tunnel_not_found") return { kind: "tunnel_not_found" };
    const matches = webhookUrl === `${tunnelOrigin}${TELEGRAM_WEBHOOK_PATH}`;
    return { kind: matches ? "ok" : "mismatch", expectedOrigin: tunnelOrigin };
  }

  const expectedOrigin = resolveProdExpectedOrigin();
  if (!expectedOrigin) return { kind: "unknown" };
  const matches = webhookUrl === `${expectedOrigin}${TELEGRAM_WEBHOOK_PATH}`;
  return { kind: matches ? "ok" : "mismatch", expectedOrigin };
}

export async function getTelegramDiagnostics(): Promise<TelegramDiagnostics> {
  const config = getTelegramConfig();
  const channel = new TelegramChannel();

  let botUsername: string | null = null;
  let botError: string | null = null;
  try {
    botUsername = (await channel.getMe()).username;
  } catch (error) {
    botError = error instanceof Error ? error.message : "getMe failed";
  }

  let webhook: TelegramDiagnostics["webhook"] = null;
  let webhookError: string | null = null;
  try {
    const info = await channel.getWebhookInfo();
    webhook = {
      url: info.url,
      pendingUpdateCount: info.pending_update_count,
      lastErrorMessage: info.last_error_message ?? null,
      lastErrorDate: info.last_error_date
        ? new Date(info.last_error_date * 1000).toISOString()
        : null,
    };
  } catch (error) {
    webhookError = error instanceof Error ? error.message : "getWebhookInfo failed";
  }

  const urlStatus = await resolveWebhookUrlStatus(config.environment, webhook?.url ?? null);

  return {
    environment: config.environment,
    botUsername,
    botError,
    webhook,
    webhookError,
    secretConfigured: Boolean(config.webhookSecret),
    urlStatus,
  };
}
