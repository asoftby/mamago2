"use client";

import { formatPriceFrom, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Pencil,
  Eye,
  Archive,
  ArchiveRestore,
  Trash2,
  Calendar,
  BarChart3,
  Zap,
} from "lucide-react";
import { ContentStatus, ActivityType, ScheduleMode } from "@prisma/client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { buildPromotionLaunchHref } from "@/lib/promotion/shared";
import { PublicationStatisticsDialog } from "@/components/business/shared/PublicationStatisticsDialog";
import { BusinessPublicationCard } from "@/components/business/shared/BusinessPublicationCard";
import {
  BUSINESS_PUBLICATION_ACTION_BUTTON,
  BUSINESS_PUBLICATION_ACTION_DANGER_ICON,
  BUSINESS_PUBLICATION_ACTION_ICON,
  BUSINESS_PUBLICATION_ACTION_NEUTRAL,
  BUSINESS_PUBLICATION_ACTION_PROMOTE,
} from "@/components/business/shared/BusinessPublicationCard";
import { formatUpdatedAgo } from "@/lib/date/formatUpdatedAgo";
import {
  CONTENT_STATUS_META,
  contentStatusPublicationPillClass,
} from "@/lib/content-status-meta";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { publicActivityPath, toAbsolutePublicUrl } from "@/lib/business/eventPublicLink";

interface Activity {
  id: string;
  type: ActivityType;
  status: ContentStatus;
  slug?: string | null;
  city?: {
    slug: string;
  } | null;
  title: string;
  shortDesc: string;
  scheduleMode: ScheduleMode;
  priceFrom: number | null;
  priceTo: number | null;
  priceText: string | null;
  place: {
    id: string;
    title: string;
    city?: {
      slug: string;
    } | null;
  } | null;
  images: Array<{
    id: string;
    url: string;
  }>;
  updatedAt: Date;
  createdAt: Date;
  nextOccurrenceAt?: Date | null;
  metrics?: {
    views: number;
    saves: number;
    planAdds: number;
    ctaClicks: number;
  };
}

interface EventCardHorizontalProps {
  activity: Activity;
  onDelete: (id: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onUnarchive?: (id: string) => Promise<void>;
}

function deleteDialogCopy(status: ContentStatus): {
  title: string;
  description: string;
} {
  if (
    status === ContentStatus.PUBLISHED ||
    status === ContentStatus.PENDING_UPDATE
  ) {
    return {
      title: "Удалить опубликованное событие?",
      description: "Оно перестанет отображаться пользователям.",
    };
  }
  return {
    title: "Удалить событие?",
    description: "Это действие нельзя отменить.",
  };
}

function buildEventSubtitle(activity: Activity): string {
  const parts: string[] = [];
  if (activity.place?.title) {
    parts.push(activity.place.title);
  }
  if (activity.nextOccurrenceAt) {
    parts.push(
      format(new Date(activity.nextOccurrenceAt), "d MMM yyyy", {
        locale: ru,
      }),
    );
  }
  if (activity.priceText) {
    parts.push(normalizeUiCurrencyText(activity.priceText));
  } else if (activity.priceFrom != null) {
    parts.push(formatPriceFrom(activity.priceFrom, { hideZero: true }));
  }
  if (parts.length === 0 && activity.shortDesc?.trim()) {
    return activity.shortDesc.trim();
  }
  return parts.length > 0 ? parts.join(" · ") : "Место и время уточняются";
}

export function EventCardHorizontal({
  activity,
  onDelete,
  onArchive,
  onUnarchive,
}: EventCardHorizontalProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statisticsOpen, setStatisticsOpen] = useState(false);

  const coverImage = activity.images[0];
  const currentSearch = searchParams.toString();
  const returnTo = `${pathname}${currentSearch ? `?${currentSearch}` : ""}`;
  const publicEventHref =
    activity.status === ContentStatus.PUBLISHED ||
    activity.status === ContentStatus.PENDING_UPDATE ||
    activity.status === ContentStatus.SCHEDULED
      ? toAbsolutePublicUrl(
          publicActivityPath(
            activity.id,
            activity.city?.slug ?? activity.place?.city?.slug ?? null,
            activity.slug ?? null,
          ),
        )
      : `/me/events/${activity.id}/preview`;

  const canDeleteEvent = activity.status !== ContentStatus.DELETED;
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(activity.id);
      setDeleteDialogOpen(false);
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Не удалось удалить событие"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!onArchive) return;

    setIsArchiving(true);
    try {
      await onArchive(activity.id);
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Не удалось архивировать событие"));
      setIsArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    if (!onUnarchive) return;

    setIsArchiving(true);
    try {
      await onUnarchive(activity.id);
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Не удалось восстановить событие"));
      setIsArchiving(false);
    }
  };

  const deleteCopy = deleteDialogCopy(activity.status);
  const statusMeta = CONTENT_STATUS_META[activity.status];
  const updatedLine = formatUpdatedAgo(activity.updatedAt, activity.createdAt);
  const createdLine = `Создано: ${format(new Date(activity.createdAt), "d MMMM yyyy", { locale: ru })}`;

  const cardMetrics = activity.metrics
    ? {
        views: activity.metrics.views,
        saves: activity.metrics.saves,
        planAdds: activity.metrics.planAdds,
        ctaClicks: activity.metrics.ctaClicks,
      }
    : null;

  const statusRow = (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium",
        contentStatusPublicationPillClass(activity.status),
      )}
    >
      {statusMeta.label}
    </span>
  );

  return (
    <>
      <BusinessPublicationCard
        type="event"
        imageUrl={coverImage?.url ?? null}
        imageAlt={activity.title}
        placeholderIcon={Calendar}
        title={activity.title}
        typeChip={
          <BusinessChip tone="muted" size="compact">
            Event
          </BusinessChip>
        }
        subtitle={buildEventSubtitle(activity)}
        statusRow={statusRow}
        updatedLine={updatedLine}
        createdLine={createdLine}
        metrics={cardMetrics}
        actions={
          <>
            <button
              type="button"
              onClick={() => setStatisticsOpen(true)}
              className={cn(
                BUSINESS_PUBLICATION_ACTION_BUTTON,
                BUSINESS_PUBLICATION_ACTION_NEUTRAL,
              )}
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              Статистика
            </button>

            <Link
              href={publicEventHref ?? `/me/events/${activity.id}/preview`}
              target="_blank"
              rel="noopener noreferrer"
              className={BUSINESS_PUBLICATION_ACTION_ICON}
              title="Просмотр"
              aria-label="Просмотр"
            >
              <Eye className="h-4 w-4" />
            </Link>

            <Link
              href={`/business/events/${activity.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
              className={BUSINESS_PUBLICATION_ACTION_ICON}
              title="Редактировать"
              aria-label="Редактировать"
            >
              <Pencil className="h-4 w-4" />
            </Link>

            <Link
              href={buildPromotionLaunchHref({
                publicationType: "EVENT",
                publicationId: activity.id,
              })}
              className={cn(
                BUSINESS_PUBLICATION_ACTION_BUTTON,
                BUSINESS_PUBLICATION_ACTION_PROMOTE,
              )}
            >
              <Zap className="h-4 w-4 shrink-0 fill-stone-950" />
              Продвигать
            </Link>

            {onArchive ? (
              <button
                type="button"
                onClick={handleArchive}
                disabled={isArchiving}
                className={BUSINESS_PUBLICATION_ACTION_ICON}
                title="В архив"
                aria-label="В архив"
              >
                <Archive className="h-4 w-4" />
              </button>
            ) : null}

            {onUnarchive ? (
              <button
                type="button"
                onClick={handleUnarchive}
                disabled={isArchiving}
                className={BUSINESS_PUBLICATION_ACTION_ICON}
                title="Восстановить"
                aria-label="Восстановить"
              >
                <ArchiveRestore className="h-4 w-4" />
              </button>
            ) : null}

            {canDeleteEvent ? (
              <>
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isDeleting}
                  className={BUSINESS_PUBLICATION_ACTION_DANGER_ICON}
                  title="Удалить событие"
                  aria-label="Удалить событие"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <AlertDialog
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{deleteCopy.title}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {deleteCopy.description}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>
                        Отмена
                      </AlertDialogCancel>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={isDeleting}
                        onClick={() => void handleConfirmDelete()}
                      >
                        {isDeleting ? "Удаление…" : "Удалить"}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : null}
          </>
        }
      />

      <PublicationStatisticsDialog
        open={statisticsOpen}
        onOpenChange={setStatisticsOpen}
        title={activity.title}
        entityLabel="события"
        metrics={activity.metrics}
      />
    </>
  );
}
