"use client";

import { BackButton } from "@/components/ui/back-button";
import { useSmartBack } from "@/hooks/useSmartBack";
import { cn } from "@/lib/utils";

type MobileSmartBackButtonProps = {
  fallbackHref?: string;
  /** Accessible name only — no visible text on the canonical back control. */
  label?: string;
  className?: string;
};

/**
 * Единая мобильная кнопка «Назад» для публичных detail-страниц.
 * Внутренний переход → router.back(), внешний/прямой заход → fallbackHref.
 * Видна, пока используется MobileHeader — весь диапазон `< lg` (lg:hidden).
 * Visuals: canonical circular `BackButton`.
 */
export function MobileSmartBackButton({
  fallbackHref,
  label = "Назад",
  className,
}: MobileSmartBackButtonProps) {
  const goBack = useSmartBack(fallbackHref);

  return (
    <BackButton
      aria-label={label}
      onClick={goBack}
      className={cn("lg:hidden", className)}
    />
  );
}
