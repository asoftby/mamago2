import type { Intent } from "@/lib/intent";
import type { ActivityFormat } from "@prisma/client";

export type ActivityType =
  | "EVENT_FIXED"
  | "PLACE_FLEX"
  | "CLASS_SCHEDULE"
  | "BIRTHDAY_BOOKING"
  | "ARTICLE";

export interface ActivityMock {
  id: string;
  slug?: string | null;
  citySlug?: string | null;
  href?: string;
  format?: ActivityFormat | null;
  type: ActivityType;
  discoveryIntent?: Intent;
  analyticsEntityType?: "EVENT" | "OFFER";
  title: string;
  description: string;
  image: string;
  coverMediaId?: string | null;
  ageFrom: number;
  ageTo: number;
  priceMin?: number;
  priceMax?: number;
  priceListUsesOt?: boolean;
  priceDetails?: string;
  currency: "BYN";
  district?: string;
  address?: string;
  dateStart?: string;
  dateEnd?: string;
  workingHours?: string;
  tags: string[];
  badge?: string;
  geoBadge?: string;
  ageHintBadge?: string;
  engagementScore?: number;
  rating?: number;
  reviewsCount?: number;
}
