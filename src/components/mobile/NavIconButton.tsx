"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NavIconSize = "default" | "compact";

export type NavIconChrome = "light" | "dark";

export type NavIconButtonProps = {
  href: string;
  isActive: boolean;
  /** Accessible label (no visible text in bar) */
  ariaLabel: string;
  /** Optional badge for account/system notifications — 0 hides */
  badgeCount?: number;
  /** When set, shows avatar instead of children icon */
  avatarUrl?: string | null;
  children?: ReactNode;
  /** Home uses logo image via children=null + isHome */
  isHomeLogo?: boolean;
  logoSrc?: string;
  logoAlt?: string;
  className?: string;
  /** Узкий режим для bottom bar с 5 пунктами */
  size?: NavIconSize;
  /** Тёмный стеклянный бар (MobileBottomNav) */
  chrome?: NavIconChrome;
};

export function getNavIconButtonClassName({
  isActive,
  size = "default",
  className,
  chrome = "light",
}: {
  isActive: boolean;
  size?: NavIconSize;
  className?: string;
  chrome?: NavIconChrome;
}) {
  return cn(
    "relative flex shrink-0 items-center justify-center rounded-full",
    size === "compact" ? "h-11 w-11" : "h-[52px] w-[52px]",
    "border transition-all duration-200 ease-out will-change-transform cursor-pointer touch-manipulation",
    "active:scale-[0.96] active:transition-transform",
    chrome === "dark"
      ? isActive
        ? "border-[#EF8759]/50 bg-[rgba(250,247,241,0.50)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_16px_rgba(239,135,89,0.20)]"
        : "border-[rgba(250,247,241,0.25)] bg-[rgba(250,247,241,0.50)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
      : isActive
        ? "border-[#EF8759]/35 bg-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_14px_rgba(239,135,89,0.18)]"
        : "border-white/70 bg-white/55 shadow-sm shadow-black/[0.04]",
    className,
  );
}

/**
 * Circular glass control for side nav (home / profile).
 * Tap feedback: subtle scale — iOS-like, no hover dependency.
 */
export function NavIconButton({
  href,
  isActive,
  ariaLabel,
  badgeCount = 0,
  avatarUrl,
  children,
  isHomeLogo,
  logoSrc = "/favico_mamago.webp",
  logoAlt = "MamaGo",
  className,
  size = "default",
  chrome = "light",
}: NavIconButtonProps) {
  const showBadge = badgeCount > 0;
  const compact = size === "compact";

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={getNavIconButtonClassName({ isActive, size, className, chrome })}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatar URLs may be arbitrary
        <img
          src={avatarUrl}
          alt=""
          className={cn(
            "rounded-full object-cover ring-1 ring-black/[0.06]",
            compact ? "h-8 w-8" : "h-[37px] w-[37px]",
          )}
        />
      ) : isHomeLogo ? (
        <Image
          src={logoSrc}
          alt={logoAlt}
          width={120}
          height={120}
          className={cn(
            "w-auto object-contain object-center transition-transform duration-200",
            /* compact: как внутренний круг h-9 w-9 у колокольчика / аватар h-8 в bottom bar */
            compact ? "h-9 max-w-[92px]" : "max-w-[85px] h-[34px]",
            isActive && "scale-[1.04]",
          )}
        />
      ) : (
        children
      )}

      {showBadge && (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF8759] px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-2",
            chrome === "dark" ? "ring-neutral-900/95" : "ring-white/90",
          )}
          aria-hidden
        >
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </Link>
  );
}
