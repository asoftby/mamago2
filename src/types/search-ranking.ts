import type { SearchRankingSettings } from "@prisma/client";

export type { SearchRankingSettings };

export interface RankingBoost {
  key: keyof Omit<SearchRankingSettings, "id" | "createdAt" | "updatedAt">;
  label: string;
  description: string;
  icon: string;
  min: number;
  max: number;
  step: number;
}

export const RANKING_BOOSTS: RankingBoost[] = [
  {
    key: "nearbyBoost",
    label: "Nearby Boost",
    description: "Prioritize content close to user's location",
    icon: "MapPin",
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: "freshnessBoost",
    label: "Freshness Boost",
    description: "Prioritize recently added or updated content",
    icon: "Sparkles",
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: "popularityBoost",
    label: "Popularity Boost",
    description: "Prioritize content with high views and bookings",
    icon: "TrendingUp",
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: "partnerBoost",
    label: "Partner Boost",
    description: "Prioritize verified partner content",
    icon: "Award",
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: "ageBoost",
    label: "Age Matching Boost",
    description: "Prioritize content matching child's age",
    icon: "Users",
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: "cityBoost",
    label: "City Matching Boost",
    description: "Prioritize content in user's city",
    icon: "Building2",
    min: 0,
    max: 100,
    step: 5,
  },
];
