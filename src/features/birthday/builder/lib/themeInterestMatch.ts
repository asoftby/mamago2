import type { BirthdayTheme } from "../../types/birthday";

/**
 * Веса связи между интересами ребёнка (slug из SYSTEM_INTERESTS)
 * и конкретной тематикой праздника.
 */
export const INTEREST_TO_PARTY_THEME_SCORE_MAP: Partial<
  Record<string, Partial<Record<BirthdayTheme, number>>>
> = {
  sport: { sport: 5, superhero: 3 },
  "active-games": { sport: 5, superhero: 4 },
  science: { science: 5 },
  technology: { science: 5 },
  construction: { science: 3, dinosaur: 2 },
  art: { art: 5 },
  creativity: { art: 5, unicorn: 2, princess: 2 },
  dance: { art: 3, princess: 2, unicorn: 2 },
  music: { art: 3, unicorn: 2, princess: 1 },
  animals: { dinosaur: 3, unicorn: 1 },
  nature: { dinosaur: 3 },
  books: { pirate: 2, science: 1 },
  "quiet-activities": { art: 3, unicorn: 2 },
};

export type ThemeOption = {
  value: BirthdayTheme;
  emoji: string;
  label: string;
};

export function getThemeScoresByChildInterests(
  interestSlugs: string[],
): Partial<Record<BirthdayTheme, number>> {
  return interestSlugs.reduce<Partial<Record<BirthdayTheme, number>>>(
    (acc, slug) => {
      const themeScores = INTEREST_TO_PARTY_THEME_SCORE_MAP[slug];
      if (!themeScores) return acc;

      for (const [themeId, score] of Object.entries(themeScores)) {
        const typedThemeId = themeId as BirthdayTheme;
        acc[typedThemeId] = (acc[typedThemeId] ?? 0) + score;
      }

      return acc;
    },
    {},
  );
}

export function themesMatchingInterests(
  interestSlugs: string[],
): Set<BirthdayTheme> {
  const scores = getThemeScoresByChildInterests(interestSlugs);
  return new Set(
    Object.entries(scores)
      .filter(([, score]) => typeof score === "number" && score > 0)
      .map(([themeId]) => themeId as BirthdayTheme),
  );
}

export function getRecommendedPartyThemeByChildInterests(
  interestSlugs: string[],
): {
  themeId: BirthdayTheme;
  reason: "interests" | "fallback";
  score: number;
} | null {
  if (!interestSlugs.length) return null;

  const scores = getThemeScoresByChildInterests(interestSlugs);
  let bestTheme: BirthdayTheme | null = null;
  let bestScore = 0;

  for (const [themeId, score] of Object.entries(scores)) {
    if (typeof score !== "number" || score <= bestScore) continue;
    bestTheme = themeId as BirthdayTheme;
    bestScore = score;
  }

  if (!bestTheme || bestScore <= 0) return null;

  return {
    themeId: bestTheme,
    reason: "interests",
    score: bestScore,
  };
}

export function partitionThemesByInterestMatch(
  options: ThemeOption[],
  interestSlugs: string[],
): { matched: ThemeOption[]; rest: ThemeOption[]; hasMatches: boolean } {
  if (!interestSlugs.length) {
    return { matched: [], rest: options, hasMatches: false };
  }

  const matchedThemes = themesMatchingInterests(interestSlugs);
  const matched = options.filter((option) => matchedThemes.has(option.value));
  const rest = options.filter((option) => !matchedThemes.has(option.value));
  return { matched, rest, hasMatches: matched.length > 0 };
}

export function firstThemeForSoftPreselect(
  matched: ThemeOption[],
): BirthdayTheme | null {
  const nonAny = matched.find((option) => option.value !== "any");
  if (nonAny) return nonAny.value;
  const anyOption = matched.find((option) => option.value === "any");
  return anyOption?.value ?? null;
}
