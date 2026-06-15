"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useCityHomeHref } from "@/hooks/useCityHomeHref";

function hasSameOriginReferrer(): boolean {
  if (typeof window === "undefined" || !document.referrer) {
    return false;
  }

  try {
    const referrerUrl = new URL(document.referrer);
    return referrerUrl.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Безопасно ли делать router.back(): пользователь пришёл изнутри сайта
 * (same-origin referrer) и в истории есть куда возвращаться.
 * Вызывать только из клиентских обработчиков.
 */
export function canUseHistoryBack(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return hasSameOriginReferrer() && window.history.length > 1;
}

export function useSmartBack(fallbackHref?: string) {
  const router = useRouter();
  const cityHomeHref = useCityHomeHref();
  const resolvedFallbackHref = fallbackHref ?? cityHomeHref;

  return useCallback(() => {
    if (canUseHistoryBack()) {
      router.back();
      return;
    }

    router.push(resolvedFallbackHref);
  }, [resolvedFallbackHref, router]);
}
