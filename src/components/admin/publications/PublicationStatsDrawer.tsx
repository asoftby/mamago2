"use client";

import { lazy, Suspense } from "react";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PUBLICATION_STATUS_LABEL } from "@/lib/publications/labels";
import type { PublicationStatus, PublicationType } from "@/lib/publications/domain";
import { PUBLICATION_TYPE_LABEL } from "@/lib/publications/labels";

// Lazy-load детальной статистики — грузится только после открытия drawer
const PublicationStatsDetails = lazy(() =>
  import("./PublicationStatsDetails").then((m) => ({ default: m.PublicationStatsDetails }))
);

function DetailsSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
          <div className="h-3 flex-1 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

function statusBadgeClass(s: PublicationStatus): string {
  const map: Record<string, string> = {
    PUBLISHED: "bg-emerald-100 text-emerald-900 border-emerald-200",
    PENDING: "bg-amber-100 text-amber-900 border-amber-200",
    DRAFT: "bg-slate-100 text-slate-800 border-slate-200",
    REJECTED: "bg-red-100 text-red-900 border-red-200",
    SCHEDULED: "bg-sky-100 text-sky-900 border-sky-200",
    ARCHIVED: "bg-gray-200 text-gray-800 border-gray-300",
  };
  return map[s] ?? "bg-slate-100 text-slate-800 border-slate-200";
}

export interface PublicationStatsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publication: {
    id: string;
    title: string;
    type: PublicationType;
    status: PublicationStatus;
    slug: string | null;
    path: string; // публичный URL для запроса статистики
    updatedAt: string;
  };
}

/**
 * Drawer/Modal со статистикой конкретной публикации.
 * Desktop → Dialog, Mobile → bottom Sheet (через ResponsiveOverlay).
 * Детальная статистика загружается lazy только после открытия.
 */
export function PublicationStatsDrawer({
  open,
  onOpenChange,
  publication,
}: PublicationStatsDrawerProps) {
  const subtitle = (
    <div className="flex flex-wrap items-center gap-2 mt-0.5">
      <span className="text-[12px] text-gray-500">{PUBLICATION_TYPE_LABEL[publication.type]}</span>
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] px-1.5 py-0 h-auto font-normal border",
          statusBadgeClass(publication.status),
        )}
      >
        {PUBLICATION_STATUS_LABEL[publication.status]}
      </Badge>
      {publication.slug && (
        <span className="font-mono text-[11px] text-gray-400 truncate max-w-[200px]">
          /{publication.slug}
        </span>
      )}
    </div>
  );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Статистика публикации"
      variant="framed"
      title="Статистика публикации"
      subtitle={subtitle}
      heightMode="full"
      dialogContentClassName="max-w-2xl"
    >
      {/* Lazy-loaded details — монтируются только когда drawer открыт */}
      {open && (
        <Suspense fallback={<DetailsSkeleton />}>
          <PublicationStatsDetails
            entityId={publication.id}
            path={publication.path}
          />
        </Suspense>
      )}
    </ResponsiveOverlay>
  );
}
