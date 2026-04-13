"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ContentStatusBadge } from "@/components/business/shared/ContentStatusBadge";
import { Pencil, Archive, ArchiveRestore, Trash2, Calendar, MapPin } from "lucide-react";
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

interface Activity {
  id: string;
  type: ActivityType;
  status: ContentStatus;
  title: string;
  shortDesc: string;
  scheduleMode: ScheduleMode;
  priceFrom: number | null;
  priceTo: number | null;
  priceText: string | null;
  place: {
    id: string;
    title: string;
  } | null;
  images: Array<{
    id: string;
    url: string;
  }>;
  updatedAt: Date;
  metrics: {
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

function deleteDialogCopy(status: ContentStatus): { title: string; description: string } {
  if (status === ContentStatus.PUBLISHED || status === ContentStatus.PENDING_UPDATE) {
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

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

export function EventCardHorizontal({
  activity,
  onDelete,
  onArchive,
  onUnarchive,
}: EventCardHorizontalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const coverImage = activity.images.find((img) => img.id);

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

  return (
    <div className="rounded-[26px] border border-stone-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-stone-300 hover:shadow-[0_14px_32px_rgba(15,23,42,0.05)] md:p-5">
      <div className="flex gap-4">
        {coverImage ? (
          <div className="flex h-24 w-24 flex-shrink-0 overflow-hidden rounded-[22px] bg-stone-100 ring-1 ring-stone-200/70">
            <Image
              src={coverImage.url}
              alt={activity.title}
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-[22px] bg-stone-100 text-stone-400 ring-1 ring-stone-200/70">
            <Calendar className="w-8 h-8" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-stone-950">
                  {activity.title}
                </h3>
                <BusinessChip tone="muted" size="compact">
                  Event
                </BusinessChip>
              </div>
              <p className="line-clamp-2 text-sm leading-7 text-stone-600">
                {activity.shortDesc}
              </p>
            </div>
            <ContentStatusBadge status={activity.status} />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-stone-500">
            {activity.place && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{activity.place.title}</span>
              </div>
            )}
            {activity.priceText && <span>{activity.priceText}</span>}
            {activity.priceFrom !== null && !activity.priceText && (
              <span>от {activity.priceFrom} BYN</span>
            )}
            <span>Обновлено {formatUpdatedAt(activity.updatedAt)}</span>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <BusinessChip>Просмотры: {activity.metrics.views}</BusinessChip>
            <BusinessChip>Сохранения: {activity.metrics.saves}</BusinessChip>
            <BusinessChip>В план: {activity.metrics.planAdds}</BusinessChip>
            <BusinessChip>Переходы: {activity.metrics.ctaClicks}</BusinessChip>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/business/events/${activity.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950"
            >
              <Pencil className="w-4 h-4 shrink-0" />
              Редактировать
            </Link>

            <Link
              href={buildPromotionLaunchHref({
                publicationType: "EVENT",
                publicationId: activity.id,
              })}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
            >
              Продвигать
            </Link>

            {canDeleteEvent && (
              <>
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isDeleting}
                  className={cn(
                    "inline-flex items-center justify-center rounded-xl p-2 transition-colors",
                    "text-stone-400 hover:bg-red-50 hover:text-red-600",
                    "disabled:opacity-50 disabled:pointer-events-none"
                  )}
                  title="Удалить событие"
                  aria-label="Удалить событие"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{deleteCopy.title}</AlertDialogTitle>
                      <AlertDialogDescription>{deleteCopy.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
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
            )}

            {onArchive && (
              <button
                onClick={handleArchive}
                disabled={isArchiving}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
                title="В архив"
              >
                <Archive className="w-4 h-4" />
              </button>
            )}

            {onUnarchive && (
              <button
                onClick={handleUnarchive}
                disabled={isArchiving}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
                title="Восстановить"
              >
                <ArchiveRestore className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
