"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarItem } from "@/components/shared/sidebar/SidebarItem";
import { SidebarPublicSiteEntry } from "@/components/shared/sidebar/SidebarPublicSiteEntry";
import { SidebarGroup } from "@/components/shared/sidebar/SidebarGroup";
import { SidebarSubItem } from "@/components/shared/sidebar/SidebarSubItem";
import {
  ADMIN_SIDEBAR_CONFIG,
  type AdminSidebarNavItem,
  type AdminSidebarGroup,
} from "@/lib/admin/adminSidebarConfig";
import type { ModerationNavCounts, } from "@/lib/admin/moderationSidebarConfig";
import type { AdminNavMatchRule } from "@/lib/admin/adminSidebarTypes";
import { ADMIN_PATH_PREFIX } from "@/lib/routing/surface";

interface AdminSidebarProps {
  onNavigate?: () => void;
  moderationCounts: ModerationNavCounts;
  b2bPendingVerificationCount?: number;
  importPendingReviewCount?: number;
  reviewsPendingCount?: number;
}

// ─── Active-route helpers ─────────────────────────────────────────────────────

function normalizeAdminNavPath(path: string | null | undefined): string {
  if (!path) return "/";
  if (path === ADMIN_PATH_PREFIX) return "/";
  if (path.startsWith(`${ADMIN_PATH_PREFIX}/`)) {
    return path.slice(ADMIN_PATH_PREFIX.length) || "/";
  }
  return path;
}

function matchesRule(pathname: string, rule: AdminNavMatchRule): boolean {
  const normalizedPathname = normalizeAdminNavPath(pathname);
  const normalizedRuleValue = normalizeAdminNavPath(rule.value);
  if (rule.type === "exact") return normalizedPathname === normalizedRuleValue;
  // Segment-safe prefix: /admin/orders matches /admin/orders/abc but NOT /admin/orders-settings
  return (
    normalizedPathname === normalizedRuleValue ||
    normalizedPathname.startsWith(`${normalizedRuleValue}/`)
  );
}

/** Returns true if the given nav item is "active" for the current pathname. */
function isNavItemActive(pathname: string, item: AdminSidebarNavItem): boolean {
  if (item.matchers?.length) {
    return item.matchers.some((rule) => matchesRule(pathname, rule));
  }
  // Fallback: segment-safe prefix match on href
  const normalizedPathname = normalizeAdminNavPath(pathname);
  const normalizedHref = normalizeAdminNavPath(item.href);
  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
}

/** Returns the children of a top-level config entry regardless of its type. */
function getTopLevelChildren(
  entry: AdminSidebarNavItem | AdminSidebarGroup,
): AdminSidebarNavItem[] {
  // AdminSidebarGroup has no `href`; both types carry `children`
  const children = (entry as AdminSidebarGroup).children;
  return Array.isArray(children) ? children : [];
}

/** True when entry is a group without its own href (AdminSidebarGroup). */
function isGroupEntry(entry: AdminSidebarNavItem | AdminSidebarGroup): entry is AdminSidebarGroup {
  return !("href" in entry);
}

/**
 * Determine which top-level entry should be open based on the current pathname.
 * Returns the entry's `id`, or null if no entry has an active child.
 */
function findActiveGroupId(pathname: string): string | null {
  for (const entry of ADMIN_SIDEBAR_CONFIG) {
    const children = getTopLevelChildren(entry);
    if (children.some((child) => isNavItemActive(pathname, child))) {
      return entry.id;
    }
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminSidebar({
  onNavigate,
  moderationCounts,
  b2bPendingVerificationCount = 0,
  importPendingReviewCount = 0,
  reviewsPendingCount = 0,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const getBadgeCount = (key?: string): number | undefined => {
    if (!key) return undefined;
    const counts: Record<string, number> = {
      queueTotal: moderationCounts.queueTotal,
      b2bPendingVerificationCount,
      importPendingReviewCount,
      reviewsPendingCount,
    };
    return counts[key];
  };

  // ── Accordion state ─────────────────────────────────────────────────────────
  const derivedGroupId = findActiveGroupId(pathname);
  const [openSection, setOpenSection] = useState<string | null>(derivedGroupId);

  useEffect(() => {
    setOpenSection((prev) => {
      if (!derivedGroupId) return prev;
      return derivedGroupId;
    });
  }, [derivedGroupId]);

  function toggleSection(id: string) {
    setOpenSection((prev) => {
      // Don't collapse the section that owns the current page — keeps context.
      if (prev === id && id === derivedGroupId) return id;
      return prev === id ? null : id;
    });
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  /** Render a single nav item (may recurse for nested children). */
  const renderNavItem = (item: AdminSidebarNavItem, level = 0) => {
    const active = isNavItemActive(pathname, item);
    const childIsActive = item.children?.some((c) => isNavItemActive(pathname, c)) ?? false;

    if (item.children?.length) {
      return (
        <SidebarGroup
          key={item.id}
          icon={item.icon!}
          label={item.label}
          sidebarVariant="admin"
          isActive={active || childIsActive}
          isOpen={openSection === item.id}
          onToggle={() => toggleSection(item.id)}
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
          isActive={active}
          sidebarVariant="admin"
          onClick={onNavigate}
          count={getBadgeCount(item.badgeCountKey)}
        />
      );
    }

    // Top-level standalone item with its own icon
    const count = getBadgeCount(item.badgeCountKey);
    return (
      <SidebarItem
        key={item.id}
        href={item.href}
        icon={item.icon}
        label={item.label}
        isActive={active}
        sidebarVariant="admin"
        onClick={onNavigate}
        hasAttention={count !== undefined && count > 0}
      />
    );
  };

  return (
    <aside className="w-full lg:w-[260px] bg-white">
      <nav className="flex flex-col gap-1.5 p-4">
        <SidebarPublicSiteEntry onNavigate={onNavigate} />

        {ADMIN_SIDEBAR_CONFIG.map((entry) => {
          if (isGroupEntry(entry)) {
            // AdminSidebarGroup — collapsible with no own href
            const groupHasActive = getTopLevelChildren(entry).some((child) =>
              isNavItemActive(pathname, child)
            );
            return (
              <SidebarGroup
                key={entry.id}
                icon={entry.icon}
                label={entry.label}
                sidebarVariant="admin"
                isActive={groupHasActive}
                isOpen={openSection === entry.id}
                onToggle={() => toggleSection(entry.id)}
              >
                {entry.children.map((child) => renderNavItem(child))}
              </SidebarGroup>
            );
          }

          // AdminSidebarNavItem — standalone or with nested children
          return renderNavItem(entry as AdminSidebarNavItem);
        })}
      </nav>
    </aside>
  );
}
