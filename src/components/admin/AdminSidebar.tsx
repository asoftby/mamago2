"use client";

import { usePathname } from "next/navigation";
import { SidebarItem } from "@/components/shared/sidebar/SidebarItem";
import { SidebarGroup } from "@/components/shared/sidebar/SidebarGroup";
import { SidebarSubItem } from "@/components/shared/sidebar/SidebarSubItem";
import {
  ADMIN_SIDEBAR_CONFIG,
  type AdminSidebarNavItem,
  type AdminSidebarGroup,
} from "@/lib/admin/adminSidebarConfig";
import type { ModerationNavCounts } from "@/lib/admin/moderationSidebarConfig";

interface AdminSidebarProps {
  onNavigate?: () => void;
  moderationCounts: ModerationNavCounts;
  b2bPendingVerificationCount?: number;
  importPendingReviewCount?: number;
}

export function AdminSidebar({
  onNavigate,
  moderationCounts,
  b2bPendingVerificationCount = 0,
  importPendingReviewCount = 0,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const getBadgeCount = (key?: string) => {
    if (!key) return undefined;
    const counts: Record<string, number> = {
      queueTotal: moderationCounts.queueTotal,
      b2bPendingVerificationCount: b2bPendingVerificationCount,
      importPendingReviewCount: importPendingReviewCount,
    };
    return counts[key];
  };

  const isActive = (href: string) => pathname === href;
  const isGroupActive = (paths: string[]) => paths.some((path) => pathname.startsWith(path));

  // Recursively render nav items
  const renderNavItem = (item: AdminSidebarNavItem, level = 0) => {
    const isActiveItem = isActive(item.href);
    const hasActiveChild = item.children?.some((child) => isActive(child.href) || isActive(item.href));

    if (item.children && item.children.length > 0) {
      // Group with children - render as expandable group
      return (
        <SidebarGroup
          key={item.id}
          icon={item.icon!}
          label={item.label}
          defaultOpen={isActiveItem || hasActiveChild}
        >
          {item.children.map((child) => renderNavItem(child, level + 1))}
        </SidebarGroup>
      );
    }

    if (level > 0 || !item.icon) {
      return (
        <SidebarSubItem
          key={item.id}
          href={item.href}
          label={item.label}
          isActive={isActiveItem}
          onClick={onNavigate}
          count={getBadgeCount(item.badgeCountKey)}
        />
      );
    }

    // Single top-level item - render as icon link
    const count = getBadgeCount(item.badgeCountKey);
    return (
      <SidebarItem
        key={item.id}
        href={item.href}
        icon={item.icon!}
        label={item.label}
        isActive={isActiveItem}
        onClick={onNavigate}
        hasAttention={count !== undefined && count > 0}
      />
    );
  };

  return (
    <aside className="w-full lg:w-[260px] bg-white">
      {/* Navigation */}
      <nav className="flex flex-col gap-1.5 p-4">
        {ADMIN_SIDEBAR_CONFIG.map((item) => {
          if ("children" in item) {
            // It's a group
            const groupItem = item as AdminSidebarGroup;
            return (
              <SidebarGroup
                key={groupItem.id}
                icon={groupItem.icon}
                label={groupItem.label}
                defaultOpen={isGroupActive(groupItem.children.map((c) => c.href))}
              >
                {groupItem.children.map((child) => renderNavItem(child))}
              </SidebarGroup>
            );
          } else {
            // It's a standalone item - use renderNavItem to handle children
            return renderNavItem(item);
          }
        })}
      </nav>
    </aside>
  );
}
