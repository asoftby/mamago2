import "server-only";

import { getConfiguredPublicAppUrl } from "@/lib/config/publicAppUrl";
import { isProductionAppEnv } from "@/lib/config/productionEnvGuard";
import { getTelegramConfig, type TelegramRuntimeEnvironment } from "@/server/config/telegram.config";
import { TelegramChannel } from "@/server/services/telegram/TelegramChannel";

export const TELEGRAM_WEBHOOK_PATH = "/api/bot/webhook";

const NGROK_API_URL = "http://localhost:4040/api/tunnels";
const NGROK_API_TIMEOUT_MS = 1_500;

/**
 * Webhook URL check result.
 * - ok: webhook points at the expected origin + path
 * - mismatch: expected origin is known, webhook points elsewhere
 * - tunnel_not_found: LOCAL only — ngrok API on :4040 is unreachable
 * - unknown: no public URL and (PROD, or local without a tunnel)
 */
export type TelegramWebhookUrlStatus =
  | { kind: "ok"; expectedOrigin: string }
  | { kind: "mismatch"; expectedOrigin: string }
  | { kind: "tunnel_not_found" }
  | { kind: "unknown" };

export type TelegramDiagnostics = {
  environment: TelegramRuntimeEnvironment;
  botUsername: string | null;
  configuredBotUsername: string | null;
  botError: string | null;
  webhook: {
    url: string;
    pendingUpdateCount: number;
    lastErrorMessage: string | null;
    lastErrorDate: string | null;
  } | null;
  webhookError: string | null;
  secretConfigured: boolean;
  expectedWebhookUrl: string | null;
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

function isLocalPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "mamago.local" ||
    host.endsWith(".local")
  );
}

/**
 * Expected webhook origin:
 * - deployed DEV/STAGING/PROD: APP_PUBLIC_URL / NEXT_PUBLIC_APP_URL
 * - LOCAL laptop: ngrok/cloudflared tunnel, not mamago.local
 */
export function resolveConfiguredWebhookOrigin(): string | null {
  const configured = getConfiguredPublicAppUrl();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (isLocalPublicHostname(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function resolveExpectedWebhookOrigin(): Promise<string | "tunnel_not_found" | null> {
  const configuredOrigin = resolveConfiguredWebhookOrigin();
  if (configuredOrigin) return configuredOrigin;
  if (isProductionAppEnv()) return null;
  return findDevTunnelOrigin();
}

async function resolveWebhookUrlStatus(
  _environment: TelegramRuntimeEnvironment,
  webhookUrl: string | null,
): Promise<TelegramWebhookUrlStatus> {
  const expected = await resolveExpectedWebhookOrigin();
  if (expected === "tunnel_not_found") return { kind: "tunnel_not_found" };
  if (!expected) return { kind: "unknown" };
  const matches = webhookUrl === `${expected}${TELEGRAM_WEBHOOK_PATH}`;
  return { kind: matches ? "ok" : "mismatch", expectedOrigin: expected };
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
  const expectedWebhookUrl =
    urlStatus.kind === "ok" || urlStatus.kind === "mismatch"
      ? `${urlStatus.expectedOrigin}${TELEGRAM_WEBHOOK_PATH}`
      : null;

  return {
    environment: config.environment,
    botUsername,
    configuredBotUsername: config.botUsername,
    botError,
    webhook,
    webhookError,
    secretConfigured: Boolean(config.webhookSecret),
    expectedWebhookUrl,
    urlStatus,
  };
}
