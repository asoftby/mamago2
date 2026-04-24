import { adminPath } from "@/lib/routing/surface";
import type { AdminSectionNavConfig } from "./adminSectionNav";

export const IMPORT_SECTION_NAV_CONFIG: AdminSectionNavConfig = {
  id: "import",
  label: "Импорт",
  href: adminPath("/import"),
  items: [
    {
      id: "overview",
      label: "Обзор",
      href: adminPath("/import"),
      matchers: [{ type: "exact", value: adminPath("/import") }],
    },
    {
      id: "sources",
      label: "Источники",
      href: adminPath("/import/sources"),
      matchers: [{ type: "prefix", value: adminPath("/import/sources") }],
    },
    {
      id: "runs",
      label: "Запуски",
      href: adminPath("/import/runs"),
      matchers: [{ type: "prefix", value: adminPath("/import/runs") }],
    },
    {
      id: "queue",
      label: "Очередь",
      href: adminPath("/import/review"),
      matchers: [{ type: "prefix", value: adminPath("/import/review") }],
      badgeCountKey: "importPendingReviewCount",
    },
    {
      id: "debug",
      label: "Debug",
      href: adminPath("/import/debug/parser"),
      matchers: [{ type: "prefix", value: adminPath("/import/debug") }],
    },
  ],
};

// Re-export for sidebar config
export { IMPORT_SECTION_NAV_CONFIG as IMPORT_SECTION_NAV_CONFIG };
