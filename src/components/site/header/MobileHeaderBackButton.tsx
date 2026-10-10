"use client";

import { ArrowLeft } from "lucide-react";
import { useSmartBack } from "@/hooks/useSmartBack";
import { getNavIconButtonClassName } from "@/components/mobile/NavIconButton";

/**
 * «←» внутренних страниц: `router.back()` только если предыдущая запись истории принадлежит mamaGo
 * (`useSmartBack`), иначе (прямая ссылка, внешний реферер) — переход на главную города.
 */
export function MobileHeaderBackButton({ fallbackHref }: { fallbackHref: string }) {
  const goBack = useSmartBack(fallbackHref);
  return (
    <button
      type="button"
      aria-label="Назад"
      onClick={goBack}
      className={getNavIconButtonClassName({ isActive: false, chrome: "dark", size: "compact" })}
    >
      <ArrowLeft className="h-5 w-5 text-gray-400" aria-hidden />
    </button>
  );
}
