export type PublicSocialKey = "instagram" | "tiktok" | "telegram";

/** Если в .env не задано — чтобы в футере всегда были три иконки. Переопределите через NEXT_PUBLIC_SOCIAL_*. */
const FALLBACK_SOCIAL: Record<PublicSocialKey, string> = {
  instagram: "https://www.instagram.com/mamago.by/",
  tiktok: "https://www.tiktok.com/@mamago.by",
  telegram: "https://t.me/mamago_2_bot",
};

function telegramHrefFromBotConfig(): string | null {
  const full = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL?.trim();
  if (full?.startsWith("http")) return full;
  const name = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();
  if (name) return `https://t.me/${name.replace(/^@/, "")}`;
  return null;
}

/**
 * Ссылки на публичные соцсети (футер).
 * Env переопределяет значения; иначе — FALLBACK_SOCIAL (и для Telegram ещё настройки бота).
 */
export function getPublicSocialLinks(): { key: PublicSocialKey; href: string }[] {
  const instagram =
    process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL?.trim() || FALLBACK_SOCIAL.instagram;
  const tiktok =
    process.env.NEXT_PUBLIC_SOCIAL_TIKTOK_URL?.trim() || FALLBACK_SOCIAL.tiktok;
  const telegramExplicit = process.env.NEXT_PUBLIC_SOCIAL_TELEGRAM_URL?.trim();
  const telegram =
    (telegramExplicit && telegramExplicit.length > 0
      ? telegramExplicit
      : telegramHrefFromBotConfig()) ?? FALLBACK_SOCIAL.telegram;

  return [
    { key: "instagram", href: instagram },
    { key: "tiktok", href: tiktok },
    { key: "telegram", href: telegram },
  ];
}
