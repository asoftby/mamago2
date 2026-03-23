"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
};

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
}: NavIconButtonProps) {
  const showBadge = badgeCount > 0;

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        "relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full",
        "border transition-all duration-200 ease-out will-change-transform",
        "active:scale-[0.96] active:transition-transform",
        isActive
          ? "border-[#EF8759]/35 bg-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_14px_rgba(239,135,89,0.18)]"
          : "border-white/70 bg-white/55 shadow-sm shadow-black/[0.04]",
        className,
      )}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatar URLs may be arbitrary
        <img
          src={avatarUrl}
          alt=""
          className="h-[37px] w-[37px] rounded-full object-cover ring-1 ring-black/[0.06]"
        />
      ) : isHomeLogo ? (
        <Image
          src={logoSrc}
          alt={logoAlt}
          width={120}
          height={120}
          className={cn(
            "h-[34px] w-auto max-w-[85px] object-contain object-center transition-transform duration-200",
            isActive && "scale-[1.04]",
          )}
        />
      ) : (
        children
      )}

      {showBadge && (
        <span
          className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF8759] px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-2 ring-white/90"
          aria-hidden
        >
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </Link>
  );
}
