"use client";

import { LocationBlock } from "@/components/shared/LocationBlock";

interface PlaceAddressSectionProps {
  title: string;
  logoUrl?: string | null;
  shortDesc?: string;
  tagline?: string;
  address?: string;
  district?: string;
  metro?: string;
  latitude?: number;
  longitude?: number;
  mapsDirectionsUrl?: string;
}

export function PlaceAddressSection({
  title,
  logoUrl,
  tagline,
  address,
  district,
  metro,
  latitude,
  longitude,
  mapsDirectionsUrl,
}: PlaceAddressSectionProps) {
  return (
    <LocationBlock
      name={title}
      logoUrl={logoUrl ?? undefined}
      tagline={tagline}
      address={address}
      district={district}
      metro={metro}
      lat={latitude}
      lng={longitude}
      routeUrl={mapsDirectionsUrl}
      kicker="Где находится"
    />
  );
}
