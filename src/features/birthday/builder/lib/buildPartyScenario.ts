import type { BirthdayOffer, BirthdayTheme } from "../../types/birthday";
import type { PlaceType } from "../types/builder";

const THEME_LABELS: Partial<Record<BirthdayTheme, string>> = {
  princess: "Принцессы",
  superhero: "Супергерои",
  dinosaur: "Динозавры",
  unicorn: "Единороги",
  pirate: "Пираты",
  science: "Наука",
  art: "Творчество",
  sport: "Спорт",
  any: "Любая",
};

const PLACE_EMOJI: Record<string, string> = {
  HOME: "🏠",
  VENUE: "🎪",
  OUTDOOR: "🌳",
};

/** Одна строка сценария для списка (эмодзи + текст) */
export type ScenarioLine = { emoji: string; text: string };

export function getFormatPlaceLine(
  placeType: PlaceType | null,
  selectedBase: BirthdayOffer | null,
): ScenarioLine {
  if (placeType === "HOME") {
    return { emoji: PLACE_EMOJI.HOME, text: "Дома" };
  }
  if (placeType === "OUTDOOR") {
    return { emoji: PLACE_EMOJI.OUTDOOR, text: "На природе" };
  }
  if (placeType === "VENUE" && selectedBase) {
    return { emoji: "📍", text: selectedBase.title };
  }
  if (placeType === "VENUE") {
    return { emoji: PLACE_EMOJI.VENUE, text: "В заведении" };
  }
  return { emoji: "📍", text: "Формат не выбран" };
}

export function themeLine(theme: BirthdayTheme | null): ScenarioLine | null {
  if (!theme || theme === "any") return null;
  const label = THEME_LABELS[theme];
  if (!label) return null;
  return { emoji: "✨", text: `Тема: ${label}` };
}

/** Ориентировочная длительность — не таймлайн по минутам */
export function estimatePartyDuration(offers: BirthdayOffer[]): string | null {
  if (offers.length === 0) return null;
  let h = 1.5;
  const hasBase = offers.some((o) => o.layer === "BASE");
  if (hasBase) h += 0.5;
  const addons = offers.filter((o) => o.layer !== "BASE").length;
  h += Math.min(addons * 0.35, 1.5);
  const hMin = Math.round(h * 10) / 10;
  const hMax = Math.round((h + 0.5) * 10) / 10;
  const fmt = (x: number) => (Number.isInteger(x) ? `${x}` : x.toFixed(1).replace(/\.0$/, ""));
  return `${fmt(hMin)}–${fmt(hMax)} ч`;
}

export function offerEmojiForLayer(layer: BirthdayOffer["layer"]): string {
  switch (layer) {
    case "BASE":
      return "📍";
    case "ENTERTAINMENT":
      return "🎭";
    case "FOOD":
      return "🎂";
    case "DECOR":
      return "🎈";
    default:
      return "✓";
  }
}

/** Короткая подпись длительности из названия, если есть «ч» / «час» */
export function durationHintFromTitle(title: string): string | null {
  const m = title.match(/(\d+(?:[.,]\d+)?)\s*(ч\.?|час)/i);
  if (!m) return null;
  return m[0].replace(/\s+/g, " ").trim();
}

// ─── Timeline (final step): sequential services from one start time ─────────

function parseDurationMinutesFromTitle(title: string): number | null {
  const h = title.match(/(\d+(?:[.,]\d+)?)\s*ч/i);
  if (h) {
    const n = parseFloat(h[1].replace(",", "."));
    if (!Number.isNaN(n)) return Math.round(n * 60);
  }
  const min = title.match(/(\d+)\s*мин/i);
  if (min) return parseInt(min[1], 10);
  return null;
}

/** Длительность блока услуги в минутах (из названия или по слою) */
export function getOfferDurationMinutes(offer: BirthdayOffer): number {
  const fromTitle = parseDurationMinutesFromTitle(offer.title);
  if (fromTitle != null && fromTitle > 0) {
    return Math.min(Math.max(fromTitle, 15), 300);
  }
  switch (offer.layer) {
    case "BASE":
      return 120;
    case "ENTERTAINMENT":
      return 90;
    case "FOOD":
      return 30;
    case "DECOR":
      return 45;
    default:
      return 60;
  }
}

export function formatDurationRuShort(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = minutes / 60;
  if (Number.isInteger(h)) return `${h} ч`;
  const rounded = Math.round(h * 10) / 10;
  return `${String(rounded).replace(/\.0$/, "")} ч`;
}

function parseHHmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 15 * 60;
  return h * 60 + m;
}

function minutesToHHmm(totalMinutes: number): string {
  const d = new Date(2000, 0, 1, 0, 0, 0);
  d.setMinutes(d.getMinutes() + totalMinutes);
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export type TimelineSegment = {
  time: string;
  label: string;
  /** Напр. длительность блока */
  sub?: string;
  /** Для строк услуги — связь с оффером (подсветка в сценарии) */
  offerId?: string;
};

export type CelebrationTimeline = {
  segments: TimelineSegment[];
  /** Время окончания (HH:mm) */
  endHHmm: string;
  /** От начала приёма до конца, минут */
  totalMinutes: number;
};

/**
 * Строит последовательный таймлайн: приём гостей → услуги по порядку → окончание.
 */
export function buildCelebrationTimeline(
  offers: BirthdayOffer[],
  timeStartHHmm: string,
  options?: { arrivalMinutes?: number },
): CelebrationTimeline {
  const arrival = options?.arrivalMinutes ?? 15;
  const startM = parseHHmmToMinutes(timeStartHHmm);
  const segments: TimelineSegment[] = [];
  let cur = startM;

  segments.push({
    time: minutesToHHmm(cur),
    label: "Старт / приход гостей",
    sub: `${arrival} мин`,
  });
  cur += arrival;

  for (const offer of offers) {
    const dur = getOfferDurationMinutes(offer);
    const emoji = offerEmojiForLayer(offer.layer);
    segments.push({
      time: minutesToHHmm(cur),
      label: `${emoji} ${offer.title}`.trim(),
      sub: formatDurationRuShort(dur),
      offerId: offer.id,
    });
    cur += dur;
  }

  segments.push({
    time: minutesToHHmm(cur),
    label: "Окончание",
  });

  return {
    segments,
    endHHmm: minutesToHHmm(cur),
    totalMinutes: cur - startM,
  };
}

// ─── Заявки организаторам: слоты по офферам, сгруппированные по организатору ─

export type OrganizerServiceSlot = {
  offerId: string;
  title: string;
  startHHmm: string;
  endHHmm: string;
};

export type OrganizerRequestPreview = {
  organizerKey: string;
  organizerName: string;
  services: OrganizerServiceSlot[];
  requestStartHHmm: string;
  requestEndHHmm: string;
};

function organizerKeyFromOffer(offer: BirthdayOffer): string {
  return offer.businessId || offer.businessName || `solo-${offer.id}`;
}

/**
 * Интервалы услуг по каждому организатору (тот же порядок и длительности, что и в таймлайне).
 */
export function buildOrganizerRequestPreviews(
  offers: BirthdayOffer[],
  timeStartHHmm: string,
  options?: { arrivalMinutes?: number },
): OrganizerRequestPreview[] {
  const arrival = options?.arrivalMinutes ?? 15;
  const startM = parseHHmmToMinutes(timeStartHHmm);
  let cur = startM + arrival;

  const groups = new Map<
    string,
    { organizerName: string; services: OrganizerServiceSlot[] }
  >();

  for (const offer of offers) {
    const dur = getOfferDurationMinutes(offer);
    const startHHmm = minutesToHHmm(cur);
    const endCur = cur + dur;
    const endHHmm = minutesToHHmm(endCur);
    const key = organizerKeyFromOffer(offer);
    if (!groups.has(key)) {
      groups.set(key, {
        organizerName: offer.businessName || "Организатор",
        services: [],
      });
    }
    groups.get(key)!.services.push({
      offerId: offer.id,
      title: offer.title,
      startHHmm,
      endHHmm,
    });
    cur = endCur;
  }

  const order: string[] = [];
  const seen = new Set<string>();
  for (const offer of offers) {
    const k = organizerKeyFromOffer(offer);
    if (!seen.has(k)) {
      seen.add(k);
      order.push(k);
    }
  }

  return order.map((organizerKey) => {
    const g = groups.get(organizerKey)!;
    const { services, organizerName } = g;
    const starts = services.map((s) => parseHHmmToMinutes(s.startHHmm));
    const ends = services.map((s) => parseHHmmToMinutes(s.endHHmm));
    return {
      organizerKey,
      organizerName,
      services,
      requestStartHHmm: minutesToHHmm(Math.min(...starts)),
      requestEndHHmm: minutesToHHmm(Math.max(...ends)),
    };
  });
}

/** Для сводки: «~3–3.5 ч» */
export function formatTotalDurationApprox(totalMinutes: number): string {
  const h = totalMinutes / 60;
  const low = Math.max(0.5, Math.floor(h * 2) / 2);
  const high = Math.max(low, Math.ceil(h * 2) / 2);
  if (low === high) return `~${low} ч`;
  return `~${low}–${high} ч`;
}
