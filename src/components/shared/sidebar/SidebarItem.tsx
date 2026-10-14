"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { buildCurrentBrowserCompatibleDestination } from "@/lib/routing/clientNavigation";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  variant?: "primary" | "secondary";
  sidebarVariant?: "admin" | "business";
  onClick?: () => void;
  hasAttention?: boolean;
  /** Числовой бейдж справа от подписи (0 — не показывать). */
  badgeCount?: number;
}

export function SidebarItem({
  href,
  icon: Icon,
  label,
  isActive,
  variant = "primary",
  sidebarVariant = "admin",
  onClick,
  hasAttention = false,
  badgeCount = 0,
}: SidebarItemProps) {
  const compatibleHref = buildCurrentBrowserCompatibleDestination(href);

  const handleClick = () => {
    // Call onClick immediately before navigation
    if (onClick) {
      onClick();
    }
  };

  if (variant === "secondary") {
    const secondaryStateClass =
      sidebarVariant === "business"
        ? isActive
          ? "bg-[#F5FBFE] text-slate-900"
          : "text-slate-500 hover:bg-[#F5FBFE] hover:text-slate-900"
        : isActive
          ? "bg-slate-50 text-slate-900"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900";

    return (
      <Link
        href={compatibleHref}
        onClick={handleClick}
        suppressHydrationWarning
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
          "ml-3",
          secondaryStateClass
        )}
      >
        <div className="relative flex flex-col items-center">
          {hasAttention && (
            <span className="mb-[3px] w-1 h-1 bg-red-500 rounded-full flex-shrink-0" />
          )}
          <Icon className="w-4 h-4 flex-shrink-0" />
        </div>
        <span>{label}</span>
      </Link>
    );
  }

  const primaryStateClass =
    sidebarVariant === "business"
      ? isActive
        ? "bg-[#EAF7FC] text-slate-950"
        : "text-slate-600 hover:bg-sky-50 hover:text-slate-950"
      : isActive
        ? "bg-slate-100 text-slate-950"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950";

  const primaryIconClass =
    sidebarVariant === "business"
      ? isActive
        ? "text-sky-700"
        : "text-current"
      : isActive
        ? "text-slate-700"
        : "text-current";

  return (
    <Link
      href={compatibleHref}
      onClick={handleClick}
      suppressHydrationWarning
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-150",
        primaryStateClass
      )}
    >
      <div className="relative flex flex-col items-center">
        {hasAttention && (
          <span className="mb-[3px] w-1 h-1 bg-red-500 rounded-full flex-shrink-0" />
        )}
        <Icon
          className={cn(
            "w-5 h-5 flex-shrink-0",
            primaryIconClass
          )}
        />
      </div>
      <span className={isActive ? "font-semibold" : undefined}>{label}</span>
      {badgeCount > 0 && (
        <span
          className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold leading-5 text-white"
          aria-label={`Требуют ответа: ${badgeCount}`}
          data-testid="sidebar-item-badge"
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </Link>
  );
}
