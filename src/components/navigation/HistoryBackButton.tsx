"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { resolveSurfaceFromHostAndPathname } from "@/lib/routing/surface";

type Props = {
  fallbackHref: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
};

function hasSameOriginReferrer() {
  if (typeof window === "undefined") return false;
  if (!document.referrer) return false;

  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin;
  } catch {
    return false;
  }
}

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

export function HistoryBackButton({
  fallbackHref,
  className,
  children,
  ariaLabel = "Назад",
}: Props) {
  const router = useRouter();

  const handleClick = () => {
    if (hasSameOriginReferrer()) {
      router.back();
      return;
    }

    const currentPathname =
      typeof window === "undefined" ? fallbackHref : window.location.pathname;

    router.push(getSurfaceEntryFallback(currentPathname, fallbackHref));
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={handleClick}
      className={className}
    >
      {children}
    </button>
  );
}
