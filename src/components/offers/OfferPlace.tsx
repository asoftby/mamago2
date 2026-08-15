"use client";

import { LocationBlock } from "@/components/shared/LocationBlock";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";

interface OfferPlaceProps {
  place: NonNullable<OfferPageData["place"]>;
  citySlug: string;
}

export function OfferPlace({ place, citySlug }: OfferPlaceProps) {
  const hasCoords =
    typeof place.lat === "number" && typeof place.lng === "number";

  const mapsHref = hasCoords
    ? `https://www.google.com/maps?q=${place.lat},${place.lng}`
    : place.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`
    : undefined;

  return (
    <LocationBlock
      name={place.name}
      logoUrl={place.logoUrl ?? undefined}
      tagline={place.tagline ?? undefined}
      address={place.address ?? undefined}
      district={place.district ?? undefined}
      metro={place.metro ?? undefined}
      tags={place.tags ?? []}
      lat={place.lat ?? undefined}
      lng={place.lng ?? undefined}
      routeUrl={mapsHref}
      placeHref={place.slug ? `/${citySlug}/places/${place.slug}` : undefined}
      kicker="Где проходит"
    />
  );
}
