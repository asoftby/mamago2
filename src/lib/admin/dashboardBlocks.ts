/**
 * /admin modular dashboard block registry (frozen block ID/order/size set).
 *
 * Code-defined only in v1 — no DB-persisted preferences, no drag-and-drop,
 * no per-user customization. Kept as a small, explicit, independently
 * addressable registry (not baked into page.tsx) so that persisted
 * order/enabled/size preferences can be layered on later without
 * rewriting the dashboard composition.
 */
import { adminPath } from "@/lib/routing/surface";

export type AdminDashboardBlockId =
  | "operations"
  | "traffic"
  | "product"
  | "engagement"
  | "search"
  | "workload"
  | "retention"
  | "finance";

export type AdminDashboardBlockSize = "medium" | "wide";

export interface AdminDashboardBlockDefinition {
  id: AdminDashboardBlockId;
  enabled: boolean;
  order: number;
  size: AdminDashboardBlockSize;
  title: string;
  /** Detailed admin destination, when one exists. */
  href?: string;
}

export const ADMIN_DASHBOARD_BLOCKS: readonly AdminDashboardBlockDefinition[] = [
  { id: "operations", enabled: true, order: 10, size: "wide", title: "Operations" },
  { id: "traffic", enabled: true, order: 20, size: "medium", title: "Посещаемость" },
  { id: "product", enabled: true, order: 30, size: "medium", title: "Product Pulse", href: adminPath("/performance") },
  { id: "engagement", enabled: true, order: 40, size: "medium", title: "Использование" },
  { id: "search", enabled: true, order: 50, size: "medium", title: "Поиск и Discovery", href: adminPath("/search") },
  { id: "workload", enabled: true, order: 60, size: "medium", title: "Операционная нагрузка" },
  { id: "retention", enabled: false, order: 70, size: "medium", title: "Retention" },
  { id: "finance", enabled: false, order: 80, size: "medium", title: "Finance" },
];

export function getEnabledDashboardBlocks(): AdminDashboardBlockDefinition[] {
  return ADMIN_DASHBOARD_BLOCKS.filter((b) => b.enabled).slice().sort((a, b) => a.order - b.order);
}

export function getDashboardBlock(id: AdminDashboardBlockId): AdminDashboardBlockDefinition {
  const block = ADMIN_DASHBOARD_BLOCKS.find((b) => b.id === id);
  if (!block) throw new Error(`Unknown dashboard block id: ${id}`);
  return block;
}
