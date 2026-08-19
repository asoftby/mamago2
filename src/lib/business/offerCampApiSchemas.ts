import { z } from "zod";

/** Тело смены лагеря (JSON в Offer.campSessions) */
export const campSessionEntrySchema = z
  .object({
    id: z.string().optional(),
    sortOrder: z.number().optional(),
    title: z.string().optional().nullable(),
    dateFrom: z.string().nullable().optional(),
    dateTo: z.string().nullable().optional(),
    timeFrom: z.string().nullable().optional(),
    timeTo: z.string().nullable().optional(),
    sessionKind: z.enum(["day", "full_day", "residential"]).optional(),
    ageFrom: z.number().nullable().optional(),
    ageTo: z.number().nullable().optional(),
    capacity: z.number().nullable().optional(),
    spotsLeft: z.number().nullable().optional(),
    priceOverride: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    promotionDetails: z.string().optional().nullable(),
  })
  .passthrough();

export const campProgramTypeSchema = z
  .enum(["городской", "выездной", "смешанный"])
  .optional();

export const campMealKeySchema = z.enum(["breakfast", "lunch", "dinner", "snacks"]);

/** Ключ шага мастера предложения (Offer.wizardCompletedSteps) */
export const offerWizardStepKeySchema = z.enum([
  "type",
  "placements",
  "details",
  "photo",
  "conditions",
  "campSchedule",
  "accommodation",
  "price",
  "contacts",
  "faq",
  "review",
]);
