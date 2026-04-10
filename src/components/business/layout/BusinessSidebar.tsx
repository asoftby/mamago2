"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Calendar,
  Tag,
  CreditCard,
  FileText,
  Users,
} from "lucide-react";
import { SidebarItem } from "@/components/shared/sidebar/SidebarItem";
import { buildBusinessPath } from "@/lib/routing/surface";

const BUSINESS_DASHBOARD = buildBusinessPath("/dashboard");
const BUSINESS_BILLING_PLAN = buildBusinessPath("/billing/plan");
const BUSINESS_COMMERCIAL = buildBusinessPath("/commercial");
const BUSINESS_TEAM = buildBusinessPath("/team");

const navigationItems = [
  {
    name: "Dashboard",
    href: BUSINESS_DASHBOARD,
    icon: LayoutDashboard,
  },
  {
    name: "Places",
    href: buildBusinessPath("/places"),
    icon: MapPin,
  },
  {
    name: "Events",
    href: buildBusinessPath("/events"),
    icon: Calendar,
  },
  {
    name: "Offers",
    href: buildBusinessPath("/offers"),
    icon: Tag,
  },
  {
    name: "Команда",
    href: BUSINESS_TEAM,
    icon: Users,
  },
  {
    name: "Billing",
    href: BUSINESS_BILLING_PLAN,
    icon: CreditCard,
  },
  {
    name: "Commercial",
    href: BUSINESS_COMMERCIAL,
    icon: FileText,
  },
];

export function BusinessSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === BUSINESS_DASHBOARD) {
      return pathname === href;
    }
    if (href === BUSINESS_BILLING_PLAN) {
      return pathname.startsWith(buildBusinessPath("/billing"));
    }
    if (href === BUSINESS_COMMERCIAL) {
      return pathname.startsWith(BUSINESS_COMMERCIAL);
    }
    if (href === BUSINESS_TEAM) {
      return pathname.startsWith(BUSINESS_TEAM);
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-[240px] border-r border-gray-200 bg-white min-h-[calc(100vh-4rem)]">
      <nav className="flex flex-col gap-1.5 p-4">
        {navigationItems.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.name}
            isActive={isActive(item.href)}
          />
        ))}
      </nav>
    </aside>
  );
}
