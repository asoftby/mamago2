"use client";

import { BusinessContentList } from "@/components/business/shared/BusinessContentList";
import { PlaceCardHorizontal } from "@/components/business/places/PlaceCardHorizontal";
import { MapPin } from "lucide-react";
import { ContentStatus } from "@prisma/client";

interface Place {
  id: string;
  title: string;
  status: ContentStatus;
  formattedAddr: string | null;
  customAddress: string | null;
  slug: string | null;
  shortAddress?: string | null;
  floor?: string | null;
  unit?: string | null;
  unitLabel?: string | null;
  moderatorComment: string | null;
  revisionRequestedAt: Date | null;
  archivedAt: Date | null;
  city: {
    name: string;
    hasMetro: boolean;
    metroMaxDistanceM: number | null;
  } | null;
  districtAuto: {
    name: string;
  } | null;
  districtManual: {
    name: string;
  } | null;
  metroAuto: {
    name: string;
  } | null;
  metroAutoDistanceM: number | null;
  metroManual: {
    name: string;
  } | null;
  metroManualDistanceM: number | null;
  images: Array<{
    id: string;
    url: string;
    kind: string;
  }>;
  activeRevision?: {
    id: string;
    status: string;
    moderatorComment: string | null;
    revisionRequestedAt: Date | null;
  } | null;
  updatedAt: Date;
  linkedEventsCount?: number;
  linkedOffersCount?: number;
}

interface PlacesListProps {
  places: Place[];
  currentView: "active" | "archived";
}

export function PlacesList({ places, currentView }: PlacesListProps) {
  const handleDelete = async (placeId: string) => {
    const response = await fetch(`/api/business/places/${placeId}/delete`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete");
    }
  };

  const handleArchive = async (placeId: string) => {
    const response = await fetch(`/api/business/places/${placeId}/archive`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to archive");
    }
  };

  const handleUnarchive = async (placeId: string) => {
    const response = await fetch(`/api/business/places/${placeId}/archive`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to unarchive");
    }
  };

  return (
    <BusinessContentList
      items={places}
      currentView={currentView}
      emptyIcon={<MapPin className="w-8 h-8 text-gray-400" />}
      emptyTitle="Мест пока нет"
      emptyDescription="Добавьте первое место, чтобы пользователи могли находить вашу локацию и связывать с ней события, предложения и маршруты."
      addButtonText="Добавить место"
      addButtonHref="/business/places/new"
      renderItem={(place, handlers) => (
        <PlaceCardHorizontal
          key={place.id}
          place={place}
          onDelete={handlers.onDelete}
          onArchive={handlers.onArchive}
          onUnarchive={handlers.onUnarchive}
        />
      )}
      onDelete={handleDelete}
      onArchive={currentView === "active" ? handleArchive : undefined}
      onUnarchive={currentView === "archived" ? handleUnarchive : undefined}
      deleteEntityLabel="место"
      getDeleteEntityName={(place) => place.title}
    />
  );
}
