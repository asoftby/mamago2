"use client";

import { toast } from "sonner";
import { BusinessContentList, ItemHandlers } from "@/components/business/shared/BusinessContentList";
import { EventCardHorizontal } from "@/components/business/events/EventCardHorizontal";
import { Calendar } from "lucide-react";
import { ContentStatus, ActivityType, ScheduleMode } from "@prisma/client";

interface Activity {
  id: string;
  type: ActivityType;
  status: ContentStatus;
  title: string;
  shortDesc: string;
  description: string | null;
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
  createdAt: Date;
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
        typeof error.error === "string" ? error.error : "Не удалось удалить событие"
      );
    }

  };

  const handleRestore = async (id: string) => {
    const response = await fetch(`/api/business/events/${id}/restore`, {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        typeof error.error === "string" ? error.error : "Не удалось восстановить событие",
      );
    }
  };

  // Archive/unarchive will be implemented when we add archived field to Activity
  const handleArchive = async (id: string) => {
    // TODO: Implement when Activity model has archived field
    console.log("Archive not yet implemented for activities");
  };

  const handleUnarchive = async (id: string) => {
    // TODO: Implement when Activity model has archived field
    console.log("Unarchive not yet implemented for activities");
  };

  return (
    <BusinessContentList
      items={activities}
      currentView={currentView}
      emptyIcon={<Calendar className="w-8 h-8 text-gray-400" />}
      emptyTitle="У вас пока нет событий"
      emptyDescription="Создайте первое событие, чтобы привлечь посетителей"
      addButtonText="Добавить событие"
      addButtonHref="/editor/event/new"
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
      onRestore={handleRestore}
      deleteEntityLabel="событие"
      getDeleteEntityName={(a) => a.title}
      onArchive={currentView === "active" ? handleArchive : undefined}
      onUnarchive={currentView === "archived" ? handleUnarchive : undefined}
    />
  );
}
