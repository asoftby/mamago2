"use client";

import { useState } from "react";
import Link from "next/link";
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
}

interface EventCardHorizontalProps {
  activity: Activity;
  onDelete: (id: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onUnarchive?: (id: string) => Promise<void>;
}

function deleteDialogCopy(status: ContentStatus): { title: string; description: string } {
  if (status === ContentStatus.PUBLISHED) {
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

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(activity.id);
      setDeleteDialogOpen(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!onArchive) return;

    setIsArchiving(true);
    try {
      await onArchive(activity.id);
    } catch (error: any) {
      alert(error.message);
      setIsArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    if (!onUnarchive) return;

    setIsArchiving(true);
    try {
      await onUnarchive(activity.id);
    } catch (error: any) {
      alert(error.message);
      setIsArchiving(false);
    }
  };

  const deleteCopy = deleteDialogCopy(activity.status);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {coverImage ? (
          <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
            <img
              src={coverImage.url}
              alt={activity.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="flex-shrink-0 w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {activity.title}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2">
                {activity.shortDesc}
              </p>
            </div>
            <ContentStatusBadge status={activity.status} />
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/editor/event/${activity.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Pencil className="w-4 h-4 shrink-0" />
              Открыть в редакторе
            </Link>

            {canDeleteEvent && (
              <>
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isDeleting}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md p-1.5 transition-colors",
                    "text-gray-400 hover:text-red-600 hover:bg-red-50",
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
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                title="В архив"
              >
                <Archive className="w-4 h-4" />
              </button>
            )}

            {onUnarchive && (
              <button
                onClick={handleUnarchive}
                disabled={isArchiving}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
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
