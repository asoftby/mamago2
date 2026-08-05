import { formatPriceFrom, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import { getPlaceSearchAddressMetaLine } from "@/lib/placeLocationString";
import { formatAgeKeysShort } from "@/lib/config/ages";
import {
  ageBoundsFromActivityFields,
  ageFromPlusBadgeFromAgeTags,
  ageFromPlusLabelFromBounds,
} from "@/lib/event/activityAgeBounds";

/** Shared meta lines for SearchDocument (mirrors public search card hints). */

export function formatPrice(from: number | null | undefined, currency: string | null | undefined): string {
  if (from == null || Number.isNaN(from)) return "";
  void currency; // currency param kept for API compat; always uses BYN
  return formatPriceFrom(Math.round(from), { hideZero: true });
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Возраст для карточки поиска — тот же канон, что у EventCard / «Куда пойти»:
 * ageLabel → badge из ageTags → short tags → `${ageFrom}+` из ageBoundsFromActivityFields.
 */
export function resolveActivityAgeLabel(args: {
  ageLabel?: string | null;
  ageTags?: string[] | null;
  ageMinMonths?: number | null;
  ageMaxMonths?: number | null;
}): string | null {
  const labeled = args.ageLabel?.trim();
  if (labeled) return labeled;

  const fromTagsBadge = ageFromPlusBadgeFromAgeTags(args.ageTags ?? []);
  if (fromTagsBadge) return fromTagsBadge;

  const fromTagsShort = formatAgeKeysShort(args.ageTags ?? []);
  if (fromTagsShort) return fromTagsShort;

  const { ageFrom } = ageBoundsFromActivityFields({
    ageTags: args.ageTags ?? [],
    ageMinMonths: args.ageMinMonths,
    ageMaxMonths: args.ageMaxMonths,
  });
  return ageFromPlusLabelFromBounds(ageFrom);
}

/** Адрес для второй строки карточки события в поиске: «Город, улица …». */
export function activityAddressLine(args: {
  venueTitle?: string | null;
  venueAddressLine?: string | null;
  placeTitle?: string | null;
  placeShortAddress?: string | null;
  placeFormattedAddr?: string | null;
  placeDisplayAddress?: string | null;
  placeCustomAddress?: string | null;
  cityName?: string | null;
}): string | null {
  const city = args.cityName?.trim() || null;

  const rawAddress =
    args.venueAddressLine?.trim() ||
    args.placeDisplayAddress?.trim() ||
    args.placeShortAddress?.trim() ||
    args.placeFormattedAddr?.trim() ||
    args.placeCustomAddress?.trim() ||
    args.placeTitle?.trim() ||
    args.venueTitle?.trim() ||
    "";

  if (!rawAddress && !city) return null;
  if (!rawAddress) return city;
  if (!city) return rawAddress;

  // Убираем хвост/префикс с городом, если он уже вшит в строку адреса.
  let street = rawAddress;
  const cityEscaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  street = street
    .replace(new RegExp(`^,\\s*${cityEscaped}\\s*,?\\s*`, "i"), "")
    .replace(new RegExp(`,\\s*${cityEscaped}\\s*$`, "i"), "")
    .replace(new RegExp(`^${cityEscaped}\\s*,\\s*`, "i"), "")
    .replace(new RegExp(`^г\\.?\\s*${cityEscaped}\\s*,\\s*`, "i"), "")
    .trim();

  if (!street || street.toLowerCase() === city.toLowerCase()) return city;
  return `${city}, ${street}`;
}

/**
 * Возраст · дата · время · стоимость — для карточки события в поиске.
 * Без адреса (он в summaryLine / activityAddressLine).
 */
export function activityMetaLine(args: {
  nextOccurrenceAt: Date | null;
  ageLabel: string | null;
  priceFrom: number | null;
  currency: string | null;
  priceText?: string | null;
}): string {
  const parts: string[] = [];

  if (args.ageLabel?.trim()) parts.push(args.ageLabel.trim());

  if (args.nextOccurrenceAt) {
    const d = new Date(args.nextOccurrenceAt);
    if (!Number.isNaN(d.getTime())) {
      const today = new Date();
      const dateLabel = isSameLocalDay(d, today)
        ? "Сегодня"
        : formatRuShortDayMonth(d);
      if (dateLabel) parts.push(dateLabel);

      const timeLabel = d.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (timeLabel) parts.push(timeLabel);
    }
  }

  const price =
    normalizeUiCurrencyText(args.priceText?.trim()) ||
    formatPrice(args.priceFrom, args.currency);
  if (price) parts.push(price);

  return parts.join(" · ") || "Событие";
}

export function placeMetaLine(args: {
  cityName: string | null | undefined;
  shortAddress: string | null | undefined;
  formattedAddr: string | null | undefined;
  customAddress: string | null | undefined;
  floor: string | null | undefined;
  unit: string | null | undefined;
  unitLabel: string | null | undefined;
}): string {
  return getPlaceSearchAddressMetaLine({
    city: args.cityName ? { name: args.cityName } : null,
    shortAddress: args.shortAddress,
    formattedAddr: args.formattedAddr,
    customAddress: args.customAddress,
    floor: args.floor,
    unit: args.unit,
    unitLabel: args.unitLabel,
  });
}

export function offerMetaLine(args: {
  priceText: string | null | undefined;
  priceFrom: number | null | undefined;
  placeCity: string | null | undefined;
  placeTitle: string | null | undefined;
}): string {
  const placeLine = [args.placeCity, args.placeTitle].filter(Boolean).join(" · ");
  const price =
    normalizeUiCurrencyText(args.priceText?.trim()) ||
    (args.priceFrom != null ? formatPrice(args.priceFrom, "BYN") : "");
  return [price, placeLine].filter(Boolean).join(" · ") || "Предложение";
}

export function routeMetaLine(cityName: string | null | undefined): string {
  const meta = [cityName, "подборка"].filter(Boolean).join(" · ");
  return meta || "Маршрут";
}

export function articleMetaLine(publishedAt: Date | null | undefined): string {
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  return dateStr ? `Публикация · ${dateStr}` : "Статья";
}
