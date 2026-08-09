"use client";

import { lazy, Suspense } from "react";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";

// Lazy-load детального отчёта — грузится только после открытия drawer.
const PublicationAnalyticsDetails = lazy(() =>
  import("./PublicationAnalyticsDetails").then((m) => ({
    default: m.PublicationAnalyticsDetails,
  })),
);

function DetailsSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Загрузка отчёта">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
          <div className="h-3 flex-1 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export interface PublicationAnalyticsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publication: {
    entityType: string;
    entityId: string;
    title: string;
  } | null;
  /** Тот же период/город, что выбран в Content Performance. */
  filters: Pick<AnalyticsOverviewFilters, "dateRange" | "city">;
}

/**
 * Drawer/Modal с отчётом по одной публикации (Content Performance → drill-down).
 * Desktop → Dialog, mobile → bottom Sheet (через ResponsiveOverlay), как
 * PublicationStatsDrawer. Данные грузятся lazy только после открытия.
 */
export function PublicationAnalyticsDrawer({
  open,
  onOpenChange,
  publication,
  filters,
}: PublicationAnalyticsDrawerProps) {
  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Отчёт по публикации"
      variant="framed"
      title="Отчёт по публикации"
      subtitle={
        publication ? (
          <span className="mt-0.5 block truncate text-[12px] text-gray-500">
            {publication.title}
          </span>
        ) : undefined
      }
      heightMode="full"
      dialogContentClassName="max-w-xl"
    >
      {open && publication && (
        <Suspense fallback={<DetailsSkeleton />}>
          <PublicationAnalyticsDetails
            entityType={publication.entityType}
            entityId={publication.entityId}
            title={publication.title}
            filters={filters}
          />
        </Suspense>
      )}
    </ResponsiveOverlay>
  );
}
