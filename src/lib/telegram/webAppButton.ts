import { getSafeRedirectPath } from "@/lib/auth/redirectTo";

/** Browser opens a normal Telegram URL; mini_app needs signed initData. */
export type TelegramLinkOpenIntent = "browser" | "mini_app";

export type TelegramLinkButton =
  | { text: string; url: string; web_app?: never }
  | { text: string; web_app: { url: string }; url?: never };

/**
 * No account identity or login token is embedded in the link. Telegram itself
 * provides signed initData when the web_app button is opened in a private chat.
 */
export function getSafeTelegramReturnPath(value: string | null | undefined): string {
  const safe = getSafeRedirectPath(value, "/me/plan");
  if (safe.includes("\\") || /[\u0000-\u001f\u007f]/u.test(safe)) return "/me/plan";

  try {
    const parsed = new URL(safe, "https://mamago.invalid");
    if (parsed.origin !== "https://mamago.invalid") return "/me/plan";
    if (
      parsed.pathname.startsWith("/api/") ||
      parsed.pathname === "/api" ||
      parsed.pathname.startsWith("/telegram/open") ||
      parsed.pathname.startsWith("/login") ||
      parsed.pathname.startsWith("/register")
    ) return "/me/plan";
    return parsed.pathname + parsed.search;
  } catch {
    return "/me/plan";
  }
}

export function createTelegramLinkButton(
  text: string,
  targetUrl: string,
  publicBaseUrl: string,
  intent: TelegramLinkOpenIntent,
  campaign?: string,
): TelegramLinkButton {
  const fallback: TelegramLinkButton = { text, url: targetUrl };
  // Browser links retain shareable, canonical destinations. Attribute only
  // first-party HTTPS links, never arbitrary external or unsafe schemes.
  if (intent === "browser") {
    try {
      const base = new URL(publicBaseUrl);
      const target = new URL(targetUrl, base);
      if (base.protocol !== "https:" || target.protocol !== "https:" || target.origin !== base.origin) {
        return fallback;
      }
      if (!target.searchParams.has("utm_source")) target.searchParams.set("utm_source", "telegram");
      if (!target.searchParams.has("utm_medium")) target.searchParams.set("utm_medium", "bot");
      if (campaign && /^[a-z0-9_-]{1,64}$/iu.test(campaign) && !target.searchParams.has("utm_campaign")) {
        target.searchParams.set("utm_campaign", campaign);
      }
      return { text, url: target.toString() };
    } catch {
      return fallback;
    }
  }
  try {
    const base = new URL(publicBaseUrl);
    const target = new URL(targetUrl, base);
    const local = /^(localhost|127\.0\.0\.1)$/u.test(base.hostname) || base.hostname.endsWith(".local");
    if (base.protocol !== "https:" || local || target.origin !== base.origin) return fallback;

    const requestedPath = target.pathname + target.search;
    const next = getSafeTelegramReturnPath(requestedPath);
    // Do not silently change destinations for unsupported internal routes.
    if (next !== requestedPath) return fallback;

    const launcher = new URL("/telegram/open", base);
    launcher.searchParams.set("next", next);
    return { text, web_app: { url: launcher.toString() } };
  } catch {
    return fallback;
  }
}
