'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Admin route helper to ensure all admin links are prefixed correctly
const ADMIN_BASE = "/admin";
export const adminPath = (path: string) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${ADMIN_BASE}${cleanPath}`;
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
    items: [
      { label: "Queue", href: adminPath("/moderation/queue") },
      { label: "Places", href: adminPath("/moderation/places") },
    ],
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
    items: [
      { label: "Медиатека", href: adminPath("/media") },
    ],
  },
  {
    title: "Discovery",
    items: [
      { label: "Signals", href: adminPath("/taxonomy/signals") },
      { label: "Filters", href: adminPath("/taxonomy/filters") },
    ],
  },
  {
    title: "Geography",
    items: [
      { label: "Districts", href: adminPath("/taxonomy/districts") },
      { label: "Metro Stations", href: adminPath("/taxonomy/metro-stations") },
    ],
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
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block px-3 py-2 text-sm rounded-md transition-colors",
                  pathname === item.href
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
