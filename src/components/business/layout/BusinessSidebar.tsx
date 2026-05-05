"use client";

import { usePathname } from "next/navigation";
import { SidebarItem } from "@/components/shared/sidebar/SidebarItem";
import { SidebarPublicSiteEntry } from "@/components/shared/sidebar/SidebarPublicSiteEntry";
import { SidebarGroup } from "@/components/shared/sidebar/SidebarGroup";
import { SidebarSubItem } from "@/components/shared/sidebar/SidebarSubItem";
import {
  BUSINESS_DASHBOARD_HREF,
  businessNavigation,
} from "@/lib/business/navigation";

interface BusinessSidebarProps {
  onNavigate?: () => void;
  /** В bottomsheet убираем sticky top-16 */
  variant?: "sidebar" | "sheet";
}

export function BusinessSidebar({ onNavigate, variant = "sidebar" }: BusinessSidebarProps) {
  const pathname = usePathname();

  const matchesPath = (patterns: string[]) =>
    patterns.some((pattern) =>
      pathname === pattern || pathname.startsWith(`${pattern}/`)
    );

  return (
    <aside className="w-full lg:w-[248px] h-full border-r border-stone-200/80 bg-white/75 backdrop-blur">
      <nav className={variant === "sheet" ? "flex flex-col gap-1.5 p-4" : "sticky top-16 flex flex-col gap-1.5 p-4"}>
        <SidebarPublicSiteEntry
          onNavigate={onNavigate}
          separatorClassName="border-stone-200/80"
          chromeTone="business"
        />
        {businessNavigation.map((item, index) => {
          if (item.type === "item") {
            const patterns = item.match ?? [item.href];
            return (
              <SidebarItem
                key={`${item.href}:${item.label}:${index}`}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={
                  item.href === BUSINESS_DASHBOARD_HREF
                    ? pathname === item.href
                    : matchesPath(patterns)
                }
                onClick={onNavigate}
              />
            );
          }

          const groupPatterns = item.match ?? item.children.map((child) => child.href);
          const defaultOpen = matchesPath(groupPatterns);

          return (
            <SidebarGroup
              key={item.label}
              icon={item.icon}
              label={item.label}
              defaultOpen={defaultOpen}
            >
              {item.children.map((child, childIndex) => (
                <SidebarSubItem
                  key={`${child.href}:${child.label}:${childIndex}`}
                  href={child.href}
                  label={child.label}
                  isActive={
                    pathname === child.href ||
                    pathname.startsWith(`${child.href}/`)
                  }
                  onClick={onNavigate}
                />
              ))}
            </SidebarGroup>
          );
        })}
      </nav>
    </aside>
  );
}
