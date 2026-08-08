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
    label: "Буст близости",
    description: "Приоритет контенту рядом с пользователем",
    icon: "MapPin",
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: "freshnessBoost",
    label: "Буст свежести",
    description: "Приоритет недавно добавленному или обновлённому контенту",
    icon: "Sparkles",
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: "popularityBoost",
    label: "Буст популярности",
    description: "Приоритет контенту с высокими просмотрами и бронированиями",
    icon: "TrendingUp",
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: "partnerBoost",
    label: "Буст партнёров",
    description: "Приоритет контенту от проверенных партнёров",
    icon: "Award",
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: "ageBoost",
    label: "Буст соответствия возрасту",
    description: "Приоритет контенту, подходящему по возрасту ребёнка",
    icon: "Users",
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: "cityBoost",
    label: "Буст соответствия городу",
    description: "Приоритет контенту в городе пользователя",
    icon: "Building2",
    min: 0,
    max: 100,
    step: 5,
  },
];
