import { z } from "zod";
import { PartyCategory } from "@prisma/client";
import { normalizePublicationPrice } from "@/domain/pricing/normalizedPrice";
import { serviceDetails, packageDetails } from "./offer-types/details-schemas";

export class PartyWizardInputError extends Error {}

export const wizardPriceModeSchema = z.enum(["EXACT", "FROM", "ON_REQUEST", "FREE", "RANGE", "NONE", "UNKNOWN"]);
export const packageComponentInputSchema = z.array(z.object({
  id: z.string().min(1).optional(), title: z.string().trim().min(1).max(200), category: z.enum(PartyCategory),
}).strict()).max(30).refine(rows => {
  const ids = rows.flatMap(r => r.id ? [r.id] : []);
  return ids.length === new Set(ids).size;
}, "Повторяющиеся позиции пакета");

export function validatePartyWizardInput(input: {
  productType?: string | null; details?: unknown; minChildren?: number | null; maxChildren?: number | null;
}) {
  if (input.productType !== "PARTY_SERVICE" && input.productType !== "PARTY_PACKAGE") return;
  const { minChildren: min, maxChildren: max } = input;
  if ((min != null && min < 0) || (max != null && max < 0) || (min != null && max != null && min > max))
    throw new PartyWizardInputError("Проверьте минимальное и максимальное число участников");
  if (input.details != null) {
    const result = (input.productType === "PARTY_PACKAGE" ? packageDetails : serviceDetails).safeParse(input.details);
    if (!result.success) throw new PartyWizardInputError("Проверьте длительность и условия услуги");
  }
}

/** Only explicit semantic modes override the legacy single/multiple conversion. */
export function explicitWizardPrice(mode: z.infer<typeof wizardPriceModeSchema> | undefined, amount?: number) {
  if (mode === undefined || mode === "RANGE") return null;
  if ((mode === "EXACT" || mode === "FROM") && amount === undefined)
    return normalizePublicationPrice({ mode: "UNKNOWN" }); // unfinished draft, never zero
  return normalizePublicationPrice({ mode, min: amount });
}
