"use client";

/**
 * Условная загрузка **сторонних** рекламных/маркетинговых скриптов (Meta Pixel, TikTok и т.д.).
 * Только при согласии категории `marketing`. Не связана с продуктовой телеметрией mamaGo.
 *
 * Перехват через библиотеку:
 *   <script type="text/plain" data-category="marketing" src="..." />
 */
import { useCookieConsent } from "@/hooks/use-cookie-consent";

export function MarketingLoader() {
  const { canUseMarketing } = useCookieConsent();

  if (!canUseMarketing) {
    return null;
  }

  return (
    <>
      {/* Заглушка: Meta Pixel, TikTok Pixel — добавить после ID рекламных кабинетов */}
    </>
  );
}
