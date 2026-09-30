"use client";

import type { ReactNode } from "react";
import { Cookie } from "lucide-react";
import { openCookiePreferences } from "@/lib/cookies/consent-manager";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  children?: ReactNode;
  iconOnly?: boolean;
};

/**
 * Ссылка в футере: открывает модалку настроек CookieConsent.
 */
export function CookieSettingsFooterLink({
  className,
  children = "Настройки cookies",
  iconOnly = false,
}: Props) {
  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={() => openCookiePreferences()}
        aria-label="Настройки cookies"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 hover:text-primary",
          className,
        )}
      >
        <Cookie className="h-4 w-4" aria-hidden />
      </button>
    );
  }

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
