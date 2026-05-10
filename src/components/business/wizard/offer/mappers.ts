import type { OfferKind } from "@prisma/client";
import type { OfferFormData, CampLodgingTypeKey } from "./types";
import { getDefaultFormData } from "./defaults";
import type { PublicationAccess } from "@/features/publication-access";
import {
  normalizeCampSessionsFromDb,
  normalizeCampMealsFromDb,
  sortCampSessions,
} from "./campOfferModel";

const CAMP_LODGING_KEYS = new Set<CampLodgingTypeKey>([
  "hotel",
  "resort_base",
  "camping",
  "cottage",
  "sanatorium",
  "other",
]);

function parseCampLodgingTypeFromDb(
  value: string | null | undefined,
): CampLodgingTypeKey | "" {
  if (!value) return "";
  return CAMP_LODGING_KEYS.has(value as CampLodgingTypeKey)
    ? (value as CampLodgingTypeKey)
    : "";
}

function parseCampProgramTypeFromDb(
  v: string | null | undefined,
): OfferFormData["campProgramType"] {
  if (v === "городской" || v === "выездной" || v === "смешанный") return v;
  return null;
}

function inferOfferWizardTypeFromOffer(offer: {
  campProgramType?: string | null;
  campSessions?: unknown;
}): OfferFormData["offerWizardType"] {
  if (parseCampProgramTypeFromDb(offer.campProgramType)) return "CAMP";
  const sessions = normalizeCampSessionsFromDb(offer.campSessions);
  if (sessions.length > 0) return "CAMP";
  return null;
}

function formKindToApiKind(
  data: OfferFormData
): "VISIT" | "CLASS" | "PARTY" | "EVENT_TICKET" {
  if (data.offerWizardType === "CAMP") return "CLASS";
  if (data.durationType === "camp") return "CLASS";
  if (data.offerKind === "birthday") return "PARTY";
  if (data.offerKind === "course") {
    return data.durationType === "recurring" ? "CLASS" : "VISIT";
  }
  if (data.offerKind === "service") return "VISIT";
  return "VISIT";
}

function mapCtaToApi(
  cta: OfferFormData["ctaType"]
): "BOOK" | "RESERVE" | "BUY_TICKET" | "SEND_REQUEST" | "VISIT_WEBSITE" {
  const map: Record<
    NonNullable<OfferFormData["ctaType"]>,
    "BOOK" | "RESERVE" | "BUY_TICKET" | "SEND_REQUEST" | "VISIT_WEBSITE"
  > = {
    записаться: "BOOK",
    забронировать: "RESERVE",
    купить_билет: "BUY_TICKET",
    отправить_заявку: "SEND_REQUEST",
    перейти_на_сайт: "VISIT_WEBSITE",
  };
  if (cta && map[cta]) return map[cta];
  return "BOOK";
}

function parsePrice(value: string): number | undefined {
  const n = parseFloat(String(value).replace(",", ".").trim());
  return Number.isFinite(n) ? n : undefined;
}

function deriveOfferApiFieldsFromPublicationAccess(
  access: PublicationAccess | null,
  data: OfferFormData,
): {
  ctaType: "BOOK" | "RESERVE" | "BUY_TICKET" | "SEND_REQUEST" | "VISIT_WEBSITE";
  phone?: string;
  website?: string;
  bookingInstructions?: string;
} {
  if (!access) {
    return {
      ctaType: mapCtaToApi(data.ctaType),
      phone: (data.ctaPhone || data.phone).trim() || undefined,
      website: (data.ctaLink || data.website).trim() || undefined,
      bookingInstructions: data.ctaInstructions.trim() || undefined,
    };
  }

  switch (access.method) {
    case "details":
      return {
        ctaType: "VISIT_WEBSITE",
        website: access.externalUrl?.trim() || data.website.trim() || undefined,
        bookingInstructions: access.instructions?.trim() || undefined,
      };
    case "ticket":
      return {
        ctaType: "BUY_TICKET",
        website: access.ticketUrl?.trim() || undefined,
        bookingInstructions: access.instructions?.trim() || undefined,
      };
    case "timeslots":
      return {
        ctaType: "RESERVE",
        bookingInstructions: access.instructions?.trim() || undefined,
      };
    case "prebooking":
      return {
        ctaType: access.externalUrl?.trim() ? "SEND_REQUEST" : "BOOK",
        phone: access.phone?.trim() || undefined,
        website: access.externalUrl?.trim() || undefined,
        bookingInstructions: access.instructions?.trim() || undefined,
      };
    case "external":
      return {
        ctaType: "VISIT_WEBSITE",
        website: access.externalUrl?.trim() || undefined,
        bookingInstructions: access.instructions?.trim() || undefined,
      };
    case "contact":
      return {
        ctaType: "SEND_REQUEST",
        phone: access.phone?.trim() || undefined,
        bookingInstructions: access.instructions?.trim() || undefined,
      };
    default:
      return {
        ctaType: "BOOK",
      };
  }
}

function ageGroupsToMonths(ageGroups: string[]): {
  ageMinMonths?: number;
  ageMaxMonths?: number;
} {
  if (!ageGroups.length) return {};
  // Best-effort: labels like "0-3" are not parsed here; optional API fields stay unset.
  return {};
}

/**
 * Validate video URL (YouTube, YouTube Shorts, Instagram Reels)
 */
export function isValidVideoUrl(url: string): boolean {
  if (!url.trim()) return true; // Optional field
  
  const videoUrlPatterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/(www\.)?youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
    /^https?:\/\/(www\.)?instagram\.com\/reel\/[\w-]+/,
    /^https?:\/\/(www\.)?instagram\.com\/p\/[\w-]+/,
  ];
  
  return videoUrlPatterns.some((pattern) => pattern.test(url));
}

/** POST /api/business/offers — matches createOfferSchema */
export function buildOfferCreatePayload(
  data: OfferFormData,
  placeId: string,
  opts?: { status?: "DRAFT" | "PENDING" | "PUBLISHED" }
) {
  const pricingMode = data.pricingMode === "multiple" ? "MULTIPLE" : "SINGLE";
  const ages = ageGroupsToMonths(data.ageGroups);
  const accessFields = deriveOfferApiFieldsFromPublicationAccess(
    data.publicationAccess,
    data,
  );

  const base = {
    source: "PLACE" as const,
    selectedPlace: { id: placeId },
    kind: formKindToApiKind(data),
    title: data.title.trim() || "Новое предложение",
    shortDescription: data.shortDescription.trim() || "—",
    description: data.description?.trim() || "",
    ...ages,
    coverImage: data.coverImage ?? undefined,
    videoUrl: data.videoUrl?.trim() || undefined,
    promotionalOffer: data.promotionalOffer?.trim() || undefined,
    pricingMode,
    singlePrice: parsePrice(data.singlePrice),
    singlePriceLabel: data.singlePriceLabel.trim() || undefined,
    pricingOptions: data.pricingOptions.map((o) => ({
      title: o.title.trim(),
      price: parsePrice(o.price) ?? 0,
      oldPrice: o.oldPrice ? parsePrice(o.oldPrice) : undefined,
      description: o.description?.trim() || undefined,
    })),
    ctaType: accessFields.ctaType,
    phone: accessFields.phone,
    website: accessFields.website,
    bookingInstructions: accessFields.bookingInstructions,
    discoverySignalIds: data.signalIds,
    status: opts?.status ?? "DRAFT",
    gallery: data.gallery ?? [],
    campProgramType:
      data.offerWizardType === "CAMP" && data.campProgramType
        ? data.campProgramType
        : undefined,
    // Camp fields
    campSessions:
      data.offerWizardType === "CAMP"
        ? sortCampSessions(data.campSessions).map((s, i) => ({ ...s, sortOrder: i }))
        : undefined,
    campSessionDuration: data.campSessionDuration?.trim() || undefined,
    campStayDuration: data.campStayDuration?.trim() || undefined,
    campPlacesCount: data.campPlacesCount ?? undefined,
    campGroupSize: data.campGroupSize ?? undefined,
    campDaySchedule: data.campDaySchedule?.trim() || undefined,
    campCanSelectDays: data.campCanSelectDays,
    campHasExtendedCare: data.campHasExtendedCare,
    // Accommodation fields
    accommodationProvided: data.accommodationProvided,
    accommodationType: data.accommodationType || undefined,
    accommodationAddress: data.accommodationAddress.trim() || undefined,
    accommodationRooms: data.accommodationRooms.trim() || undefined,
    campIncludedMeals:
      data.campIncludedMeals.length > 0 ? data.campIncludedMeals : undefined,
    campSafetyInfo: data.campSafetyInfo.trim() || undefined,
    campMedicalInfo: data.campMedicalInfo.trim() || undefined,
    accommodationConditions: data.accommodationConditions?.trim() || undefined,
    mealInfo: data.mealInfo?.trim() || undefined,
    transferInfo: data.transferInfo?.trim() || undefined,
    whatToBring: data.whatToBring?.trim() || undefined,
  };

  return base;
}

/** PATCH /api/business/offers/[id] — matches updateOfferSchema */
export function buildOfferUpdatePayload(
  data: OfferFormData,
  opts?: { status?: "DRAFT" | "PENDING" | "PUBLISHED" }
) {
  const pricingMode = data.pricingMode === "multiple" ? "MULTIPLE" : "SINGLE";
  const ages = ageGroupsToMonths(data.ageGroups);
  const accessFields = deriveOfferApiFieldsFromPublicationAccess(
    data.publicationAccess,
    data,
  );

  const payload: Record<string, unknown> = {
    title: data.title.trim() || "Новое предложение",
    shortDescription: data.shortDescription.trim() || "—",
    description: data.description?.trim() || "",
    ...ages,
    coverImage: data.coverImage ?? undefined,
    videoUrl: data.videoUrl?.trim() || undefined,
    promotionalOffer: data.promotionalOffer?.trim() || undefined,
    pricingMode,
    singlePrice: parsePrice(data.singlePrice),
    singlePriceLabel: data.singlePriceLabel.trim() || undefined,
    pricingOptions: data.pricingOptions.map((o) => ({
      title: o.title.trim(),
      price: parsePrice(o.price) ?? 0,
      oldPrice: o.oldPrice ? parsePrice(o.oldPrice) : undefined,
      description: o.description?.trim() || undefined,
    })),
    ctaType: accessFields.ctaType,
    phone: accessFields.phone,
    website: accessFields.website,
    bookingInstructions: accessFields.bookingInstructions,
    discoverySignalIds: data.signalIds,
    gallery: data.gallery ?? [],
    campProgramType:
      data.offerWizardType === "CAMP" && data.campProgramType
        ? data.campProgramType
        : undefined,
    // Camp fields
    campSessions:
      data.offerWizardType === "CAMP"
        ? sortCampSessions(data.campSessions).map((s, i) => ({ ...s, sortOrder: i }))
        : undefined,
    campSessionDuration: data.campSessionDuration?.trim() || undefined,
    campStayDuration: data.campStayDuration?.trim() || undefined,
    campPlacesCount: data.campPlacesCount ?? undefined,
    campGroupSize: data.campGroupSize ?? undefined,
    campDaySchedule: data.campDaySchedule?.trim() || undefined,
    campCanSelectDays: data.campCanSelectDays,
    campHasExtendedCare: data.campHasExtendedCare,
    // Accommodation fields
    accommodationProvided: data.accommodationProvided,
    accommodationType: data.accommodationType || undefined,
    accommodationAddress: data.accommodationAddress.trim() || undefined,
    accommodationRooms: data.accommodationRooms.trim() || undefined,
    campIncludedMeals:
      data.campIncludedMeals.length > 0 ? data.campIncludedMeals : undefined,
    campSafetyInfo: data.campSafetyInfo.trim() || undefined,
    campMedicalInfo: data.campMedicalInfo.trim() || undefined,
    accommodationConditions: data.accommodationConditions?.trim() || undefined,
    mealInfo: data.mealInfo?.trim() || undefined,
    transferInfo: data.transferInfo?.trim() || undefined,
    whatToBring: data.whatToBring?.trim() || undefined,
  };

  if (opts?.status) {
    payload.status = opts.status;
  }

  return payload;
}

/** Map Prisma offer row to wizard form (fields stored in DB only). */
export function mapOfferToFormData(offer: {
  kind: OfferKind;
  title: string;
  description: string | null;
  coverImage: string | null;
  galleryImages?: unknown; // JsonValue from Prisma
  videoUrl?: string | null;
  promotionalOffer?: string | null;
  priceFrom: number | null;
  priceText: string | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  discoverySignalIds?: string[];
  // Camp fields
  campProgramType?: string | null;
  campSessions?: unknown;
  campSessionDuration?: string | null;
  campStayDuration?: string | null;
  campPlacesCount?: number | null;
  campGroupSize?: number | null;
  campDaySchedule?: string | null;
  campCanSelectDays?: boolean;
  campHasExtendedCare?: boolean;
  // Accommodation fields
  accommodationProvided?: boolean;
  accommodationType?: string | null;
  accommodationAddress?: string | null;
  accommodationRooms?: string | null;
  campIncludedMeals?: unknown;
  campSafetyInfo?: string | null;
  campMedicalInfo?: string | null;
  accommodationConditions?: string | null;
  mealInfo?: string | null;
  transferInfo?: string | null;
  whatToBring?: string | null;
}): OfferFormData {
  const defaults = getDefaultFormData();

  const campSessions = normalizeCampSessionsFromDb(offer.campSessions);

  // Parse gallery images from JSON
  let gallery: string[] = [];
  if (offer.galleryImages) {
    try {
      if (Array.isArray(offer.galleryImages)) {
        gallery = offer.galleryImages;
      } else if (typeof offer.galleryImages === "string") {
        gallery = JSON.parse(offer.galleryImages);
      }
    } catch {
      gallery = [];
    }
  }

  const inferredWizardType = inferOfferWizardTypeFromOffer(offer);
  const isCamp = inferredWizardType === "CAMP";

  return {
    ...defaults,
    offerWizardType: inferredWizardType,
    offerKind: isCamp ? "course" : offer.kind === "EVENT" ? "course" : "service",
    durationType: isCamp ? "camp" : offer.kind === "EVENT" ? "single" : null,
    campProgramType: parseCampProgramTypeFromDb(offer.campProgramType),
    title: offer.title,
    shortDescription: offer.description ?? "",
    description: offer.description ?? "",
    coverImage: offer.coverImage,
    gallery,
    videoUrl: offer.videoUrl ?? null,
    promotionalOffer: offer.promotionalOffer ?? "",
    pricingMode: "single",
    singlePrice: offer.priceFrom != null ? String(offer.priceFrom) : "",
    singleCurrency: "BYN",
    singlePriceLabel: offer.priceText ?? "",
    signalIds: offer.discoverySignalIds ?? [],
    // Camp fields
    campSessions,
    campSessionDuration: offer.campSessionDuration ?? "",
    campStayDuration: offer.campStayDuration ?? "",
    campPlacesCount: offer.campPlacesCount ?? null,
    campGroupSize: offer.campGroupSize ?? null,
    campDaySchedule: offer.campDaySchedule ?? "",
    campCanSelectDays: offer.campCanSelectDays ?? false,
    campHasExtendedCare: offer.campHasExtendedCare ?? false,
    // Accommodation fields
    accommodationProvided: offer.accommodationProvided ?? false,
    accommodationType: parseCampLodgingTypeFromDb(offer.accommodationType),
    accommodationAddress: offer.accommodationAddress ?? "",
    accommodationRooms: offer.accommodationRooms ?? "",
    accommodationConditions: offer.accommodationConditions ?? "",
    campIncludedMeals: normalizeCampMealsFromDb(offer.campIncludedMeals),
    mealInfo: offer.mealInfo ?? "",
    transferInfo: offer.transferInfo ?? "",
    whatToBring: offer.whatToBring ?? "",
    campSafetyInfo: offer.campSafetyInfo ?? "",
    campMedicalInfo: offer.campMedicalInfo ?? "",
  };
}
