"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface SidebarSubItemProps {
  href: string;
  label: string;
  isActive: boolean;
  sidebarVariant?: "admin" | "business";
  onClick?: () => void;
  count?: number;
}

export function SidebarSubItem({
  href,
  label,
  isActive,
  sidebarVariant = "admin",
  onClick,
  count,
}: SidebarSubItemProps) {
  const subItemStateClass =
    sidebarVariant === "business"
      ? isActive
        ? "bg-[#F5FBFE] text-slate-900"
        : "text-slate-500 hover:bg-[#F5FBFE] hover:text-slate-900"
      : isActive
        ? "bg-slate-50 text-slate-900"
        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900";

  return (
    <Link
      href={href}
      onClick={onClick}
      suppressHydrationWarning
      className={cn(
        "flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors duration-150",
        "ml-11",
        subItemStateClass
      )}
    >
      <span className={isActive ? "font-semibold" : undefined}>{label}</span>
      {count !== undefined && count > 0 && (
        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-semibold rounded-full">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
