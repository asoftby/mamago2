import { z } from "zod";
import {
  PUBLICATION_PRICE_MODES,
  normalizePublicationPrice,
  type PublicationPriceMode,
} from "./normalizedPrice";
import { PriceItemSchema, parsePriceData, type PriceItem } from "@/lib/priceItems";
import { BYN_SYMBOL, formatPrice, formatPriceFrom, formatPriceRange } from "@/lib/formatters/format-price";

const amount = z.number().finite().nonnegative();

export const SharedPriceDataSchema = z
  .object({
    mode: z.enum(PUBLICATION_PRICE_MODES),
    currency: z.string().trim().min(1),
    min: amount.nullable(),
    max: amount.nullable(),
    items: z.array(PriceItemSchema),
    note: z.string(),
  })
  .superRefine((value, ctx) => {
    const invalid =
      (value.mode === "FREE" && (value.min !== 0 || value.max !== 0)) ||
      (value.mode === "EXACT" && (value.min == null || value.max !== value.min)) ||
      (value.mode === "FROM" && (value.min == null || value.max != null)) ||
      (value.mode === "RANGE" && (value.min == null || value.max == null || value.max < value.min)) ||
      ((value.mode === "NONE" || value.mode === "UNKNOWN") &&
        (value.min != null || value.max != null));
    if (invalid) ctx.addIssue({ code: "custom", message: `Invalid ${value.mode} price values` });
  });

export type SharedPriceData = z.infer<typeof SharedPriceDataSchema>;

export type PublicationPriceSource = {
  priceMode?: PublicationPriceMode | null;
  priceFrom?: unknown;
  priceTo?: unknown;
  currency?: string | null;
  priceItems?: unknown;
  priceText?: unknown;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function priceItemsFromPublication(raw: unknown, currency: string): PriceItem[] {
  const canonical = parsePriceData(raw).items;
  if (canonical.length > 0 || !Array.isArray(raw)) return canonical;

  return raw.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const title = optionalString(row.title);
    const price = typeof row.price === "number" && Number.isFinite(row.price) && row.price >= 0
      ? String(row.price)
      : undefined;
    if (!title || price == null) return [];
    const description = optionalString(row.description);
    const oldPrice = typeof row.oldPrice === "number" && Number.isFinite(row.oldPrice) && row.oldPrice >= 0
      ? String(row.oldPrice)
      : undefined;
    return [{
      id: optionalString(row.id) ?? `offer-price-${index}`,
      label: title,
      price,
      unit: optionalString(row.unit) ?? currency,
      ...(description ? { description } : {}),
      ...(oldPrice ? { oldPrice } : {}),
    }];
  });
}

export function sharedPriceFromPublication(source: PublicationPriceSource): SharedPriceData {
  const priceData = parsePriceData(source.priceItems);
  const currency = source.currency?.trim() || "BYN";
  const normalized = normalizePublicationPrice({
    mode: source.priceMode,
    min: source.priceFrom,
    max: source.priceTo,
    priceItems: source.priceItems,
    priceText: source.priceText,
  });

  return SharedPriceDataSchema.parse({
    mode: normalized.mode,
    currency,
    min: normalized.min,
    max: normalized.max,
    items: priceItemsFromPublication(source.priceItems, currency),
    note: priceData.note.trim(),
  });
}

export function formatSharedPrice(data: SharedPriceData): string | null {
  const currencySymbol = data.currency === "BYN" ? BYN_SYMBOL : data.currency;
  if (data.mode === "FREE") return "Бесплатно";
  if (data.mode === "NONE" || data.mode === "UNKNOWN") return null;
  if (data.mode === "EXACT") return formatPrice(data.min, { hideZero: true, currencySymbol });
  if (data.mode === "FROM") return formatPriceFrom(data.min, { hideZero: true, currencySymbol });
  return formatPriceRange(data.min, data.max, { currencySymbol });
}
