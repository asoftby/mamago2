"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface SidebarSubItemProps {
  href: string;
  label: string;
  isActive: boolean;
  onClick?: () => void;
  count?: number;
}

export function SidebarSubItem({ href, label, isActive, onClick, count }: SidebarSubItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      suppressHydrationWarning
      className={cn(
        "relative flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
        "ml-11",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      {/* Left accent stripe */}
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-primary"
          aria-hidden
        />
      )}
      <span className={isActive ? "font-semibold" : undefined}>{label}</span>
      {count !== undefined && count > 0 && (
        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-semibold rounded-full">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
