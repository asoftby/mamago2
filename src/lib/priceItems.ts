import { z } from "zod";

export const PriceItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  price: z.string(),
  unit: z.string(),
});

export type PriceItem = z.infer<typeof PriceItemSchema>;

export const PriceItemsSchema = z.array(PriceItemSchema);

export type PriceData = {
  items: PriceItem[];
  note: string;
};

export function emptyPriceData(): PriceData {
  return { items: [], note: "" };
}

export function parsePriceItems(raw: unknown): PriceItem[] {
  if (!Array.isArray(raw)) return [];
  const result = PriceItemsSchema.safeParse(raw);
  return result.success ? result.data : [];
}

/** Handles both legacy array format and new `{ items, note }` object format. */
export function parsePriceData(raw: unknown): PriceData {
  if (Array.isArray(raw)) {
    return { items: parsePriceItems(raw), note: "" };
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as { items?: unknown; note?: unknown };
    return {
      items: parsePriceItems(obj.items),
      note: typeof obj.note === "string" ? obj.note : "",
    };
  }
  return emptyPriceData();
}
