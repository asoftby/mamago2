"use client";

import { lazy, Suspense } from "react";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PUBLICATION_STATUS_LABEL, PUBLICATION_TYPE_LABEL } from "@/lib/publications/labels";
import type { PublicationStatus, PublicationType } from "@/lib/publications/domain";

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
    path: string;
    updatedAt: string;
  };
}

export function PublicationStatsDrawer({
  open,
  onOpenChange,
  publication,
}: PublicationStatsDrawerProps) {
  const isArticle = publication.type === "ARTICLE";
  const overlayTitle = isArticle ? "Статистика статьи" : "Статистика публикации";
  const subtitle = (
    <div className="mt-1 min-w-0">
      <p className="max-w-[560px] text-[16px] font-semibold leading-snug text-gray-900 line-clamp-2">
        {publication.title}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-gray-500">{PUBLICATION_TYPE_LABEL[publication.type]}</span>
        <Badge
          variant="outline"
          className={cn("text-[10px] px-1.5 py-0 h-auto font-normal border", statusBadgeClass(publication.status))}
        >
          {PUBLICATION_STATUS_LABEL[publication.status]}
        </Badge>
        {publication.slug ? (
          <span className="max-w-[260px] truncate font-mono text-[10px] text-gray-400">/{publication.slug}</span>
        ) : null}
      </div>
    </div>
  );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle={overlayTitle}
      variant="framed"
      title={overlayTitle}
      subtitle={subtitle}
      heightMode="full"
      dialogContentClassName="max-w-2xl"
    >
      {open ? (
        <Suspense fallback={<DetailsSkeleton />}>
          <PublicationStatsDetails entityId={publication.id} path={publication.path} />
        </Suspense>
      ) : null}
    </ResponsiveOverlay>
  );
}
