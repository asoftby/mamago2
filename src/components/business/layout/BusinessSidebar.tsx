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

const navigationItems = [
  {
    name: "Dashboard",
    href: "/business/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Places",
    href: "/business/places",
    icon: MapPin,
  },
  {
    name: "Events",
    href: "/business/events",
    icon: Calendar,
  },
  {
    name: "Offers",
    href: "/business/offers",
    icon: Tag,
  },
  {
    name: "Команда",
    href: "/business/team",
    icon: Users,
  },
  {
    name: "Billing",
    href: "/business/billing/plan",
    icon: CreditCard,
  },
  {
    name: "Commercial",
    href: "/business/commercial",
    icon: FileText,
  },
];

export function BusinessSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/business/dashboard") {
      return pathname === href;
    }
    // For billing, check if pathname starts with /business/billing
    if (href === "/business/billing/plan") {
      return pathname.startsWith("/business/billing");
    }
    // For commercial, check if pathname starts with /business/commercial
    if (href === "/business/commercial") {
      return pathname.startsWith("/business/commercial");
    }
    if (href === "/business/team") {
      return pathname.startsWith("/business/team");
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
