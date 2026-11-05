import { z } from "zod";

const minutes = z.number().int().min(0).max(1440);
const count = z.number().int().min(0).max(1000);

/** An explicit fixed-price variant on an existing Offer.priceItems row. */
export const partyTariffConditions = z.object({
  durationMinutes: minutes.min(1),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  startMinutes: minutes.optional(),
  endMinutes: minutes.optional(),
  minAgeMonths: count.optional(),
  maxAgeMonths: count.optional(),
  minGuests: count.optional(),
  maxGuests: count.optional(),
  componentIds: z.array(z.string().min(1).max(100)).max(30).optional(),
}).strict().refine(rule =>
  (!rule.dateFrom || !rule.dateTo || rule.dateFrom <= rule.dateTo) &&
  (rule.startMinutes === undefined || rule.endMinutes === undefined || rule.startMinutes < rule.endMinutes) &&
  (rule.minAgeMonths ?? 0) <= (rule.maxAgeMonths ?? 1000) &&
  (rule.minGuests ?? 0) <= (rule.maxGuests ?? 1000) &&
  new Set(rule.componentIds).size === (rule.componentIds?.length ?? 0),
"Проверьте условия тарифа");

export type PartyTariffConditions = z.infer<typeof partyTariffConditions>;

export function hasPartyTariffConditions(items: unknown): boolean {
  return Array.isArray(items) && items.some(item =>
    item !== null && typeof item === "object" && Object.hasOwn(item, "partyConditions"));
}
