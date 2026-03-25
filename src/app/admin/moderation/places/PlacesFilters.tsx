"use client";

import { ModerationListFilters } from "@/components/admin/moderation/ModerationListFilters";

export function PlacesFilters({ cities }: { cities: { id: string; name: string }[] }) {
  return (
    <ModerationListFilters
      cities={cities}
      basePath="/admin/moderation/places"
      statusFilter="content"
    />
  );
}
