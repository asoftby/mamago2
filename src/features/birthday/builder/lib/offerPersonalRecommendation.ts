import type { BirthdayOffer, BirthdayTheme } from "../../types/birthday";
import type { PartyForChild } from "../types/builder";
import { getNameCase } from "../../lib/nameCase";
import { ageYearsFromBirthDate } from "./partyChildUtils";
import { getSystemInterestLabel } from "@/lib/config/interests";
import {
  pickInterestSlugsForBaseOffer,
  pickInterestSlugsForOffer,
} from "./quickAddonSummary";

const THEME_LABEL_RU: Partial<Record<BirthdayTheme, string>> = {
  princess: "принцессы",
  superhero: "супергероев",
  dinosaur: "динозавров",
  unicorn: "единорогов",
  pirate: "пиратов",
  science: "науки",
  art: "творчества",
  sport: "спорта",
  any: "любой",
};

export type PersonalRecommendation = {
  first: string;
  second?: string;
};

function yearsLabelRu(years: number): string {
  const n = Math.floor(Math.abs(years));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} лет`;
  if (mod10 === 1) return `${n} год`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} года`;
  return `${n} лет`;
}

function themeMatchesOffer(theme: BirthdayTheme, blob: string): boolean {
  return (
    ((theme === "princess" || theme === "unicorn") &&
      /принцес|единорог|сказк|королев/i.test(blob)) ||
    (theme === "superhero" && /супергер|герой/i.test(blob)) ||
    (theme === "dinosaur" && /динозавр|юрск/i.test(blob)) ||
    (theme === "pirate" && /пират|корабл|сокровищ/i.test(blob)) ||
    (theme === "science" && /наук|лаборатор|опыт|робот/i.test(blob)) ||
    (theme === "art" && /мастер|творч|рисован|арт|декор/i.test(blob)) ||
    (theme === "sport" &&
      /спорт|игр|батут|актив|квест|аниматор|шоу/i.test(blob))
  );
}

/** Короткая бытовая формулировка по набранным интересам */
function interestHookFromSlugs(slugs: string[]): string {
  if (slugs.includes("quiet-activities") || slugs.includes("books")) {
    return "спокойный темп без лишнего шума";
  }
  if (slugs.includes("sport") || slugs.includes("active-games")) {
    return "активные игры и движение";
  }
  if (slugs.includes("music") || slugs.includes("dance")) {
    return "музыку, ритм и настроение";
  }
  if (slugs.includes("art") || slugs.includes("creativity")) {
    return "творчество и красоту деталей";
  }
  if (
    slugs.includes("science") ||
    slugs.includes("technology") ||
    slugs.includes("construction")
  ) {
    return "эксперименты и открытия";
  }
  if (slugs.includes("animals") || slugs.includes("nature")) {
    return "природу и «живой» сюжет";
  }
  return slugs
    .slice(0, 2)
    .map(getSystemInterestLabel)
    .join(" и ")
    .toLowerCase();
}

function matchedInterestSlugs(
  offer: BirthdayOffer,
  partySlugs: string[],
): string[] {
  if (offer.layer === "BASE") {
    return pickInterestSlugsForBaseOffer(offer, partySlugs);
  }
  return pickInterestSlugsForOffer(offer, partySlugs);
}

function buildFirstSentence(
  offer: BirthdayOffer,
  partyForChild: PartyForChild | null,
  theme: BirthdayTheme | null,
): string {
  const name = partyForChild?.name?.trim();
  const years = partyForChild?.birthDateIso
    ? ageYearsFromBirthDate(partyForChild.birthDateIso)
    : null;
  const slugs = partyForChild?.interestSlugs ?? [];
  const matched = matchedInterestSlugs(offer, slugs);

  if (matched.length > 0) {
    const hook = interestHookFromSlugs(matched);
    if (name) {
      const who = getNameCase(name, "dative");
      return `${who} точно зайдёт — ${hook}.`;
    }
    return `По интересам это очень в тему — ${hook}.`;
  }

  if (theme && theme !== "any") {
    const tl = THEME_LABEL_RU[theme];
    if (tl) {
      const blob = `${offer.title} ${offer.shortDescription ?? ""}`.toLowerCase();
      if (themeMatchesOffer(theme, blob)) {
        return `Под выбранную тему «${tl}» — здесь это чувствуется в деталях.`;
      }
    }
  }

  if (
    years != null &&
    offer.ageMin != null &&
    offer.ageMax != null &&
    years >= offer.ageMin &&
    years <= offer.ageMax
  ) {
    return `Возраст ${yearsLabelRu(years)} — как раз в зоне комфорта этого предложения.`;
  }

  return "Универсальный вариант — обычно заходит без промаха.";
}

function buildSecondSentence(offer: BirthdayOffer): string {
  const blob = `${offer.title} ${offer.shortDescription ?? ""}`.toLowerCase();
  const quiet = /спокойн|настольн|книг/i.test(blob);

  if (offer.layer === "DECOR" || offer.category === "DECOR") {
    return "Часто берут, чтобы праздник лучше смотрелся в фото.";
  }
  if (offer.layer === "FOOD") {
    return "Удобно заказать вместе с остальным — меньше суеты в день Х.";
  }
  if (offer.layer === "BASE") {
    if (offer.isFeatured && (offer.reviewCount ?? 0) >= 120) {
      return "Часто выбирают, когда важны и эмоции, и удобство.";
    }
    if ((offer.reviewCount ?? 0) >= 50) {
      return "Много отзывов — родителям спокойнее за бронь.";
    }
    return "Часто выбирают, когда важны и эмоции, и удобство.";
  }
  if (offer.layer === "ENTERTAINMENT") {
    if (quiet) {
      return "Хороший выбор, если хотите поменьше шума.";
    }
    return "Часто берут, чтобы дети не скучали ни минуты.";
  }
  return "Популярный вариант — без лишних сомнений.";
}

/**
 * До 2 коротких фраз: персональный матч (интересы → тема → возраст → fallback) + социальное доказательство.
 */
export function generatePersonalRecommendation(
  offer: BirthdayOffer,
  ctx: {
    partyForChild: PartyForChild | null;
    theme: BirthdayTheme | null;
  },
): PersonalRecommendation {
  const first = buildFirstSentence(offer, ctx.partyForChild, ctx.theme);
  const second = buildSecondSentence(offer);
  return { first, second };
}

/** Для aria / title — одна строка */
export function personalRecommendationAria(rec: PersonalRecommendation): string {
  return rec.second ? `${rec.first} ${rec.second}` : rec.first;
}
