"use client";

import { LocationBlock } from "@/components/shared/LocationBlock";

interface PlaceAddressSectionProps {
  title: string;
  shortDesc?: string;
  tagline?: string;
  address?: string;
  district?: string;
  metro?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  mapsDirectionsUrl?: string;
}

export function PlaceAddressSection({
  title,
  tagline,
  address,
  district,
  metro,
  phone,
  latitude,
  longitude,
  mapsDirectionsUrl,
}: PlaceAddressSectionProps) {
  return (
    <LocationBlock
      name={title}
      tagline={tagline}
      address={address}
      district={district}
      metro={metro}
      phone={phone}
      lat={latitude}
      lng={longitude}
      routeUrl={mapsDirectionsUrl}
      kicker="Где находится"
    />
  );
}
