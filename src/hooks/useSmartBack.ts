"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useCityHomeHref } from "@/hooks/useCityHomeHref";
import { hasInternalHistoryBackEntry } from "@/lib/navigation/internalHistory";

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
 * Безопасно ли делать router.back(): предыдущая запись истории принадлежит
 * mamaGo — либо это same-origin document referrer, либо запись была создана
 * Next.js client navigation внутри текущего документа.
 * Вызывать только из клиентских обработчиков.
 */
export function canUseHistoryBack(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.history.length > 1 &&
    (hasInternalHistoryBackEntry() || hasSameOriginReferrer())
  );
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
