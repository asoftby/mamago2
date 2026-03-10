"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PlaceCardHorizontal } from "@/components/business/places/PlaceCardHorizontal";
import { Button } from "@/components/ui/button";
import { Plus, MapPin } from "lucide-react";
import { ContentStatus } from "@prisma/client";

interface Place {
  id: string;
  title: string;
  status: ContentStatus;
  formattedAddr: string | null;
  customAddress: string | null;
  moderatorComment: string | null;
  revisionRequestedAt: Date | null;
  archivedAt: Date | null;
  city: {
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
}

interface PlacesListProps {
  places: Place[];
  currentView: "active" | "archived";
}

export function PlacesList({ places: initialPlaces, currentView }: PlacesListProps) {
  const router = useRouter();
  const [places, setPlaces] = useState(initialPlaces);

  // Sync local state when server data changes (e.g., tab switch)
  useEffect(() => {
    setPlaces(initialPlaces);
  }, [initialPlaces]);

  const handleDelete = async (placeId: string) => {
    const response = await fetch(`/api/business/places/${placeId}/delete`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete");
    }

    // Remove from local state
    setPlaces(prev => prev.filter(p => p.id !== placeId));
    
    // Refresh server data
    router.refresh();
  };

  const handleArchive = async (placeId: string) => {
    const response = await fetch(`/api/business/places/${placeId}/archive`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to archive");
    }

    // Remove from local state (it's now in archived view)
    setPlaces(prev => prev.filter(p => p.id !== placeId));
    
    // Refresh to update the list
    router.refresh();
  };

  const handleUnarchive = async (placeId: string) => {
    const response = await fetch(`/api/business/places/${placeId}/archive`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to unarchive");
    }

    // Remove from local state (it's now in active view)
    setPlaces(prev => prev.filter(p => p.id !== placeId));
    
    // Refresh to update the list
    router.refresh();
  };

  const handleViewChange = (view: "active" | "archived") => {
    router.push(`/business/places?view=${view}`);
  };

  if (places.length === 0) {
    return (
      <div>
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => handleViewChange("active")}
            className={`px-4 py-2 font-medium transition-colors ${
              currentView === "active"
                ? "text-primary border-b-2 border-primary"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Активные
          </button>
          <button
            onClick={() => handleViewChange("archived")}
            className={`px-4 py-2 font-medium transition-colors ${
              currentView === "archived"
                ? "text-primary border-b-2 border-primary"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Архив
          </button>
        </div>

        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {currentView === "active" ? "У вас пока нет мест" : "Нет архивных мест"}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {currentView === "active"
                ? "Создайте первое место, чтобы начать публиковать мероприятия и предложения"
                : "Архивные места будут отображаться здесь"}
            </p>
            {currentView === "active" && (
              <Button asChild size="lg">
                <Link href="/business/places/new">
                  <Plus className="w-5 h-5 mr-2" />
                  Добавить место
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => handleViewChange("active")}
          className={`px-4 py-2 font-medium transition-colors ${
            currentView === "active"
              ? "text-primary border-b-2 border-primary"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Активные
        </button>
        <button
          onClick={() => handleViewChange("archived")}
          className={`px-4 py-2 font-medium transition-colors ${
            currentView === "archived"
              ? "text-primary border-b-2 border-primary"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Архив
        </button>
      </div>

      {/* Add Place Button */}
      {currentView === "active" && (
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/business/places/new">
              <Plus className="w-4 h-4 mr-2" />
              Добавить место
            </Link>
          </Button>
        </div>
      )}

      {/* Places List */}
      <div className="space-y-3">
        {places.map((place) => (
          <PlaceCardHorizontal
            key={place.id}
            place={place}
            onDelete={handleDelete}
            onArchive={currentView === "active" ? handleArchive : undefined}
            onUnarchive={currentView === "archived" ? handleUnarchive : undefined}
          />
        ))}
      </div>
    </div>
  );
}
