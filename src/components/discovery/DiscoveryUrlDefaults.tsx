"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const INTENT_SEGMENTS = new Set(["kuda", "classes", "birthday", "routes"]);

/**
 * На страницах discovery без даты в query — подставляем preset=TODAY (реактивно в URL).
 */
export function DiscoveryUrlDefaults() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length < 2) return;
    if (!INTENT_SEGMENTS.has(parts[1])) return;

    const hasDate =
      searchParams.has("preset") ||
      searchParams.has("from") ||
      searchParams.has("to");
    if (hasDate) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", "TODAY");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}
