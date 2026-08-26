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
  | "northStar"
  | "engagement"
  | "search"
  | "workload"
  | "habit"
  | "funnel"
  | "growth"
  | "supply"
  | "b2b"
  | "dataQuality"
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

/**
 * `order` reflects the dashboard rework's row plan (Company Pulse -> Habit
 * -> Funnel -> Growth -> Discovery/Supply -> B2B -> Operations/Data
 * Quality) — see the /admin dashboard plan. `AdminDashboardShell` composes
 * rows explicitly in JSX (not by iterating this list), so `order` here is
 * documentation/lookup metadata, not the actual render driver; keep it in
 * sync with the shell's JSX order when either changes.
 *
 * `traffic` and `engagement` are disabled (not deleted) — their raw
 * pageview/rolling-event-count numbers are exactly the "vanity" figures
 * the product spec bans from the first screen (§14); the data they're
 * built on stays available in `/admin/analytics` and Operations' own kpis.
 */
export const ADMIN_DASHBOARD_BLOCKS: readonly AdminDashboardBlockDefinition[] = [
  { id: "product", enabled: true, order: 10, size: "medium", title: "Product Pulse", href: adminPath("/performance") },
  { id: "northStar", enabled: true, order: 15, size: "medium", title: "Weekly Planning Families" },
  { id: "habit", enabled: true, order: 20, size: "wide", title: "Habit & Retention" },
  { id: "funnel", enabled: true, order: 30, size: "wide", title: "Core Value Funnel" },
  { id: "growth", enabled: true, order: 40, size: "wide", title: "Рост" },
  { id: "search", enabled: true, order: 50, size: "medium", title: "Поиск и Discovery", href: adminPath("/search") },
  { id: "supply", enabled: true, order: 55, size: "medium", title: "Supply Health" },
  { id: "b2b", enabled: true, order: 60, size: "wide", title: "B2B Health" },
  { id: "workload", enabled: true, order: 80, size: "medium", title: "Операционная нагрузка" },
  { id: "dataQuality", enabled: true, order: 85, size: "medium", title: "Data Quality" },
  { id: "operations", enabled: true, order: 90, size: "wide", title: "Operations" },
  { id: "traffic", enabled: false, order: 900, size: "medium", title: "Посещаемость" },
  { id: "engagement", enabled: false, order: 901, size: "medium", title: "Использование" },
  { id: "finance", enabled: false, order: 902, size: "medium", title: "Finance" },
];

export function getEnabledDashboardBlocks(): AdminDashboardBlockDefinition[] {
  return ADMIN_DASHBOARD_BLOCKS.filter((b) => b.enabled).slice().sort((a, b) => a.order - b.order);
}

export function getDashboardBlock(id: AdminDashboardBlockId): AdminDashboardBlockDefinition {
  const block = ADMIN_DASHBOARD_BLOCKS.find((b) => b.id === id);
  if (!block) throw new Error(`Unknown dashboard block id: ${id}`);
  return block;
}
