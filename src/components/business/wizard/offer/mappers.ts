import type { OfferKind, PartyCategory, PartyOccasion } from "@prisma/client";
import type {
  OfferFormData,
  CampLodgingTypeKey,
  OfferPlacementKey,
  OfferPlacementStatus,
  OfferProductType,
  BirthdayLocationType,
  PlaceAmenityKey,
  PlaceEntryModel,
} from "./types";
import { getDefaultFormData } from "./defaults";
import {
  placeDetails as placeDetailsSchema,
  classDetails as classDetailsSchema,
  serviceDetails as serviceDetailsSchema,
} from "@/lib/offers/offer-types/details-schemas";
import type { PublicationAccess } from "@/features/publication-access";
import {
  createExcerpt,
  normalizeRichTextEditorValue,
  plainTextToRichTextHtml,
} from "@/lib/richtext/utils";
import {
  normalizeCampSessionsFromDb,
  normalizeCampMealsFromDb,
  sortCampSessions,
} from "./campOfferModel";

const PLACE_AMENITY_KEYS = new Set<PlaceAmenityKey>([
  "parking",
  "cafe",
  "stroller",
  "changing_table",
]);

function parsePlaceVisitDetailsFromDb(
  details: unknown,
): OfferFormData["placeVisitDetails"] {
  const parsed = placeDetailsSchema.safeParse(details);
  if (!parsed.success) {
    return { entryModel: null, amenities: [] };
  }
  return {
    entryModel: (parsed.data.entryModel ?? null) as PlaceEntryModel | null,
    amenities: (parsed.data.amenities ?? []).filter((a): a is PlaceAmenityKey =>
      PLACE_AMENITY_KEYS.has(a as PlaceAmenityKey),
    ),
  };
}

function parseServiceDetailsFromDb(details: unknown): {
  program: string;
  included: string;
  note: string;
  durationMinutes: number | null;
} {
  const parsed = serviceDetailsSchema.safeParse(details);
  if (!parsed.success) return { program: "", included: "", note: "", durationMinutes: null };
  const d = parsed.data;
  return {
    program: d.program ?? "",
    included: d.included ?? "",
    note: d.note ?? "",
    durationMinutes: d.durationMinutes ?? null,
  };
}

function parseActivityDetailsFromDb(details: unknown): {
  classDuration: string;
  classGroupSize: string;
  classFormat: OfferFormData["classFormat"];
} {
  const parsed = classDetailsSchema.safeParse(details);
  if (!parsed.success) return { classDuration: "", classGroupSize: "", classFormat: null };
  const { duration, groupSize, format } = parsed.data;
  return {
    classDuration: duration ?? "",
    classGroupSize: groupSize ?? "",
    classFormat: (format ?? null) as OfferFormData["classFormat"],
  };
}

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
  productType?: OfferProductType | null;
  campProgramType?: string | null;
  campSessions?: unknown;
}): OfferFormData["offerWizardType"] {
  if (offer.productType === "CAMP") return "CAMP";
  if (offer.productType === "REGULAR_ACTIVITY") return "REGULAR";
  if (
    offer.productType === "PLACE_VISIT" ||
    offer.productType === "ONE_TIME_ACTIVITY" ||
    offer.productType === "PARTY_SERVICE" ||
    offer.productType === "PARTY_PACKAGE"
  ) {
    return "SINGLE";
  }
  if (parseCampProgramTypeFromDb(offer.campProgramType)) return "CAMP";
  const sessions = normalizeCampSessionsFromDb(offer.campSessions);
  if (sessions.length > 0) return "CAMP";
  return null;
}

function inferProductTypeFromOffer(offer: {
  productType?: OfferProductType | null;
  campProgramType?: string | null;
  kind: OfferKind;
}): OfferProductType {
  if (offer.productType) return offer.productType;
  if (parseCampProgramTypeFromDb(offer.campProgramType)) return "CAMP";
  if (offer.kind === "EVENT") return "ONE_TIME_ACTIVITY";
  return "PLACE_VISIT";
}

function inferProductTypeFromForm(data: OfferFormData): OfferProductType | undefined {
  if (data.productType) return data.productType;
  if (data.offerWizardType === "CAMP") return "CAMP";
  if (data.offerWizardType === "REGULAR") return "REGULAR_ACTIVITY";
  return undefined;
}

function inferRequestedPlacementsFromForm(
  data: OfferFormData,
  productType: OfferProductType | undefined,
): OfferPlacementKey[] | undefined {
  if (data.productType) return data.requestedPlacements;
  if (data.requestedPlacements.length > 0) return data.requestedPlacements;
  if (!productType) return undefined;

  switch (productType) {
    case "CAMP":
      return ["CAMPS"];
    case "REGULAR_ACTIVITY":
      return ["CLASSES"];
    case "ONE_TIME_ACTIVITY":
      return ["WHERE_TO_GO"];
    default:
      return undefined;
  }
}

function defaultRequestedPlacementsForProductType(
  productType: OfferProductType | undefined,
): OfferPlacementKey[] {
  switch (productType) {
    case "CAMP":
      return ["CAMPS"];
    case "REGULAR_ACTIVITY":
      return ["CLASSES"];
    case "ONE_TIME_ACTIVITY":
    case "PLACE_VISIT":
      return ["WHERE_TO_GO"];
    case "PARTY_SERVICE":
    case "PARTY_PACKAGE":
      return ["BIRTHDAY"];
    default:
      return [];
  }
}

function parsePlacementKeyArray(
  placements: unknown,
): OfferPlacementKey[] {
  if (!Array.isArray(placements)) return [];

  return placements
    .map((placement) =>
      placement &&
      typeof placement === "object" &&
      "key" in placement &&
      typeof placement.key === "string"
        ? placement.key
        : null,
    )
    .filter(
      (key): key is OfferPlacementKey =>
        key === "WHERE_TO_GO" ||
        key === "CLASSES" ||
        key === "CAMPS" ||
        key === "BIRTHDAY",
    );
}

function parsePlacementStatusMap(
  placements: unknown,
): OfferFormData["placementStatuses"] {
  if (!Array.isArray(placements)) return {};

  return placements.reduce<OfferFormData["placementStatuses"]>((acc, placement) => {
    if (
      placement &&
      typeof placement === "object" &&
      "key" in placement &&
      "status" in placement &&
      typeof placement.key === "string" &&
      typeof placement.status === "string"
    ) {
      const key = placement.key;
      const status = placement.status;
      if (
        (key === "WHERE_TO_GO" ||
          key === "CLASSES" ||
          key === "CAMPS" ||
          key === "BIRTHDAY") &&
        (status === "REQUESTED" ||
          status === "APPROVED" ||
          status === "REJECTED")
      ) {
        acc[key as OfferPlacementKey] = status as OfferPlacementStatus;
      }
    }
    return acc;
  }, {});
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

function richTextToLegacyPriceText(html: string): string | undefined {
  const excerpt = createExcerpt(html, 80);
  return excerpt || undefined;
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
  opts?: {
    status?: "DRAFT" | "PENDING" | "PUBLISHED";
    wizardCompletedSteps?: string[];
    /** Идемпотентность create: повтор запроса с тем же id не создаёт дубль */
    createRequestId?: string;
  }
) {
  if (!data.placeId) {
    throw new Error("placeId is required to create offer payload");
  }
  const pricingMode = data.pricingMode === "multiple" ? "MULTIPLE" : "SINGLE";
  const ages = ageGroupsToMonths(data.ageGroups);
  const accessFields = deriveOfferApiFieldsFromPublicationAccess(
    data.publicationAccess,
    data,
  );
  const productType = inferProductTypeFromForm(data);
  const requestedPlacements = inferRequestedPlacementsFromForm(data, productType);

  const base = {
    source: "PLACE" as const,
    createRequestId: opts?.createRequestId,
    selectedPlace: { id: data.placeId },
    kind: formKindToApiKind(data),
    title: data.title.trim() || "Новое предложение",
    shortDescription: data.shortDescription.trim() || "—",
    description: data.description?.trim() || "",
    ...ages,
    coverImage: data.coverImage ?? undefined,
    videoUrl: data.videoUrl?.trim() || undefined,
    priceCaption:
      data.offerWizardType === "CAMP"
        ? undefined
        : data.priceCaption?.trim() || undefined,
    promotionDetails:
      data.offerWizardType === "CAMP"
        ? undefined
        : data.promotionDetails?.trim() || undefined,
    promotionalOffer:
      data.offerWizardType === "CAMP"
        ? undefined
        : createExcerpt(data.promotionDetails, 120) || undefined,
    pricingMode,
    singlePrice:
      data.offerWizardType === "CAMP" ? undefined : parsePrice(data.singlePrice),
    singlePriceLabel:
      data.offerWizardType === "CAMP"
        ? undefined
        : richTextToLegacyPriceText(data.priceCaption),
    pricingOptions:
      data.offerWizardType === "CAMP"
        ? []
        : data.pricingOptions.map((o) => ({
            title: o.title.trim(),
            price: parsePrice(o.price) ?? 0,
            oldPrice: o.oldPrice ? parsePrice(o.oldPrice) : undefined,
            description: o.description?.trim() || undefined,
          })),
    ctaType: accessFields.ctaType,
    phone: accessFields.phone,
    website: accessFields.website,
    bookingInstructions: accessFields.bookingInstructions,
    contactSource: data.contactSource,
    contactPhone: data.phone.trim() || undefined,
    contactPhoneLabel: data.phoneLabel?.trim() || null,
    contactPhone2: data.phone2?.trim() || null,
    contactPhone2Label: data.phone2Label?.trim() || null,
    contactPhone3: data.phone3?.trim() || null,
    contactPhone3Label: data.phone3Label?.trim() || null,
    contactWebsite: data.website.trim() || undefined,
    contactSocialLinks: data.socialLinks
      .filter((link) => link.url.trim().length > 0)
      .map((link) => ({
        id: link.id,
        network: link.network,
        url: link.url.trim(),
      })),
    discoverySignalIds: data.signalIds,
    classChipSlugs: data.classChipSlugs,
    wizardCompletedSteps: opts?.wizardCompletedSteps,
    status: opts?.status ?? "DRAFT",
    gallery: data.gallery ?? [],
    productType,
    requestedPlacements,
    details: buildTypeDetails(data),
    // PARTY_SERVICE/PARTY_PACKAGE: filterable party fields → Offer columns (single-write)
    ...(buildPartyFilterColumns(data) ?? {}),
    // Camp/accommodation-поля — только для лагерей; данные скрытых шагов
    // других типов в payload не попадают
    ...(data.offerWizardType === "CAMP" ? buildCampFieldsForCreate(data) : {}),
  };

  return base;
}

function buildTypeDetails(data: OfferFormData): Record<string, unknown> | undefined {
  if (data.productType === "PLACE_VISIT") {
    const { entryModel, amenities } = data.placeVisitDetails;
    const result: Record<string, unknown> = {};
    if (entryModel != null) result.entryModel = entryModel;
    if (amenities.length > 0) result.amenities = amenities;
    return Object.keys(result).length > 0 ? result : undefined;
  }
  if (
    data.productType === "ONE_TIME_ACTIVITY" ||
    data.productType === "REGULAR_ACTIVITY"
  ) {
    const result: Record<string, unknown> = {};
    if (data.classDuration) result.duration = data.classDuration;
    if (data.classGroupSize) result.groupSize = data.classGroupSize;
    if (data.classFormat != null) result.format = data.classFormat;
    return Object.keys(result).length > 0 ? result : undefined;
  }
  if (data.productType === "PARTY_SERVICE" || data.productType === "PARTY_PACKAGE") {
    const bd = data.birthdayDetails;
    const result: Record<string, unknown> = {};
    if (bd.durationMinutes != null) result.durationMinutes = bd.durationMinutes;
    if (bd.program.trim()) result.program = bd.program.trim();
    if (bd.included.trim()) result.included = bd.included.trim();
    if (bd.note.trim()) result.note = bd.note.trim();
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return undefined;
}

/** Filterable party columns → Offer (single-write). PACKAGE has no single category (composition deferred to Phase 4). */
function buildPartyFilterColumns(data: OfferFormData): Record<string, unknown> | undefined {
  if (data.productType === "PARTY_SERVICE") {
    return {
      category: data.partyCategory ?? undefined,
      partyLocationType: data.birthdayDetails.locationType ?? undefined,
      minChildren: data.birthdayDetails.minChildren ?? undefined,
      maxChildren: data.birthdayDetails.maxChildren ?? undefined,
      occasions: data.occasions,
    };
  }
  if (data.productType === "PARTY_PACKAGE") {
    return {
      category: null,
      partyLocationType: data.birthdayDetails.locationType ?? undefined,
      minChildren: data.birthdayDetails.minChildren ?? undefined,
      maxChildren: data.birthdayDetails.maxChildren ?? undefined,
      occasions: data.occasions,
    };
  }
  return undefined;
}

function buildCampFieldsForCreate(data: OfferFormData) {
  return {
    campProgramType: data.campProgramType || undefined,
    campSessions: sortCampSessions(data.campSessions).map((s, i) => ({
      ...s,
      sortOrder: i,
    })),
    campSessionDuration: data.campSessionDuration?.trim() || undefined,
    campStayDuration: data.campStayDuration?.trim() || undefined,
    campPlacesCount: data.campPlacesCount ?? undefined,
    campGroupSize: data.campGroupSize ?? undefined,
    campDaySchedule: data.campDaySchedule?.trim() || undefined,
    campCanSelectDays: data.campCanSelectDays,
    campHasExtendedCare: data.campHasExtendedCare,
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
}

/** Тип сменился с CAMP: явные null затирают зависшие camp-данные в БД */
const CAMP_FIELDS_WIPE = {
  campProgramType: null,
  campSessions: null,
  campSessionDuration: null,
  campStayDuration: null,
  campPlacesCount: null,
  campGroupSize: null,
  campDaySchedule: null,
  campCanSelectDays: false,
  campHasExtendedCare: false,
  accommodationProvided: false,
  accommodationType: null,
  accommodationAddress: null,
  accommodationRooms: null,
  campIncludedMeals: null,
  campSafetyInfo: null,
  campMedicalInfo: null,
  accommodationConditions: null,
  mealInfo: null,
  transferInfo: null,
  whatToBring: null,
} as const;

/** PATCH /api/business/offers/[id] — matches updateOfferSchema */
export function buildOfferUpdatePayload(
  data: OfferFormData,
  opts?: {
    status?: "DRAFT" | "PENDING" | "PUBLISHED";
    wizardCompletedSteps?: string[];
  }
) {
  const pricingMode = data.pricingMode === "multiple" ? "MULTIPLE" : "SINGLE";
  const ages = ageGroupsToMonths(data.ageGroups);
  const accessFields = deriveOfferApiFieldsFromPublicationAccess(
    data.publicationAccess,
    data,
  );
  const productType = inferProductTypeFromForm(data);
  const requestedPlacements = inferRequestedPlacementsFromForm(data, productType);

  const payload: Record<string, unknown> = {
    selectedPlace: data.placeId ? { id: data.placeId } : undefined,
    title: data.title.trim() || "Новое предложение",
    shortDescription: data.shortDescription.trim() || "—",
    description: data.description?.trim() || "",
    ...ages,
    coverImage: data.coverImage ?? undefined,
    videoUrl: data.videoUrl?.trim() || undefined,
    priceCaption:
      data.offerWizardType === "CAMP"
        ? undefined
        : data.priceCaption?.trim() || undefined,
    promotionDetails:
      data.offerWizardType === "CAMP"
        ? undefined
        : data.promotionDetails?.trim() || undefined,
    promotionalOffer:
      data.offerWizardType === "CAMP"
        ? undefined
        : createExcerpt(data.promotionDetails, 120) || undefined,
    pricingMode,
    singlePrice:
      data.offerWizardType === "CAMP" ? undefined : parsePrice(data.singlePrice),
    singlePriceLabel:
      data.offerWizardType === "CAMP"
        ? undefined
        : richTextToLegacyPriceText(data.priceCaption),
    pricingOptions:
      data.offerWizardType === "CAMP"
        ? []
        : data.pricingOptions.map((o) => ({
            title: o.title.trim(),
            price: parsePrice(o.price) ?? 0,
            oldPrice: o.oldPrice ? parsePrice(o.oldPrice) : undefined,
            description: o.description?.trim() || undefined,
          })),
    ctaType: accessFields.ctaType,
    phone: accessFields.phone,
    website: accessFields.website,
    bookingInstructions: accessFields.bookingInstructions,
    contactSource: data.contactSource,
    contactPhone: data.phone.trim() || undefined,
    contactPhoneLabel: data.phoneLabel?.trim() || null,
    contactPhone2: data.phone2?.trim() || null,
    contactPhone2Label: data.phone2Label?.trim() || null,
    contactPhone3: data.phone3?.trim() || null,
    contactPhone3Label: data.phone3Label?.trim() || null,
    contactWebsite: data.website.trim() || undefined,
    contactSocialLinks: data.socialLinks
      .filter((link) => link.url.trim().length > 0)
      .map((link) => ({
        id: link.id,
        network: link.network,
        url: link.url.trim(),
      })),
    discoverySignalIds: data.signalIds,
    classChipSlugs: data.classChipSlugs,
    gallery: data.gallery ?? [],
    productType,
    requestedPlacements,
    details: buildTypeDetails(data),
    // PARTY_SERVICE/PARTY_PACKAGE: filterable party fields → Offer columns (single-write)
    ...(buildPartyFilterColumns(data) ?? {}),
    // CAMP — camp/accommodation-данные; иначе явные null (затирание в БД)
    ...(data.offerWizardType === "CAMP"
      ? buildCampFieldsForCreate(data)
      : CAMP_FIELDS_WIPE),
  };

  if (opts?.status) {
    payload.status = opts.status;
  }

  if (opts?.wizardCompletedSteps) {
    payload.wizardCompletedSteps = opts.wizardCompletedSteps;
  }

  return payload;
}

/** Map Prisma offer row to wizard form (fields stored in DB only). */
export function mapOfferToFormData(offer: {
  placeId?: string | null;
  place?: { title?: string | null } | null;
  kind: OfferKind;
  productType?: OfferProductType | null;
  placements?: Array<{ key: OfferPlacementKey; status?: OfferPlacementStatus | null }> | null;
  title: string;
  description: string | null;
  coverImage: string | null;
  galleryImages?: unknown; // JsonValue from Prisma
  videoUrl?: string | null;
  priceCaption?: string | null;
  promotionDetails?: string | null;
  promotionalOffer?: string | null;
  priceFrom: number | null;
  priceText: string | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  discoverySignalIds?: string[];
  classChipSlugs?: string[];
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
  contactSource?: string | null;
  contactPhone?: string | null;
  contactPhoneLabel?: string | null;
  contactPhone2?: string | null;
  contactPhone2Label?: string | null;
  contactPhone3?: string | null;
  contactPhone3Label?: string | null;
  contactWebsite?: string | null;
  contactSocialLinks?: unknown;
  details?: unknown;
  // Phase 3b-1 party-filter columns (PARTY_SERVICE canon)
  category?: PartyCategory | null;
  partyLocationType?: BirthdayLocationType | null;
  minChildren?: number | null;
  maxChildren?: number | null;
  occasions?: PartyOccasion[];
}): OfferFormData {
  const defaults = getDefaultFormData(offer.placeId ?? null);

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
  const productType = inferProductTypeFromOffer(offer);
  const isPartyService = productType === "PARTY_SERVICE";
  const isPartyPackage = productType === "PARTY_PACKAGE";
  // PARTY_PACKAGE shares the same Offer columns + details shape as PARTY_SERVICE (category stays null for PACKAGE).
  const usesPartyColumns = isPartyService || isPartyPackage;
  const serviceDetails = usesPartyColumns ? parseServiceDetailsFromDb(offer.details) : null;
  const requestedPlacements = parsePlacementKeyArray(offer.placements);
  const placementStatuses = parsePlacementStatusMap(offer.placements);
  const socialLinks = Array.isArray(offer.contactSocialLinks)
    ? offer.contactSocialLinks
        .filter(
          (item): item is { id?: string; network?: string; url?: string } =>
            typeof item === "object" && item !== null,
        )
        .map((item, index) => {
          const network: OfferFormData["socialLinks"][number]["network"] =
            item.network === "instagram" ||
            item.network === "telegram" ||
            item.network === "tiktok" ||
            item.network === "youtube" ||
            item.network === "other"
              ? item.network
              : "instagram";
          return {
            id: typeof item.id === "string" && item.id.trim() ? item.id : `offer-social-${index}`,
            network,
            url: typeof item.url === "string" ? item.url : "",
          };
        })
        .filter((item) => item.url.trim().length > 0)
    : [];

  return {
    ...defaults,
    offerWizardType: inferredWizardType,
    productType,
    requestedPlacements:
      requestedPlacements.length > 0
        ? requestedPlacements
        : defaultRequestedPlacementsForProductType(productType),
    placementStatuses,
    // birthdayDetails: legacy OfferBirthdayDetails table removed in Phase 4a (was always empty).
    // PARTY_SERVICE/PARTY_PACKAGE canon lives on Offer columns/details JSON; the generic
    // BIRTHDAY-checkbox sub-form (non-party types) has no persistence — defaults only.
    birthdayDetails: {
      role: null,
      locationType: usesPartyColumns ? (offer.partyLocationType ?? null) : null,
      durationMinutes: usesPartyColumns ? (serviceDetails?.durationMinutes ?? null) : null,
      minChildren: usesPartyColumns ? (offer.minChildren ?? null) : null,
      maxChildren: usesPartyColumns ? (offer.maxChildren ?? null) : null,
      priceFrom: "",
      included: usesPartyColumns ? (serviceDetails?.included ?? "") : "",
      program: usesPartyColumns ? (serviceDetails?.program ?? "") : "",
      note: usesPartyColumns ? (serviceDetails?.note ?? "") : "",
    },
    // PARTY_SERVICE only: partyCategory from canon Offer.category. PARTY_PACKAGE has no single category.
    partyCategory: isPartyService ? (offer.category ?? null) : null,
    occasions: usesPartyColumns ? (offer.occasions ?? []) : [],
    offerKind:
      productType === "PARTY_PACKAGE"
        ? "birthday"
        : isCamp || offer.kind === "EVENT"
          ? "course"
          : "service",
    durationType:
      productType === "REGULAR_ACTIVITY"
        ? "recurring"
        : isCamp
          ? "camp"
          : offer.kind === "EVENT"
            ? "single"
            : null,
    campProgramType: parseCampProgramTypeFromDb(offer.campProgramType),
    placeId: offer.placeId ?? null,
    placeTitle: offer.place?.title ?? "",
    title: offer.title,
    shortDescription: offer.description ?? "",
    description: normalizeRichTextEditorValue(offer.description),
    coverImage: offer.coverImage,
    gallery,
    videoUrl: offer.videoUrl ?? null,
    priceCaption: isCamp
      ? ""
      : offer.priceCaption
        ? offer.priceCaption
        : offer.priceText
          ? plainTextToRichTextHtml(offer.priceText)
          : "",
    promotionDetails: isCamp
      ? ""
      : offer.promotionDetails
        ? offer.promotionDetails
        : offer.promotionalOffer
          ? plainTextToRichTextHtml(offer.promotionalOffer)
          : "",
    pricingMode: "single",
    singlePrice: offer.priceFrom != null ? String(offer.priceFrom) : "",
    singleCurrency: "BYN",
    contactSource: offer.contactSource === "place" ? "place" : "manual",
    phone: offer.contactPhone ?? "",
    phoneLabel: offer.contactPhoneLabel ?? null,
    phone2: offer.contactPhone2 ?? null,
    phone2Label: offer.contactPhone2Label ?? null,
    phone3: offer.contactPhone3 ?? null,
    phone3Label: offer.contactPhone3Label ?? null,
    website: offer.contactWebsite ?? "",
    socialLinks,
    signalIds: offer.discoverySignalIds ?? [],
    classChipSlugs: offer.classChipSlugs ?? [],
    placeVisitDetails: parsePlaceVisitDetailsFromDb(offer.details),
    ...(productType === "ONE_TIME_ACTIVITY" || productType === "REGULAR_ACTIVITY"
      ? parseActivityDetailsFromDb(offer.details)
      : {}),
    // Camp fields
    campSessions: campSessions.map((session) => ({
      ...session,
      description: normalizeRichTextEditorValue(session.description),
      promotionDetails: normalizeRichTextEditorValue(session.promotionDetails),
    })),
    campSessionDuration: offer.campSessionDuration ?? "",
    campStayDuration: offer.campStayDuration ?? "",
    campPlacesCount: offer.campPlacesCount ?? null,
    campGroupSize: offer.campGroupSize ?? null,
    campDaySchedule: normalizeRichTextEditorValue(offer.campDaySchedule),
    campCanSelectDays: offer.campCanSelectDays ?? false,
    campHasExtendedCare: offer.campHasExtendedCare ?? false,
    // Accommodation fields
    accommodationProvided: offer.accommodationProvided ?? false,
    accommodationType: parseCampLodgingTypeFromDb(offer.accommodationType),
    accommodationAddress: offer.accommodationAddress ?? "",
    accommodationRooms: normalizeRichTextEditorValue(offer.accommodationRooms),
    accommodationConditions: normalizeRichTextEditorValue(offer.accommodationConditions),
    campIncludedMeals: normalizeCampMealsFromDb(offer.campIncludedMeals),
    mealInfo: offer.mealInfo ?? "",
    transferInfo: offer.transferInfo ?? "",
    whatToBring: normalizeRichTextEditorValue(offer.whatToBring),
    campSafetyInfo: normalizeRichTextEditorValue(offer.campSafetyInfo),
    campMedicalInfo: normalizeRichTextEditorValue(offer.campMedicalInfo),
  };
}
