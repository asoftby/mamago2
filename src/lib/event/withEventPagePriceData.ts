import type { EventPageData } from "@/lib/event/eventPageTypes";
import { parsePriceData } from "@/lib/priceItems";
import { isRichTextMeaningful } from "@/lib/richtext/utils";

/**
 * Adds the structured Event wizard price list to the public event view model.
 * Keeps raw Prisma JSON parsing at the server/view-model boundary so client UI
 * receives only validated JSON-safe price rows.
 */
export function withEventPagePriceData<T extends EventPageData>(
  data: T,
  rawPriceItems: unknown,
): T {
  const parsed = parsePriceData(rawPriceItems);
  const priceDetails =
    data.priceDetails && isRichTextMeaningful(data.priceDetails)
      ? data.priceDetails
      : undefined;

  return {
    ...data,
    priceDetails,
    priceItems: parsed.items,
    priceNote: parsed.note,
  };
}
