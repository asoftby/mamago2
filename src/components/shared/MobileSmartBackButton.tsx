"use client";

import { ArrowLeft } from "lucide-react";
import { useSmartBack } from "@/hooks/useSmartBack";
import { cn } from "@/lib/utils";

type MobileSmartBackButtonProps = {
  fallbackHref?: string;
  label?: string;
  className?: string;
};

/**
 * Единая мобильная кнопка «Назад» для публичных detail-страниц.
 * Внутренний переход → router.back(), внешний/прямой заход → fallbackHref.
 * Видна только на mobile (md:hidden).
 */
export function MobileSmartBackButton({
  fallbackHref,
  label = "Назад",
  className,
}: MobileSmartBackButtonProps) {
  const goBack = useSmartBack(fallbackHref);

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-white hover:text-gray-950 md:hidden",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
