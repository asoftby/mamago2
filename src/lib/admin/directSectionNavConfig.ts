import { adminPath } from "@/lib/routing/surface";
import type { AdminSectionNavConfig } from "./adminSectionNav";

export const DIRECT_SECTION_NAV_CONFIG: AdminSectionNavConfig = {
  id: "direct",
  label: "Direct",
  href: adminPath("/communications/direct"),
  items: [
    {
      id: "overview",
      label: "Обзор",
      href: adminPath("/communications/direct"),
      matchers: [{ type: "exact", value: adminPath("/communications/direct") }],
    },
    {
      id: "dialogs",
      label: "Диалоги",
      href: adminPath("/communications/direct/dialogs"),
      matchers: [{ type: "prefix", value: adminPath("/communications/direct/dialogs") }],
    },
    {
      id: "occasions",
      label: "Поводы обращения",
      href: adminPath("/communications/direct/occasions"),
      matchers: [{ type: "prefix", value: adminPath("/communications/direct/occasions") }],
    },
    {
      id: "complaints",
      label: "Жалобы",
      href: adminPath("/communications/direct/complaints"),
      matchers: [{ type: "prefix", value: adminPath("/communications/direct/complaints") }],
    },
    {
      id: "security",
      label: "Безопасность",
      href: adminPath("/communications/direct/security"),
      matchers: [{ type: "prefix", value: adminPath("/communications/direct/security") }],
    },
    {
      id: "logs",
      label: "Логи",
      href: adminPath("/communications/direct/logs"),
      matchers: [{ type: "prefix", value: adminPath("/communications/direct/logs") }],
    },
    {
      id: "settings",
      label: "Настройки",
      href: adminPath("/communications/direct/settings"),
      matchers: [{ type: "prefix", value: adminPath("/communications/direct/settings") }],
    },
  ],
};
