import { z } from "zod";
import {
  placeDetails,
  classDetails,
  programDetails,
  campDetails,
  serviceDetails,
  packageDetails,
} from "./details-schemas";
import type { PricingModel } from "./pricing-schemas";

// Значения OfferProductType — новый enum в Prisma-схеме (добавлен в Fase 1).
// TS-тип определён здесь как источник правды; Prisma импортирует то же значение.
export type OfferProductType =
  | "PLACE_VISIT"
  | "ONE_TIME_ACTIVITY"
  | "REGULAR_ACTIVITY"
  | "CAMP"
  | "PARTY_SERVICE"
  | "PARTY_PACKAGE";

// TS-алиас читаемых имён (не Prisma-enum).
export type OfferType =
  | "PLACE"    // = PLACE_VISIT
  | "CLASS"    // = ONE_TIME_ACTIVITY
  | "PROGRAM"  // = REGULAR_ACTIVITY
  | "CAMP"     // = CAMP
  | "SERVICE"  // = PARTY_SERVICE
  | "PACKAGE"; // = PARTY_PACKAGE

export const OFFER_TYPE_TO_PRODUCT_TYPE: Record<OfferType, OfferProductType> = {
  PLACE:   "PLACE_VISIT",
  CLASS:   "ONE_TIME_ACTIVITY",
  PROGRAM: "REGULAR_ACTIVITY",
  CAMP:    "CAMP",
  SERVICE: "PARTY_SERVICE",
  PACKAGE: "PARTY_PACKAGE",
};

export const PRODUCT_TYPE_TO_OFFER_TYPE: Record<OfferProductType, OfferType> = {
  PLACE_VISIT:       "PLACE",
  ONE_TIME_ACTIVITY: "CLASS",
  REGULAR_ACTIVITY:  "PROGRAM",
  CAMP:              "CAMP",
  PARTY_SERVICE:     "SERVICE",
  PARTY_PACKAGE:     "PACKAGE",
};

export type WizardStepKey =
  | "type"
  | "placements"
  | "details"
  | "photo"
  | "conditions"
  | "campSchedule"
  | "accommodation"
  | "price"
  | "contacts"
  | "review";

export interface OfferTypeConfig {
  key: OfferType;
  productType: OfferProductType;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detailsSchema: z.ZodTypeAny;
  pricing: PricingModel;
  composite?: boolean;
  steps: WizardStepKey[];
}

const BASE_STEPS: WizardStepKey[] = [
  "type",
  "placements",
  "details",
  "photo",
  "conditions",
  "price",
  "contacts",
  "review",
];

const CAMP_STEPS: WizardStepKey[] = [
  "type",
  "placements",
  "details",
  "photo",
  "campSchedule",
  "accommodation",
  "price",
  "contacts",
  "review",
];

export const OFFER_TYPES: Record<OfferType, OfferTypeConfig> = {
  PLACE: {
    key: "PLACE",
    productType: "PLACE_VISIT",
    label: "Посещение места",
    detailsSchema: placeDetails,
    pricing: "TICKET",
    steps: BASE_STEPS,
  },
  CLASS: {
    key: "CLASS",
    productType: "ONE_TIME_ACTIVITY",
    label: "Занятие / мастер-класс",
    detailsSchema: classDetails,
    pricing: "PER_SESSION",
    steps: BASE_STEPS,
  },
  PROGRAM: {
    key: "PROGRAM",
    productType: "REGULAR_ACTIVITY",
    label: "Регулярная программа",
    detailsSchema: programDetails,
    pricing: "SUBSCRIPTION",
    steps: BASE_STEPS,
  },
  CAMP: {
    key: "CAMP",
    productType: "CAMP",
    label: "Лагерь / смена",
    detailsSchema: campDetails,
    pricing: "PER_SHIFT",
    steps: CAMP_STEPS,
  },
  SERVICE: {
    key: "SERVICE",
    productType: "PARTY_SERVICE",
    label: "Услуга для праздника",
    detailsSchema: serviceDetails,
    pricing: "FIXED_OR_FROM",
    steps: BASE_STEPS,
  },
  PACKAGE: {
    key: "PACKAGE",
    productType: "PARTY_PACKAGE",
    label: "Праздник под ключ",
    detailsSchema: packageDetails,
    pricing: "PACKAGE_TIERS",
    composite: true,
    steps: BASE_STEPS,
  },
} as const;

/** Получить конфиг по OfferProductType */
export function getOfferTypeConfig(productType: OfferProductType): OfferTypeConfig {
  const offerType = PRODUCT_TYPE_TO_OFFER_TYPE[productType];
  return OFFER_TYPES[offerType];
}
