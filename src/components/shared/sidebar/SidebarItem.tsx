"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  hasAttention?: boolean;
}

export function SidebarItem({
  href,
  icon: Icon,
  label,
  isActive,
  variant = "primary",
  onClick,
  hasAttention = false,
}: SidebarItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    // Call onClick immediately before navigation
    if (onClick) {
      onClick();
    }
  };

  if (variant === "secondary") {
    return (
      <Link
        href={href}
        onClick={handleClick}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
          "ml-3",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-gray-100 text-gray-900"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <div className="relative flex flex-col items-center">
        {hasAttention && (
          <span className="mb-[3px] w-1 h-1 bg-red-500 rounded-full flex-shrink-0" />
        )}
        <Icon className="w-5 h-5 flex-shrink-0" />
      </div>
      <span>{label}</span>
    </Link>
  );
}
