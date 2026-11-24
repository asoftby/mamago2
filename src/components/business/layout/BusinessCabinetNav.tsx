"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HistoryBackButton } from "@/components/navigation/HistoryBackButton";
import { buildBusinessCabinetNavModel } from "@/lib/business/cabinetCrumbs";

/**
 * Shared Back + breadcrumb row for every protected business cabinet screen.
 * Lives in BusinessShell so pages without BusinessSectionHeader still get it.
 */
export function BusinessCabinetNav() {
  const pathname = usePathname() ?? "";
  const { showBack, crumbs, backFallbackHref } =
    buildBusinessCabinetNavModel(pathname);

  return (
    <div className="flex items-center gap-3">
      {showBack ? (
        <HistoryBackButton
          fallbackHref={backFallbackHref}
          ariaLabel="Назад"
        />
      ) : null}
      <nav
        aria-label="Хлебные крошки"
        className="min-w-0 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
      >
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="contents">
              {index > 0 ? (
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground/70"
                  aria-hidden
                />
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="shrink-0 transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className="line-clamp-1"
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
