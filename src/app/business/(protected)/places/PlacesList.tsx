"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
}

interface PlacesListProps {
  places: Place[];
}

export function PlacesList({ places: initialPlaces }: PlacesListProps) {
  const router = useRouter();
  const [places, setPlaces] = useState(initialPlaces);

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

  if (places.length === 0) {
    return (
      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            У вас пока нет мест
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Создайте первое место, чтобы начать публиковать мероприятия и предложения
          </p>
          <Button asChild size="lg">
            <Link href="/business/places/new">
              <Plus className="w-5 h-5 mr-2" />
              Добавить место
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Place Button */}
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/business/places/new">
            <Plus className="w-4 h-4 mr-2" />
            Добавить место
          </Link>
        </Button>
      </div>

      {/* Places List */}
      <div className="space-y-3">
        {places.map((place) => (
          <PlaceCardHorizontal
            key={place.id}
            place={place}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
