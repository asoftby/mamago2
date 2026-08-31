import { z } from "zod";
import {
  PUBLICATION_PRICE_MODES,
  normalizePublicationPrice,
  type PublicationPriceMode,
} from "./normalizedPrice";
import { PriceItemSchema, parsePriceData } from "@/lib/priceItems";
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

export function sharedPriceFromPublication(source: PublicationPriceSource): SharedPriceData {
  const priceData = parsePriceData(source.priceItems);
  const normalized = normalizePublicationPrice({
    mode: source.priceMode,
    min: source.priceFrom,
    max: source.priceTo,
    priceItems: source.priceItems,
    priceText: source.priceText,
  });

  return SharedPriceDataSchema.parse({
    mode: normalized.mode,
    currency: source.currency?.trim() || normalized.currency,
    min: normalized.min,
    max: normalized.max,
    items: priceData.items,
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
