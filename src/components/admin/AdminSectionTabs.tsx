"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AdminSectionNavConfig } from "@/lib/admin/adminSectionNav";
import {
  getActiveAdminSectionNavItem,
  isAdminSectionNavItemActive,
} from "@/lib/admin/adminSectionNav";

interface AdminSectionTabsProps {
  config: AdminSectionNavConfig;
  className?: string;
}

export function AdminSectionTabs({
  config,
  className,
}: AdminSectionTabsProps) {
  const pathname = usePathname();
  const activeItem = getActiveAdminSectionNavItem(pathname, config);

  return (
    <div className={cn("border-b border-gray-200 bg-white", className)}>
      <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-6 py-3">
        {config.items.map((item) => {
          const isActive = activeItem
            ? activeItem.id === item.id
            : isAdminSectionNavItemActive(pathname, item);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                isActive
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
