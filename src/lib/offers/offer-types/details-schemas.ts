import { z } from "zod";

// PLACE_VISIT — посещение места (Offer.details)
// workingHours deferred — needs dedicated editor design
export const placeDetails = z.object({
  entryModel: z.enum(["free", "paid"]).nullable().optional(),
  amenities: z
    .array(z.enum(["parking", "cafe", "stroller", "changing_table"]))
    .default([]),
});

// ONE_TIME_ACTIVITY / REGULAR_ACTIVITY — занятие / мастер-класс
// classDuration/classGroupSize/classFormat are completely lost in current DB columns —
// they exist in the form but are NOT sent to the API. details will be their first home.
export const classDetails = z.object({
  duration: z.string().optional(),       // replaces classDuration (was never persisted)
  groupSize: z.string().optional(),      // replaces classGroupSize (was never persisted)
  format: z.enum(["trial", "course", "subscription"]).nullable().optional(), // was classFormat
});

// REGULAR_ACTIVITY — регулярная программа (same class fields, re-used)
export const programDetails = z.object({
  duration: z.string().optional(),
  groupSize: z.string().optional(),
  format: z.enum(["trial", "course", "subscription"]).nullable().optional(),
});

// CAMP — лагерь / смена
// campProgramType stays as a column; details holds display-only extras
// Meals use real enum values from DB (not spec's meals/transport/insurance)
export const campDetails = z.object({
  safetyInfo: z.string().optional(),
  medicalInfo: z.string().optional(),
});

// PARTY_SERVICE — услуга для праздника (Phase 3b-2)
// Descriptive tail in details JSON; filterable fields (category, partyLocationType, min/maxChildren, occasions) → Offer columns.
// Replaces orphan serviceDescription/serviceDuration/serviceDeliveryArea (never persisted before).
export const serviceDetails = z.object({
  program: z.string().optional(),
  included: z.string().optional(),
  note: z.string().optional(),
  durationMinutes: z.number().int().nonnegative().optional(),
});

// PARTY_PACKAGE — праздник под ключ
// location uses placeId (Place business unit), not a PLACE-type offer reference
export const packageDetails = z.object({
  program: z.string().optional(),
  included: z.string().optional(),
  childrenCount: z.string().optional(),
  duration: z.string().optional(),
  placeId: z.string().optional(),
});

export type PlaceDetails = z.infer<typeof placeDetails>;
export type ClassDetails = z.infer<typeof classDetails>;
export type ProgramDetails = z.infer<typeof programDetails>;
export type CampDetails = z.infer<typeof campDetails>;
export type ServiceDetails = z.infer<typeof serviceDetails>;
export type PackageDetails = z.infer<typeof packageDetails>;
