import { z } from "zod";

// TICKET — за посещение (ребёнок / взрослый / группа)
export const ticketPricing = z.object({
  model: z.literal("TICKET"),
  pricePerChild: z.number().nonnegative().optional(),
  pricePerAdult: z.number().nonnegative().optional(),
  free: z.boolean().default(false),
  currency: z.enum(["BYN", "USD", "EUR"]).default("BYN"),
  note: z.string().optional(),
});

// PER_SESSION — за занятие/мастер-класс (разовое)
export const perSessionPricing = z.object({
  model: z.literal("PER_SESSION"),
  price: z.number().nonnegative(),
  currency: z.enum(["BYN", "USD", "EUR"]).default("BYN"),
  note: z.string().optional(),
});

// SUBSCRIPTION — регулярная программа (абонемент / курс)
export const subscriptionPricing = z.object({
  model: z.literal("SUBSCRIPTION"),
  pricePerMonth: z.number().nonnegative().optional(),
  pricePerCourse: z.number().nonnegative().optional(),
  trialPrice: z.number().nonnegative().optional(),
  currency: z.enum(["BYN", "USD", "EUR"]).default("BYN"),
  note: z.string().optional(),
});

// PER_SHIFT — лагерь/смена (цена за смену хранится в OfferSession.price)
export const perShiftPricing = z.object({
  model: z.literal("PER_SHIFT"),
  currency: z.enum(["BYN", "USD", "EUR"]).default("BYN"),
  note: z.string().optional(),
});

// FIXED_OR_FROM — услуга для праздника (фикс или «от»)
export const fixedOrFromPricing = z.object({
  model: z.literal("FIXED_OR_FROM"),
  priceFixed: z.number().nonnegative().optional(),
  priceFrom: z.number().nonnegative().optional(),
  pricePerHour: z.number().nonnegative().optional(),
  currency: z.enum(["BYN", "USD", "EUR"]).default("BYN"),
  note: z.string().optional(),
});

// PACKAGE_TIERS — праздник под ключ (база + тиры по числу гостей)
export const packageTiersPricing = z.object({
  model: z.literal("PACKAGE_TIERS"),
  basePrice: z.number().nonnegative(),
  tiers: z
    .array(
      z.object({
        guestsUpTo: z.number().int().positive(),
        price: z.number().nonnegative(),
      }),
    )
    .default([]),
  currency: z.enum(["BYN", "USD", "EUR"]).default("BYN"),
  note: z.string().optional(),
});

export const pricingSchema = z.discriminatedUnion("model", [
  ticketPricing,
  perSessionPricing,
  subscriptionPricing,
  perShiftPricing,
  fixedOrFromPricing,
  packageTiersPricing,
]);

export type PricingModel =
  | "TICKET"
  | "PER_SESSION"
  | "SUBSCRIPTION"
  | "PER_SHIFT"
  | "FIXED_OR_FROM"
  | "PACKAGE_TIERS";

export type TicketPricing = z.infer<typeof ticketPricing>;
export type PerSessionPricing = z.infer<typeof perSessionPricing>;
export type SubscriptionPricing = z.infer<typeof subscriptionPricing>;
export type PerShiftPricing = z.infer<typeof perShiftPricing>;
export type FixedOrFromPricing = z.infer<typeof fixedOrFromPricing>;
export type PackageTiersPricing = z.infer<typeof packageTiersPricing>;
export type Pricing = z.infer<typeof pricingSchema>;
