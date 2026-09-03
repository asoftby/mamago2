import type { PlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";
import type { IdeaPlanStatus } from "@/lib/plan/ideaPlanStatus";

export type IdeaItem = {
  id: string;
  ideaType: "ACTIVITY" | "OFFER" | "ROUTE" | "ARTICLE";
  activity: {
    id: string;
    title: string;
    type: "EVENT" | "PLACE" | "ROUTE" | "OFFER" | "ARTICLE";
    /** resolved cover image url */
    coverImageUrl?: string | null;
    /** for ActivityCard: activity.slug */
    slug?: string | null;
    /** for ActivityCard: city slug for public path */
    citySlug?: string | null;
    /** direct href (for offers / routes / articles) */
    publicHref?: string | null;
    /** ActivityFormat enum value */
    format?: string | null;
    ageTags?: string[];
    /** raw age in months (ageFrom = floor(ageMinMonths / 12)) */
    ageMinMonths?: number | null;
    ageMaxMonths?: number | null;
    ageLabel?: string | null;
    dateStart?: string | null;
    dateEnd?: string | null;
    dateLabel?: string | null;
    /** raw price, 0 = free */
    priceFrom?: number | null;
    priceMax?: number | null;
    /** raw price text (e.g. "бесплатно") */
    priceText?: string | null;
    priceListUsesOt?: boolean | null;
    currency?: string | null;
    placeTitle?: string | null;
    addressLabel?: string | null;
    categoryLabel?: string | null;
    badgeLabel?: string | null;
    kind?: string | null;
    campProgramType?: string | null;
    temporalState?: "UPCOMING" | "ONGOING" | "PAST" | "UNKNOWN";
  };
  planAvailability?: PlanActivityPublicAvailability;
  planStatus: IdeaPlanStatus;
  isPlanned: boolean;
  plannedDate?: string;
  planItemId?: string;
  createdAt: string;
};

export type Filter = "ALL" | "PLANNED" | "UNPLANNED";
