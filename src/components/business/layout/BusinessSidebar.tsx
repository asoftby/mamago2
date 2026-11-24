"use client";

import { usePathname } from "next/navigation";
import { SidebarItem } from "@/components/shared/sidebar/SidebarItem";
import { SidebarPublicSiteEntry } from "@/components/shared/sidebar/SidebarPublicSiteEntry";
import { SidebarGroup } from "@/components/shared/sidebar/SidebarGroup";
import { SidebarSubItem } from "@/components/shared/sidebar/SidebarSubItem";
import { useBookingsMenuBadge } from "@/components/business/bookings/useBookingsMenuBadge";
import {
  BUSINESS_BOOKINGS_HREF,
  BUSINESS_DASHBOARD_HREF,
  businessNavigation,
} from "@/lib/business/navigation";
import type { BuildInfo } from "@/lib/system/buildInfo";

interface BusinessSidebarProps {
  onNavigate?: () => void;
  /** В bottomsheet убираем sticky top-16 */
  variant?: "sidebar" | "sheet";
  buildInfo?: BuildInfo;
}

export function BusinessSidebar({ onNavigate, variant = "sidebar", buildInfo }: BusinessSidebarProps) {
  const pathname = usePathname();
  const bookingsBadge = useBookingsMenuBadge();
  const businessPathname =
    pathname === "/business" || pathname.startsWith("/business/")
      ? pathname
      : pathname === "/"
        ? "/business/"
        : `/business${pathname}`;

  const matchesPath = (patterns: string[]) =>
    patterns.some((pattern) =>
      businessPathname === pattern || businessPathname.startsWith(`${pattern}/`)
    );

  const releaseVersion = buildInfo?.currentReleaseVersion ?? buildInfo?.appVersion ?? null;
  // Prefer immutable image BUILD_ID (номер сборки), then short git SHA from getBuildInfo().
  const buildLabel =
    buildInfo?.buildId ??
    buildInfo?.commitShortSha ??
    (releaseVersion ? `v${releaseVersion}` : null);

  return (
    <aside className="w-full lg:w-[248px] h-full border-r border-stone-200/80 bg-white/75 backdrop-blur flex flex-col">
      <nav className={variant === "sheet" ? "flex flex-col gap-1.5 p-4 flex-1" : "sticky top-16 flex flex-col gap-1.5 p-4 flex-1"}>
        <SidebarPublicSiteEntry
          onNavigate={onNavigate}
          separatorClassName="border-stone-200/80"
          chromeTone="business"
        />
        {businessNavigation
          .filter(
            (item) =>
              !(item.type === "item" &&
                item.href.includes("/billing") &&
                process.env.NEXT_PUBLIC_BILLING_ENABLED !== "true"),
          )
          .map((item, index) => {
          if (item.type === "item") {
            const patterns = item.match ?? [item.href];
            return (
              <div key={`${item.href}:${item.label}:${index}`} data-business-tour-target={item.href === BUSINESS_DASHBOARD_HREF ? "dashboard" : undefined}>
              <SidebarItem
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={
                  item.href === BUSINESS_DASHBOARD_HREF
                    ? businessPathname === item.href || businessPathname === "/business/"
                    : matchesPath(patterns)
                }
                sidebarVariant="business"
                onClick={onNavigate}
                badgeCount={item.href === BUSINESS_BOOKINGS_HREF ? bookingsBadge : 0}
              />
              </div>
            );
          }

          const groupPatterns = item.match ?? item.children.map((child) => child.href);
          const defaultOpen = matchesPath(groupPatterns);
          const isGroupActive = defaultOpen;

          return (
            <SidebarGroup
              key={item.label}
              icon={item.icon}
              label={item.label}
              sidebarVariant="business"
              defaultOpen={defaultOpen}
              isActive={isGroupActive}
            >
              {item.children.map((child, childIndex) => (
                <SidebarSubItem
                  key={`${child.href}:${child.label}:${childIndex}`}
                  href={child.href}
                  label={child.label}
                  isActive={
                    businessPathname === child.href ||
                    businessPathname.startsWith(`${child.href}/`)
                  }
                  sidebarVariant="business"
                  onClick={onNavigate}
                />
              ))}
            </SidebarGroup>
          );
        })}

        {buildLabel ? (
          <p
            className="mt-auto pt-4 text-center font-mono text-xs text-stone-400"
            title={
              [
                buildInfo?.label,
                releaseVersion ? `v${releaseVersion}` : null,
                buildInfo?.buildId ? `BUILD_ID ${buildInfo.buildId}` : null,
                buildInfo?.commitSha,
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          >
            Сборка: {buildLabel}
          </p>
        ) : null}
      </nav>
    </aside>
  );
}
