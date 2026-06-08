"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

function shouldUseHistoryBack(referrer: string): boolean {
  if (typeof window === "undefined" || !referrer) {
    return false;
  }

  try {
    const referrerUrl = new URL(referrer);
    return referrerUrl.host === window.location.host;
  } catch {
    return false;
  }
}

export function useSmartBack(fallbackUrl = "/minsk") {
  const router = useRouter();

  return useCallback(() => {
    if (typeof window === "undefined") {
      router.push(fallbackUrl);
      return;
    }

    if (shouldUseHistoryBack(document.referrer)) {
      router.back();
      return;
    }

    router.push(fallbackUrl);
  }, [fallbackUrl, router]);
}
