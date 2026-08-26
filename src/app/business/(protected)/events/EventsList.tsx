"use client";

import { BusinessContentList } from "@/components/business/shared/BusinessContentList";
import { EventCardHorizontal } from "@/components/business/events/EventCardHorizontal";
import { Calendar } from "lucide-react";
import { ContentStatus, ActivityType, ScheduleMode } from "@prisma/client";
import type { ActivityPromotionPerformance } from "@/server/services/promotion/boostPerformance.service";

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
  description: string | null;
  coverImageUrl?: string | null;
  coverImage?: {
    publicUrl: string | null;
  } | null;
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
  isPromoted?: boolean;
  promotionPerformance?: ActivityPromotionPerformance | null;
  metrics?: {
    views: number;
    saves: number;
    planAdds: number;
    ctaClicks: number;
  };
}

interface EventsListProps {
  activities: Activity[];
  currentView: "active" | "archived";
}

export function EventsList({ activities, currentView }: EventsListProps) {
  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/business/events/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        typeof error.message === "string"
          ? error.message
          : typeof error.error === "string"
            ? error.error
            : typeof error.code === "string"
              ? error.code
              : "Не удалось удалить событие"
      );
    }

  };

  const handleArchive = async (id: string) => {
    const response = await fetch(`/api/business/events/${id}/archive`, {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        typeof error.message === "string"
          ? error.message
          : typeof error.error === "string"
            ? error.error
            : typeof error.code === "string"
              ? error.code
              : "Не удалось архивировать событие",
      );
    }
  };

  const handleUnarchive = async (id: string) => {
    const response = await fetch(`/api/business/events/${id}/archive`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        typeof error.message === "string"
          ? error.message
          : typeof error.error === "string"
            ? error.error
            : typeof error.code === "string"
              ? error.code
              : "Не удалось восстановить событие",
      );
    }
  };

  return (
    <BusinessContentList
      items={activities}
      currentView={currentView}
      emptyIcon={<Calendar className="w-8 h-8 text-gray-400" />}
      emptyTitle="Событий пока нет"
      emptyDescription="Добавьте первое событие, чтобы запустить спрос и увидеть, что именно сохраняют семьи и куда они переходят дальше."
      addButtonText="Добавить событие"
      addButtonHref="/business/events/new"
      renderItem={(activity, handlers) => (
        <EventCardHorizontal
          key={activity.id}
          activity={activity}
          onDelete={handlers.onDelete}
          onArchive={handlers.onArchive}
          onUnarchive={handlers.onUnarchive}
        />
      )}
      onDelete={handleDelete}
      deleteEntityLabel="событие"
      getDeleteEntityName={(a) => a.title}
      onArchive={currentView === "active" ? handleArchive : undefined}
      onUnarchive={currentView === "archived" ? handleUnarchive : undefined}
    />
  );
}
