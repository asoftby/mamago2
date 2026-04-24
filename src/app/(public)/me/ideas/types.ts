import type { PlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";

export type IdeaItem = {
  id: string;
  activity: {
    id: string;
    title: string;
    type: "EVENT" | "PLACE" | "ROUTE" | "OFFER";
    coverImageUrl?: string;
    city?: string;
    ageRange?: string;
    dateStart?: string;
    dateEnd?: string;
    priceLabel?: string;
  };
  planAvailability?: PlanActivityPublicAvailability;
  isPlanned: boolean;
  plannedDate?: string;
  createdAt: string;
};

export type Filter = "ALL" | "PLANNED" | "UNPLANNED";
