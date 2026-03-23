import type { BirthdayTheme } from "../../types/birthday";

/**
 * Связь интересов ребёнка (slug из SYSTEM_INTERESTS) с тематиками праздника.
 * Один интерес может подсветить несколько тем; несколько интересов — одну тему.
 */
export const INTEREST_SLUG_TO_THEMES: Partial<Record<string, BirthdayTheme[]>> =
  {
    sport: ["sport", "superhero"],
    "active-games": ["sport", "superhero"],
    science: ["science"],
    technology: ["science"],
    construction: ["science", "dinosaur"],
    art: ["art"],
    creativity: ["art", "unicorn", "princess"],
    dance: ["dinosaur", "unicorn", "princess"],
    /** Музыка / вечеринка — без «кричащего» акцента, несколько тем на выбор */
    music: ["unicorn", "art", "princess", "pirate"],
    animals: ["dinosaur", "unicorn"],
    nature: ["dinosaur"],
    books: ["any", "pirate", "science"],
    "quiet-activities": ["art", "unicorn"],
  };

/** Все тематики, которые считаются «подходящими» по списку интересов */
export function themesMatchingInterests(
  interestSlugs: string[],
): Set<BirthdayTheme> {
  const out = new Set<BirthdayTheme>();
  for (const slug of interestSlugs) {
    const themes = INTEREST_SLUG_TO_THEMES[slug];
    if (themes) {
      for (const t of themes) out.add(t);
    }
  }
  return out;
}

export type ThemeOption = {
  value: BirthdayTheme;
  emoji: string;
  label: string;
};

/**
 * Делит опции тем на «совпали с интересами» и «остальные», порядок внутри групп
 * сохраняется как в исходном массиве `options`.
 */
export function partitionThemesByInterestMatch(
  options: ThemeOption[],
  interestSlugs: string[],
): { matched: ThemeOption[]; rest: ThemeOption[]; hasMatches: boolean } {
  if (!interestSlugs.length) {
    return { matched: [], rest: options, hasMatches: false };
  }
  const m = themesMatchingInterests(interestSlugs);
  const matched = options.filter((o) => m.has(o.value));
  const rest = options.filter((o) => !m.has(o.value));
  return { matched, rest, hasMatches: matched.length > 0 };
}

/** Первая тема для мягкого преселекта: предпочитаем не «Любая», если есть другая */
export function firstThemeForSoftPreselect(
  matched: ThemeOption[],
): BirthdayTheme | null {
  const nonAny = matched.find((o) => o.value !== "any");
  if (nonAny) return nonAny.value;
  const anyOpt = matched.find((o) => o.value === "any");
  return anyOpt?.value ?? null;
}
