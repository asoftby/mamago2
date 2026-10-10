"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { getNavIconButtonClassName } from "@/components/mobile/NavIconButton";

/**
 * «←» внутренних страниц: `router.back()`, а если истории нет (страница открыта по прямой
 * ссылке) — переход на главную города.
 */
export function MobileHeaderBackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Назад"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className={getNavIconButtonClassName({ isActive: false, chrome: "dark", size: "compact" })}
    >
      <ArrowLeft className="h-5 w-5 text-gray-700" aria-hidden />
    </button>
  );
}
