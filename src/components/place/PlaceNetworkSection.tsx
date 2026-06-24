"use client";

import React from "react";
import { PlaceCard } from "./PlaceCard";

export type NetworkPlace = {
  id: string;
  slug: string;
  title: string;
  coverImage?: string | null;
  cityAddress?: string;
  district?: string;
  metro?: string;
  tags?: string[];
  isSaved?: boolean;
};

export type PlaceNetworkSectionProps = {
  places: NetworkPlace[];
  currentPlaceId: string;
  onSaveToggle?: (placeId: string) => void;
  className?: string;
};

export function PlaceNetworkSection({
  places,
  currentPlaceId,
  onSaveToggle,
  className,
}: PlaceNetworkSectionProps) {
  // Filter out current place and only show published places
  const otherPlaces = places.filter((place) => place.id !== currentPlaceId);

  if (otherPlaces.length === 0) {
    return null;
  }

  // Limit to 6 places
  const displayPlaces = otherPlaces.slice(0, 6);

  return (
    <section className={className}>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">
          Другие места
        </h2>
        <p className="text-sm text-muted-foreground">
          Места, которые связаны с этой локацией
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        {displayPlaces.map((place) => (
          <PlaceCard
            key={place.id}
            {...place}
            variant="network"
            onSaveToggle={onSaveToggle}
          />
        ))}
      </div>
    </section>
  );
}
