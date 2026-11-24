"use client";

import { useRouter } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { canUseHistoryBack } from "@/hooks/useSmartBack";
import { resolveSurfaceFromHostAndPathname } from "@/lib/routing/surface";

type Props = {
  fallbackHref: string;
  className?: string;
  ariaLabel?: string;
};

function getSurfaceEntryFallback(currentPathname: string, fallbackHref: string): string {
  if (typeof window === "undefined") {
    return fallbackHref;
  }

  if (fallbackHref !== currentPathname) {
    return fallbackHref;
  }

  const surface = resolveSurfaceFromHostAndPathname(
    window.location.host,
    currentPathname,
  );

  if (surface === "business") {
    return "/dashboard";
  }

  if (surface === "admin") {
    return "/";
  }

  return "/me";
}

/**
 * Smart history back that falls back to a surface entry when history is unsafe.
 * Visuals come from the canonical `BackButton`.
 */
export function HistoryBackButton({
  fallbackHref,
  className,
  ariaLabel = "Назад",
}: Props) {
  const router = useRouter();

  const handleClick = () => {
    if (canUseHistoryBack()) {
      router.back();
      return;
    }

    const currentPathname =
      typeof window === "undefined" ? fallbackHref : window.location.pathname;

    router.push(getSurfaceEntryFallback(currentPathname, fallbackHref));
  };

  return (
    <BackButton
      aria-label={ariaLabel}
      className={className}
      onClick={handleClick}
    />
  );
}
