"use client";

import { BackButton } from "@/components/ui/back-button";
import { useSmartBack } from "@/hooks/useSmartBack";

/**
 * «←» внутренних страниц: `router.back()` только если предыдущая запись истории принадлежит mamaGo
 * (`useSmartBack`), иначе (прямая ссылка, внешний реферер) — переход на главную города.
 * Visuals: canonical circular `BackButton`.
 */
export function MobileHeaderBackButton({ fallbackHref }: { fallbackHref: string }) {
  const goBack = useSmartBack(fallbackHref);
  return <BackButton aria-label="Назад" onClick={goBack} />;
}
