"use client";

import { useState } from "react";
import Link from "next/link";
import { ContentStatusBadge } from "@/components/business/shared/ContentStatusBadge";
import { Pencil, Archive, ArchiveRestore, Trash2, Calendar, MapPin } from "lucide-react";
import { ContentStatus, ActivityType, ScheduleMode } from "@prisma/client";

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

export function EventCardHorizontal({
  activity,
  onDelete,
  onArchive,
  onUnarchive,
}: EventCardHorizontalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const coverImage = activity.images.find(img => img.id);

  const handleDelete = async () => {
    if (!confirm("Вы уверены, что хотите удалить это событие?")) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(activity.id);
    } catch (error: any) {
      alert(error.message);
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Cover Image */}
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

        {/* Content */}
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
            {activity.priceText && (
              <span>{activity.priceText}</span>
            )}
            {activity.priceFrom !== null && !activity.priceText && (
              <span>от {activity.priceFrom} BYN</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href={`/business/events/${activity.id}/edit`}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </Link>

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

            {activity.status === "DRAFT" && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                title="Удалить"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
