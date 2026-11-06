import { z } from "zod";
import { partyTariffConditions } from "@/lib/offers/partyTariff";
import type { ServiceInterval } from "@/lib/birthday/constructorContract";

const variant = z.object({
  price: z.number().finite().nonnegative().max(99999999.99),
  partyConditions: partyTariffConditions,
});

export function selectPartyTariff(input: {
  items: unknown;
  interval: ServiceInterval;
  guests: number;
  age?: { min: number; max: number };
  componentIds?: readonly string[];
}): string | null {
  if (!Array.isArray(input.items)) return null;
  const start = Date.parse(input.interval.startAt), end = Date.parse(input.interval.endAt);
  const duration = (end - start) / 60_000;
  const minsk = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Minsk", dateStyle: "short", timeStyle: "short" });
  const [day, from] = minsk.format(start).split(" ");
  const [endDay, to] = minsk.format(end).split(" ");
  if (day !== endDay) return null;
  const asMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const weekday = new Date(day + "T00:00:00Z").getUTCDay() || 7;
  const selected = input.componentIds ? [...input.componentIds].sort() : undefined;
  let best: number | null = null;
  for (const raw of input.items) {
    const candidate = variant.safeParse(raw);
    if (!candidate.success) continue;
    const { price, partyConditions: rule } = candidate.data;
    if (Number(price.toFixed(2)) !== price || duration !== rule.durationMinutes) continue;
    if ((rule.dateFrom && day < rule.dateFrom) || (rule.dateTo && day > rule.dateTo) ||
        (rule.weekdays && !rule.weekdays.includes(weekday)) ||
        (rule.startMinutes !== undefined && asMinutes(from) < rule.startMinutes) ||
        (rule.endMinutes !== undefined && asMinutes(to) > rule.endMinutes)) continue;
    if (input.guests < (rule.minGuests ?? 0) || input.guests > (rule.maxGuests ?? Infinity)) continue;
    if ((rule.minAgeMonths !== undefined || rule.maxAgeMonths !== undefined) &&
        (!input.age || input.age.min < (rule.minAgeMonths ?? 0) || input.age.max > (rule.maxAgeMonths ?? Infinity))) continue;
    if (selected && !rule.componentIds) continue;
    if (rule.componentIds && (!selected || JSON.stringify([...rule.componentIds].sort()) !== JSON.stringify(selected))) continue;
    if (best === null || price < best) best = price;
  }
  return best?.toFixed(2) ?? null;
}
