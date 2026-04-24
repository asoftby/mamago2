'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MODERATION_NAV_ITEMS,
  moderationItemHref,
  type ModerationNavItemId,
} from "@/lib/admin/moderationSidebarConfig";
import {
  CONTENT_NAV_ITEMS,
  contentItemHref,
} from "@/lib/admin/contentSidebarConfig";
import { SEO_CONTROL_NAV } from "@/lib/admin/seoNavConfig";
import { adminPath } from "@/lib/routing/surface";

export { adminPath };

const MODERATION_NAV_EN: Record<ModerationNavItemId, string> = {
  queue: "Queue",
};

interface NavItem {
  label: string;
  href: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Moderation",
    items: MODERATION_NAV_ITEMS.map((item) => ({
      label: MODERATION_NAV_EN[item.id],
      href: moderationItemHref(item.path),
    })),
  },
  {
    title: "Users",
    items: [
      { label: "Пользователи", href: adminPath("/users") },
    ],
  },
  {
    title: "B2B",
    items: [
      { label: "Заявки", href: adminPath("/b2b/requests") },
      { label: "Контрагенты", href: adminPath("/b2b/partners") },
    ],
  },
  {
    title: "Billing",
    items: [
      { label: "Overview", href: adminPath("/billing") },
      { label: "Транзакции", href: adminPath("/billing/transactions") },
      { label: "Балансы", href: adminPath("/billing/businesses") },
      { label: "Тарифы", href: adminPath("/billing/plans") },
    ],
  },
  {
    title: "Commercial",
    items: [
      { label: "Overview", href: adminPath("/commercial") },
      { label: "Договоры", href: adminPath("/commercial/contracts") },
      { label: "Размещения", href: adminPath("/commercial/placements") },
      { label: "Услуги", href: adminPath("/commercial/service-placements") },
    ],
  },
  {
    title: "Content",
    items: CONTENT_NAV_ITEMS.map((item) => ({
      label: item.label,
      href: contentItemHref(item.path),
    })),
  },
  {
    title: "Communications",
    items: [
      { label: "Overview", href: adminPath("/communications") },
      { label: "Email Studio", href: adminPath("/communications/email-studio") },
    ],
  },
  {
    title: "Discovery",
    items: [
      { label: "Сигналы", href: adminPath("/taxonomy/signals") },
      { label: "Категории", href: adminPath("/taxonomy/categories") },
      { label: "Поводы", href: adminPath("/discovery/occasions") },
      { label: "Жанры", href: adminPath("/taxonomy/genres") },
      { label: "Фильтры", href: adminPath("/discovery/filters") },
    ],
  },
  {
    title: "Geography",
    items: [
      { label: "Districts", href: adminPath("/taxonomy/districts") },
      { label: "Metro Stations", href: adminPath("/taxonomy/metro-stations") },
    ],
  },
  {
    title: "SEO",
    items: SEO_CONTROL_NAV.map((item) => ({
      label: item.label,
      href: item.href,
    })),
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6">
      {/* Dashboard - always at top */}
      <div>
        <Link
          href={adminPath("")}
          className={cn(
            "block px-3 py-2 text-sm rounded-md transition-colors",
            pathname === adminPath("")
              ? "bg-primary/10 text-primary font-medium"
              : "text-gray-700 hover:bg-gray-100"
          )}
        >
          Dashboard
        </Link>
      </div>

      {/* Grouped sections */}
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {section.title}
          </div>
          <div className="flex flex-col gap-1">
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== adminPath("") &&
                  pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block px-3 py-2 text-sm rounded-md transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
