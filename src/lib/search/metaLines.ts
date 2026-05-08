import { formatPriceFrom } from "@/lib/formatters/format-price";

/** Shared meta lines for SearchDocument (mirrors public search card hints). */

export function formatPrice(from: number | null | undefined, currency: string | null | undefined): string {
  if (from == null || Number.isNaN(from)) return "";
  void currency; // currency param kept for API compat; always uses BYN
  const c = "BYN";
  return `от ${Math.round(from)} ${c}`;
}

export function activityMetaLine(args: {
  nextOccurrenceAt: Date | null;
  ageLabel: string | null;
  priceFrom: number | null;
  currency: string | null;
}): string {
  const parts: string[] = [];
  if (args.nextOccurrenceAt) {
    const d = new Date(args.nextOccurrenceAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    if (dd.getTime() === today.getTime()) parts.push("Сегодня");
    else {
      parts.push(d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }));
    }
  }
  if (args.ageLabel?.trim()) parts.push(args.ageLabel.trim());
  const p = formatPrice(args.priceFrom, args.currency);
  if (p) parts.push(p);
  return parts.join(" · ") || "Событие";
}

import { getPlaceSearchAddressMetaLine } from "@/lib/placeLocationString";

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
    args.priceText?.trim() ||
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
