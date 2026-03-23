import type { BirthdayOffer, BirthdayTheme } from "../../types/birthday";
import type { PartyForChild } from "../types/builder";
import { ageYearsFromBirthDate } from "./partyChildUtils";
import { getSystemInterestLabel } from "@/lib/config/interests";
import { cn } from "@/lib/utils";

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

export type QuickAddonBadgeVariant = "interest" | "fit" | "signal";

export type QuickAddonBadge = {
  id: string;
  label: string;
  variant: QuickAddonBadgeVariant;
};

/** Slugs интересов, релевантных типу услуги (доп. услуги) */
export function pickInterestSlugsForOffer(
  offer: BirthdayOffer,
  slugs: string[],
): string[] {
  const out: string[] = [];
  const take = (s: string) => {
    if (slugs.includes(s) && !out.includes(s)) out.push(s);
  };

  if (offer.layer === "ENTERTAINMENT") {
    ["sport", "active-games", "music", "dance", "quiet-activities"].forEach(
      take,
    );
  }
  if (offer.layer === "DECOR" || offer.category === "DECOR") {
    ["art", "creativity"].forEach(take);
  }

  if (out.length === 0 && slugs.length > 0) {
    return slugs.slice(0, 2);
  }
  return out.slice(0, 2);
}

/** Короткий «стиль» в начале фразы (доп. услуги) */
function addonStyleLead(offer: BirthdayOffer): string | null {
  if (offer.layer === "DECOR" || offer.category === "DECOR") {
    return "Добавит вау-эффект для фото";
  }
  if (offer.layer === "ENTERTAINMENT") {
    const blob = offer.title + (offer.shortDescription ?? "");
    if (/спокойн|настольн|книг/i.test(blob)) return "Спокойная программа";
    if (/клоун|конкурс|квест|игр|шоу/i.test(blob)) return "Активные игры";
    return "Активные игры";
  }
  return null;
}

function yearsLabelRu(years: number): string {
  const n = Math.floor(Math.abs(years));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} лет`;
  if (mod10 === 1) return `${n} год`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} года`;
  return `${n} лет`;
}

/** Часть 2: насколько удачный выбор */
function buildAddonValueExplanation(offer: BirthdayOffer): string {
  if (offer.isFeatured && (offer.reviewCount ?? 0) >= 120) {
    return "топ выбор";
  }
  if (
    offer.layer === "DECOR" ||
    offer.category === "DECOR" ||
    (offer.reviewCount ?? 0) >= 70 ||
    offer.compatibility?.isVenueExclusive
  ) {
    return "часто берут";
  }
  if (!offer.isFeatured && offer.layer === "ENTERTAINMENT") {
    return "можно пропустить";
  }
  return "базовый вариант";
}

/** Часть 1: почему подходит (интересы → тема → возраст → fallback) */
function buildAddonMatchExplanation(
  offer: BirthdayOffer,
  partyForChild: PartyForChild | null,
  theme: BirthdayTheme | null,
): string {
  const slugs = partyForChild?.interestSlugs ?? [];
  const name = partyForChild?.name?.trim();
  const years = partyForChild?.birthDateIso
    ? ageYearsFromBirthDate(partyForChild.birthDateIso)
    : null;
  const matched = pickInterestSlugsForOffer(offer, slugs);

  if (matched.length > 0) {
    if (matched.includes("quiet-activities") && offer.layer === "ENTERTAINMENT") {
      return "Скорее спокойный формат";
    }
    const lead = addonStyleLead(offer);
    if (name) {
      const tail = `под интересы ${name}`;
      if (lead) return `${lead} — ${tail}`;
      return tail.charAt(0).toUpperCase() + tail.slice(1);
    }
    const labels = matched
      .slice(0, 2)
      .map(getSystemInterestLabel)
      .join(", ");
    const tail = `под интересы: ${labels}`;
    if (lead) return `${lead} — ${tail}`;
    return tail.charAt(0).toUpperCase() + tail.slice(1);
  }

  if (theme && theme !== "any") {
    const tl = THEME_LABEL_RU[theme];
    if (tl) {
      const blob = `${offer.title} ${offer.shortDescription ?? ""}`.toLowerCase();
      const themeFits =
        ((theme === "princess" || theme === "unicorn") &&
          /принцес|единорог|сказк|королев/i.test(blob)) ||
        (theme === "superhero" && /супергер|герой/i.test(blob)) ||
        (theme === "dinosaur" && /динозавр|юрск/i.test(blob)) ||
        (theme === "pirate" && /пират|корабл|сокровищ/i.test(blob)) ||
        (theme === "science" && /наук|лаборатор|опыт|робот/i.test(blob)) ||
        (theme === "art" && /мастер|творч|рисован|арт|декор/i.test(blob)) ||
        (theme === "sport" &&
          /спорт|игр|батут|актив|квест|аниматор|шоу/i.test(blob));
      if (themeFits) {
        return `Под тему «${tl}»`;
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
    return `Оптимально для ${yearsLabelRu(years)}`;
  }

  return "Хороший универсальный вариант";
}

/**
 * Одна строка для карточки доп. услуги: [почему подходит] • [оценка выбора]
 */
export function generateAddonServiceSummary(
  offer: BirthdayOffer,
  ctx: {
    partyForChild: PartyForChild | null;
    theme: BirthdayTheme | null;
  },
): string {
  const match = buildAddonMatchExplanation(
    offer,
    ctx.partyForChild,
    ctx.theme,
  );
  const value = buildAddonValueExplanation(offer);
  return `${match} • ${value}`;
}

export function generateQuickAddonSummary(
  offer: BirthdayOffer,
  ctx: {
    partyForChild: PartyForChild | null;
    theme: BirthdayTheme | null;
  },
): string {
  return generateAddonServiceSummary(offer, ctx);
}

// ─── BASE (площадки / пакеты) — те же варианты бейджей ─────────────────────

function offerTextBlob(offer: BirthdayOffer): string {
  return `${offer.title} ${offer.shortDescription ?? ""}`.toLowerCase();
}

export function pickInterestSlugsForBaseOffer(
  offer: BirthdayOffer,
  slugs: string[],
): string[] {
  if (slugs.length === 0) return [];
  const t = offerTextBlob(offer);
  const out: string[] = [];
  const tryAdd = (s: string) => {
    if (!slugs.includes(s) || out.includes(s)) return;
    if (s === "sport" || s === "active-games") {
      if (
        /супергер|герой|спорт|квест|игр|батут|аниматор|актив|скалолаз|полос/i.test(
          t,
        )
      )
        out.push(s);
    } else if (s === "music" || s === "dance") {
      if (/музык|танц|дискотек|караоке|шоу/i.test(t)) out.push(s);
    } else if (s === "art" || s === "creativity") {
      if (/мастер|творч|арт|корона|рисован|декор|фотозон|украшен/i.test(t))
        out.push(s);
    } else if (s === "science" || s === "technology" || s === "construction") {
      if (/наук|конструктор|робот|эксперимент/i.test(t)) out.push(s);
    } else if (s === "animals" || s === "nature") {
      if (/животн|джунгл|природ|зоо|лес/i.test(t)) out.push(s);
    } else if (s === "books" || s === "quiet-activities") {
      if (/книг|спокойн|настольн/i.test(t)) out.push(s);
    }
  };
  for (const s of slugs) tryAdd(s);
  if (out.length === 0) return slugs.slice(0, 2);
  return [...new Set(out)].slice(0, 2);
}

function fitBadgeForBase(
  offer: BirthdayOffer,
  theme: BirthdayTheme | null,
): string | null {
  const t = offerTextBlob(offer);
  if (theme && theme !== "any") {
    const tl = THEME_LABEL_RU[theme];
    if (tl) {
      if (theme === "superhero" && /супергер|герой/i.test(t)) return `В тему «${tl}»`;
      if (theme === "princess" && /принцес|королев|сказк/i.test(t))
        return `В тему «${tl}»`;
      if (theme === "dinosaur" && /динозавр|юрск/i.test(t)) return `В тему «${tl}»`;
      if (theme === "sport" && /игров|спорт|батут|квест/i.test(t)) return "Активный формат";
      if (theme === "art" && /мастер|творч|декор/i.test(t)) return "Творческий формат";
    }
  }
  return null;
}

function valueSegmentForBase(offer: BirthdayOffer): string {
  if (offer.isFeatured && (offer.reviewCount ?? 0) >= 80) return "Топ выбор";
  if ((offer.reviewCount ?? 0) >= 50) return "Часто выбирают";
  if ((offer.rating ?? 0) >= 4.8) return "Высоко оценивают";
  return "Удачный вариант";
}

/** Бейджи для карточки площадки / пакета (шаг «Выберите площадку») */
export function getBaseOfferBadges(
  offer: BirthdayOffer,
  ctx: {
    partyForChild: PartyForChild | null;
    theme: BirthdayTheme | null;
  },
): QuickAddonBadge[] {
  const badges: QuickAddonBadge[] = [];
  let k = 0;
  const slugs = ctx.partyForChild?.interestSlugs ?? [];
  const matched = pickInterestSlugsForBaseOffer(offer, slugs);
  for (const slug of matched) {
    badges.push({
      id: `bi-${k++}`,
      label: getSystemInterestLabel(slug),
      variant: "interest",
    });
  }
  const fit = fitBadgeForBase(offer, ctx.theme);
  if (fit) {
    badges.push({ id: `bf-${k++}`, label: fit, variant: "fit" });
  }
  badges.push({
    id: `bs-${k++}`,
    label: valueSegmentForBase(offer),
    variant: "signal",
  });
  return badges;
}

export function generateBaseOfferSummary(
  offer: BirthdayOffer,
  ctx: { partyForChild: PartyForChild | null; theme: BirthdayTheme | null },
): string {
  return getBaseOfferBadges(offer, ctx)
    .map((b) => b.label)
    .join(" · ");
}

/** Единые классы для бейджей в карточках конструктора */
export function quickAddonBadgeClassName(variant: QuickAddonBadgeVariant): string {
  return cn(
    "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[10px] font-medium leading-tight",
    variant === "interest" &&
      "border-stone-200/90 bg-stone-50 text-stone-700",
    variant === "fit" &&
      "border-border/50 bg-muted/40 text-muted-foreground",
    variant === "signal" &&
      "border-[#EF8759]/20 bg-[#FFF7F3] text-[#7a4a32]",
  );
}
