"use client";

import type { ReactNode } from "react";
import { openCookiePreferences } from "@/lib/cookies/consent-manager";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  children?: ReactNode;
};

/**
 * Ссылка в футере: открывает модалку настроек CookieConsent.
 */
export function CookieSettingsFooterLink({
  className,
  children = "Настройки cookies",
}: Props) {
  return (
    <button
      type="button"
      onClick={() => openCookiePreferences()}
      className={cn(
        "text-left text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-0 p-0 font-inherit",
        className,
      )}
    >
      {children}
    </button>
  );
}
