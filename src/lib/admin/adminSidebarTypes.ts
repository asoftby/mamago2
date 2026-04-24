import type { LucideIcon } from "lucide-react";

/**
 * Match rule for determining if a nav item is active
 */
export type AdminNavMatchRule =
  | { type: "exact"; value: string }
  | { type: "prefix"; value: string };

/**
 * Single navigation item (can be standalone or inside a group)
 */
export interface AdminSidebarNavItem {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  children?: AdminSidebarNavItem[];
  matchers?: AdminNavMatchRule[];
  badgeCountKey?: string;
}

/**
 * Collapsible group container
 */
export interface AdminSidebarGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  children: AdminSidebarNavItem[];
  defaultOpen?: boolean;
  hasAttention?: boolean;
}

/**
 * Badge counts loaded from server
 */
export interface AdminSidebarBadgeCounts {
  queueTotal?: number;
  b2bPendingVerificationCount?: number;
  importPendingReviewCount?: number;
}
