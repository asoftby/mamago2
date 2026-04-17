// Event Wizard Data Mappers

import type { EventFormData } from "./types";
import { getDefaultFormData } from "./defaults";
import {
  mapEventFormatsToSignals,
  resolveEventFormatsFromScheduleJson,
} from "@/lib/business/eventFormatSignals";
import { isCinemaEventCategorySlug } from "@/lib/business/eventCategoryCinema";
import { normalizeParticipationMode } from "./participationCtaLabels";
import { normalizePricingMode } from "./pricingMode";
import { normalizePhoneToE164 } from "@/lib/phone/e164";
import { createDefaultSocialLink } from "./defaults";
import { computeEventShortDesc } from "@/lib/business/eventShortDesc";

type ActivityWithRelations = {
  id: string;
  title: string | null;
  description: string | null;
  ageTags: string[];
  scheduleJson: Record<string, unknown>;
  coverImageId: string | null;
  placeId: string | null;
  eventCategoryId: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  priceText: string | null;
  eventCategory?: { id: string; parentId: string | null; slug: string; nameRu: string } | null;
  images?: Array<{ url?: string; imageId?: string }>;
  venue?: {
    kind: "MANUAL" | "PLACE" | "MOBILE" | "TBD" | null;
    placeId?: string | null;
    title?: string | null;
    addressLine?: string | null;
    cityId?: string | null;
    note?: string | null;
    districtAutoId?: string | null;
    districtManualId?: string | null;
    metroAutoId?: string | null;
    metroAutoDistanceM?: number | null;
    metroManualId?: string | null;
    metroManualDistanceM?: number | null;
    district?: string | null;
    metro?: string | null;
  } | null;
  owner?: { name?: string | null } | null;
  programCategoryLinks?: Array<{ categoryId: string }>;
};

/**
 * Map Activity entity to EventFormData
 * Used when loading event for editing
 */
export function mapEventToFormData(event: ActivityWithRelations): EventFormData {
  const formData = getDefaultFormData();

  // Step 1: Basics
  formData.title = event.title || "";
  formData.ageTags = Array.isArray(event.ageTags) ? event.ageTags : [];

  const scheduleJson = (event.scheduleJson || {}) as Record<string, unknown>;

  formData.eventFormats = resolveEventFormatsFromScheduleJson(scheduleJson);
  // Optional multi-select «Интересы» (за пределами eventFormats).
  const signalsRaw = scheduleJson.signals as
    | { interests?: unknown; tempo?: unknown; energy?: unknown }
    | undefined;
  const interestValues = Array.isArray(signalsRaw?.interests) ? signalsRaw?.interests : [];
  formData.interestIds = interestValues.filter((v): v is string => typeof v === "string");

  const multiCategoryIds =
    Array.isArray(scheduleJson.categoryIds) && scheduleJson.categoryIds.every((x) => typeof x === "string")
      ? (scheduleJson.categoryIds as string[])
      : [];
  const multiSubcategoryMapRaw =
    scheduleJson.subcategoryIdsByCategoryId &&
    typeof scheduleJson.subcategoryIdsByCategoryId === "object"
      ? (scheduleJson.subcategoryIdsByCategoryId as Record<string, unknown>)
      : {};

  formData.categoryId =
    (typeof scheduleJson.categoryId === "string" ? scheduleJson.categoryId : null) ?? null;
  formData.subcategoryId =
    (typeof scheduleJson.subcategoryId === "string" ? scheduleJson.subcategoryId : null) ?? null;
  formData.ageRangeIds = Array.isArray(scheduleJson.ageRangeIds)
    ? (scheduleJson.ageRangeIds as string[])
    : [];
  formData.categorySlug =
    (typeof scheduleJson.categorySlug === "string" ? scheduleJson.categorySlug : null) ?? null;
  formData.categoryPathLabel =
    (typeof scheduleJson.categoryPathLabel === "string" ? scheduleJson.categoryPathLabel : null) ??
    null;

  // Program categories (many-to-many, stored separately from scheduleJson)
  const rawProgramLinks = Array.isArray(event.programCategoryLinks)
    ? (event.programCategoryLinks as Array<{ categoryId?: unknown }>)
    : [];
  formData.programCategoryIds = rawProgramLinks
    .map((x) => (typeof x.categoryId === "string" ? x.categoryId : null))
    .filter((x): x is string => Boolean(x));

  // Одна основная категория: при legacy multi в JSON берём первый корень
  formData.categoryIds =
    multiCategoryIds.length > 0
      ? [multiCategoryIds[0]]
      : formData.categoryId
        ? [formData.categoryId]
        : [];

  if (Object.keys(multiSubcategoryMapRaw).length > 0) {
    const nextMap: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(multiSubcategoryMapRaw)) {
      if (Array.isArray(v)) {
        nextMap[k] = v.filter((x): x is string => typeof x === "string");
      } else if (typeof v === "string") {
        nextMap[k] = [v];
      } else {
        nextMap[k] = [];
      }
    }
    formData.subcategoryIdsByCategoryId = nextMap;
  } else if (formData.categoryId) {
    formData.subcategoryIdsByCategoryId = {
      [formData.categoryId]: formData.subcategoryId ? [formData.subcategoryId] : [],
    };
  } else {
    formData.subcategoryIdsByCategoryId = {};
  }

  // Legacy: в подкатегориях оставляем только первую выбранную
  for (const k of Object.keys(formData.subcategoryIdsByCategoryId)) {
    const arr = formData.subcategoryIdsByCategoryId[k];
    if (Array.isArray(arr) && arr.length > 1) {
      const first = arr[0];
      formData.subcategoryIdsByCategoryId[k] = first ? [first] : [];
      if (k === formData.categoryId) {
        formData.subcategoryId = first ?? null;
      }
    }
  }

  // If scheduleJson had multi-category but legacy primary is missing, infer primary from first root
  if (!formData.categoryId && formData.categoryIds.length > 0) {
    const primaryRootId = formData.categoryIds[0];
    const primarySub = formData.subcategoryIdsByCategoryId[primaryRootId]?.[0] ?? null;
    formData.categoryId = primaryRootId;
    formData.subcategoryId = primarySub;
  }

  const ec = event.eventCategory as
    | { id: string; parentId: string | null; slug: string; nameRu: string }
    | undefined
    | null;
  if (ec) {
    if (!formData.categoryId) {
      if (ec.parentId) {
        formData.categoryId = ec.parentId;
        formData.subcategoryId = ec.id;
      } else {
        formData.categoryId = ec.id;
      }
    }
    if (!formData.categorySlug) {
      formData.categorySlug = ec.slug;
    }
    formData.primaryRootHasChildren = ec.parentId != null;
  } else {
    formData.primaryRootHasChildren = false;
  }

  const gbcRaw = scheduleJson.genresByCategoryId;
  if (gbcRaw && typeof gbcRaw === "object" && !Array.isArray(gbcRaw)) {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(gbcRaw as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) next[k] = v.trim();
    }
    formData.genreSlugByRootCategoryId = next;
  }

  if (scheduleJson.cinema && typeof scheduleJson.cinema === "object") {
    const c = scheduleJson.cinema as Record<string, unknown>;
    formData.cinemaGenre = typeof c.genre === "string" ? c.genre : undefined;
    formData.cinemaDuration = typeof c.duration === "number" ? c.duration : undefined;
    formData.cinemaTrailerUrl = typeof c.trailerUrl === "string" ? c.trailerUrl : undefined;
  }

  if (
    formData.cinemaGenre &&
    formData.categoryId &&
    !formData.genreSlugByRootCategoryId[formData.categoryId]
  ) {
    formData.genreSlugByRootCategoryId = {
      ...formData.genreSlugByRootCategoryId,
      [formData.categoryId]: formData.cinemaGenre,
    };
  }

  formData.categoryIds = formData.categoryId ? [formData.categoryId] : [];

  // Step 2: Description
  formData.fullDescription = event.description || "";

  // Step 3: Media
  formData.coverImage = event.coverImageId || null;
  formData.gallery = event.images?.map((img) => img.url || img.imageId || "") || [];
  formData.reelsUrl =
    (typeof scheduleJson.reelsUrl === "string" ? scheduleJson.reelsUrl : "") || "";

  // Step 4: Schedule (MVP: common time for all dates)
  const scheduleModeRaw = scheduleJson.scheduleMode;
  formData.scheduleMode =
    scheduleModeRaw === "single" || scheduleModeRaw === "multiple"
      ? scheduleModeRaw
      : "single";

  formData.dates = Array.isArray(scheduleJson.dates)
    ? (scheduleJson.dates as string[])
    : [];

  formData.allDay = typeof scheduleJson.allDay === "boolean" ? scheduleJson.allDay : false;
  formData.startTime = typeof scheduleJson.startTime === "string" ? scheduleJson.startTime : "10:00";
  formData.endTime = typeof scheduleJson.endTime === "string" ? scheduleJson.endTime : "18:00";

  formData.repeatEnabled =
    typeof scheduleJson.repeatEnabled === "boolean" ? scheduleJson.repeatEnabled : false;

  const repeatUnitRaw = scheduleJson.repeatUnit;
  formData.repeatUnit =
    repeatUnitRaw === "day" ||
    repeatUnitRaw === "week" ||
    repeatUnitRaw === "month" ||
    repeatUnitRaw === "year"
      ? repeatUnitRaw
      : null;

  formData.repeatUntil =
    typeof scheduleJson.repeatUntil === "string" ? scheduleJson.repeatUntil : null;

  // Step 5: Pricing & Participation
  const priceTextRaw = typeof event.priceText === "string" ? event.priceText : "";
  const priceFromDb = event.priceFrom != null ? Number(event.priceFrom) : null;
  const priceToDb = event.priceTo != null ? Number(event.priceTo) : null;

  formData.pricingMode = normalizePricingMode(scheduleJson.pricingMode, {
    priceText: priceTextRaw,
    priceFrom: priceFromDb,
    priceTo: priceToDb,
  });

  if (formData.pricingMode === "free") {
    formData.price = "";
  } else {
    formData.price =
      priceTextRaw &&
      !/^бесплатно$/i.test(priceTextRaw.trim()) &&
      !/^free$/i.test(priceTextRaw.trim())
        ? priceTextRaw
        : priceFromDb != null && !Number.isNaN(priceFromDb)
          ? String(priceFromDb)
          : "";
  }
  formData.priceDetails = typeof scheduleJson.priceDetails === "string" ? scheduleJson.priceDetails : "";
  formData.ticketLink = typeof scheduleJson.ticketLink === "string" ? scheduleJson.ticketLink : "";

  formData.participationMode = normalizeParticipationMode(scheduleJson.participationMode);

  formData.simpleBookingDate =
    typeof scheduleJson.simpleBookingDate === "string"
      ? scheduleJson.simpleBookingDate
      : null;
  formData.simpleBookingTime =
    typeof scheduleJson.simpleBookingTime === "string"
      ? scheduleJson.simpleBookingTime
      : null;
  formData.simpleBookingCapacity =
    typeof scheduleJson.simpleBookingCapacity === "number"
      ? scheduleJson.simpleBookingCapacity
      : null;

  const timeSlotsRaw = scheduleJson.timeSlots;
  formData.timeSlots =
    timeSlotsRaw &&
    typeof timeSlotsRaw === "object" &&
    Array.isArray((timeSlotsRaw as Record<string, unknown>).dates)
      ? (timeSlotsRaw as EventFormData["timeSlots"])
      : { dates: [] };

  // Step 6: Location (EventVenue)
  if (event.venue) {
    formData.venueKind = event.venue.kind;
    formData.placeId = event.venue.placeId ?? null;
    formData.venueName = event.venue.title ?? "";
    formData.address = event.venue.addressLine ?? "";
    formData.city = event.venue.cityId ?? "";
    formData.venueNote = event.venue.note ?? "";
    
    // Map district and metro fields if available
    formData.districtAutoId = event.venue.districtAutoId || null;
    formData.districtManualId = event.venue.districtManualId || null;
    formData.metroAutoId = event.venue.metroAutoId || null;
    formData.metroAutoDistanceM = event.venue.metroAutoDistanceM || null;
    formData.metroManualId = event.venue.metroManualId || null;
    formData.metroManualDistanceM = event.venue.metroManualDistanceM || null;
    
    // Legacy fields for backward compatibility
    formData.district = event.venue.district || "";
    formData.metro = event.venue.metro || "";
  } else if (event.placeId) {
    // Legacy: if no venue but has placeId
    formData.venueKind = "PLACE";
    formData.placeId = event.placeId;
  } else {
    formData.venueKind = null;
  }

  // Step 7: Contacts
  const contacts = scheduleJson.contacts as Record<string, unknown> | undefined;
  formData.phone = normalizePhoneToE164(
    typeof contacts?.phone === "string" ? contacts.phone : "",
  );
  formData.website = typeof contacts?.website === "string" ? contacts.website : "";
  const rawSocial = Array.isArray(contacts?.socialLinks)
    ? (contacts.socialLinks as EventFormData["socialLinks"])
    : [];
  formData.socialLinks =
    rawSocial.length > 0
      ? rawSocial.map((link, i) => ({
          ...link,
          id: typeof link.id === "string" && link.id.length > 0 ? link.id : `social-${i}`,
        }))
      : [createDefaultSocialLink()];

  // Step 8: Organizer
  const org = scheduleJson.organizer as Record<string, unknown> | undefined;
  formData.organizerMode = (org?.mode as EventFormData["organizerMode"]) || "business";
  formData.organizerName =
    (typeof org?.name === "string" ? org.name : null) || event.owner?.name || "";
  formData.organizerDescription =
    typeof org?.description === "string" ? org.description : "";

  return formData;
}

type EventPayload = {
  title: string;
  shortDesc: string;
  description: string;
  type: "EVENT";
  ageTags: string[];
  scheduleMode: "MULTI_DATE";
  eventCategoryId?: string;
  programCategoryIds: string[];
  scheduleJson: Record<string, unknown>;
  priceFrom: number | null;
  priceTo: number | null;
  priceText: string;
  priceDetails?: string;
  currency: string;
  coverImageId: string | null;
  venue: {
    kind: string | null;
    placeId: string | null;
    title?: string;
    addressLine?: string;
    cityId?: string;
    note?: string;
    districtAutoId?: string | null;
    districtManualId?: string | null;
    metroAutoId?: string | null;
    metroAutoDistanceM?: number | null;
    metroManualId?: string | null;
    metroManualDistanceM?: number | null;
    district?: string;
    metro?: string;
  };
};

/**
 * Build Activity payload from EventFormData
 * Used when creating or updating event
 */
export function buildEventPayload(data: EventFormData): EventPayload {
  const categoryIds = data.categoryId ? [data.categoryId] : [];

  const subcategoryIdsByCategoryId: Record<string, string[]> = {};
  if (data.categoryId) {
    subcategoryIdsByCategoryId[data.categoryId] = data.subcategoryId
      ? [data.subcategoryId]
      : [];
  }

  const leafCategoryId = data.subcategoryId || data.categoryId;

  const genreMap = data.genreSlugByRootCategoryId ?? {};
  const primaryRootId = data.categoryId ?? null;
  const cinemaGenreResolved =
    (primaryRootId && genreMap[primaryRootId]) ||
    (data.categoryId && genreMap[data.categoryId]) ||
    data.cinemaGenre;

  const cinemaBlock = isCinemaEventCategorySlug(data.categorySlug)
    ? {
        genre: cinemaGenreResolved,
        duration: data.cinemaDuration,
        trailerUrl: data.cinemaTrailerUrl,
      }
    : undefined;

  const shortDesc = computeEventShortDesc({
    title: data.title ?? "",
    fullDescriptionHtml: data.fullDescription ?? "",
  });

  const payload: EventPayload = {
    title: data.title,
    shortDesc,
    description: data.fullDescription,

    type: "EVENT",

    ageTags: data.ageTags,

    scheduleMode: "MULTI_DATE",

    eventCategoryId: leafCategoryId || undefined,
    programCategoryIds: Array.isArray(data.programCategoryIds) ? data.programCategoryIds : [],

    scheduleJson: {
      ...(data.eventFormats.length > 0
        ? {
            eventFormats: data.eventFormats,
            signals: mapEventFormatsToSignals(data.eventFormats),
          }
        : {}),
      ...(data.interestIds.length > 0
        ? {
            signals: {
              ...(data.eventFormats.length > 0 ? mapEventFormatsToSignals(data.eventFormats) : {}),
              interests: data.interestIds,
            },
          }
        : data.eventFormats.length > 0
          ? {
              signals: mapEventFormatsToSignals(data.eventFormats),
            }
          : {}),
      subcategoryIdsByCategoryId:
        Object.keys(subcategoryIdsByCategoryId).length > 0 ? subcategoryIdsByCategoryId : undefined,
      categoryId: data.categoryId,
      ...(data.subcategoryId ? { subcategoryId: data.subcategoryId } : {}),
      categorySlug: data.categorySlug || undefined,
      categoryPathLabel: data.categoryPathLabel || undefined,
      ageRangeIds: data.ageRangeIds,

      ...(Object.keys(genreMap).length > 0 ? { genresByCategoryId: genreMap } : {}),

      cinema: cinemaBlock,

      reelsUrl: data.reelsUrl,

      scheduleMode: data.scheduleMode,
      dates: data.dates,
      allDay: data.allDay,
      startTime: data.startTime,
      endTime: data.endTime,
      repeatEnabled: data.repeatEnabled,
      repeatUnit: data.repeatUnit,
      repeatUntil: data.repeatUntil,

      pricingMode: data.pricingMode,
      priceDetails: data.priceDetails,
      ticketLink: data.ticketLink,
      participationMode: normalizeParticipationMode(data.participationMode),
      simpleBookingDate: data.simpleBookingDate,
      simpleBookingTime: data.simpleBookingTime,
      simpleBookingCapacity: data.simpleBookingCapacity,
      timeSlots: data.timeSlots,

      contacts: {
        phone: normalizePhoneToE164(data.phone),
        website: data.website,
        socialLinks: data.socialLinks.filter((l) => l.url.trim().length > 0),
      },

      organizer: {
        mode: data.organizerMode,
        name: data.organizerName,
        description: data.organizerDescription,
      },
    },

    priceFrom:
      (data.pricingMode === "fixed" || data.pricingMode === "from") && data.price?.trim()
        ? parseFloat(data.price) || null
        : null,
    priceTo:
      data.pricingMode === "fixed" && data.price?.trim()
        ? parseFloat(data.price) || null
        : null,
    priceText:
      data.pricingMode === "free"
        ? "бесплатно"
        : data.price?.trim()
          ? data.price.trim()
          : "",
    priceDetails: data.priceDetails,
    currency: "BYN",

    coverImageId: data.coverImage,

    venue: {
      kind: data.venueKind,
      placeId: data.venueKind === "PLACE" ? data.placeId : null,
      title: data.venueName,
      addressLine: data.address,
      cityId: data.city,
      note: data.venueNote,

      districtAutoId: data.districtAutoId,
      districtManualId: data.districtManualId,
      metroAutoId: data.metroAutoId,
      metroAutoDistanceM: data.metroAutoDistanceM,
      metroManualId: data.metroManualId,
      metroManualDistanceM: data.metroManualDistanceM,

      district: data.district,
      metro: data.metro,
    },
  };

  return payload;
}

type EventChanges = {
  title?: string;
  description?: string;
  ageTags?: string[];
  coverImageId?: string | null;
  scheduleJson?: Record<string, unknown>;
  priceFrom?: number | null;
  priceTo?: number | null;
  priceText?: string;
  venue?: EventPayload["venue"];
};

/**
 * Extract changes between current and original data
 * Used for PATCH updates in edit mode
 */
export function extractChanges(current: EventFormData, original: EventFormData): EventChanges {
  const changes: EventChanges = {};

  // Compare each field and add to changes if different
  if (current.title !== original.title) {
    changes.title = current.title;
  }

  if (current.fullDescription !== original.fullDescription) {
    changes.description = current.fullDescription;
  }

  if (JSON.stringify(current.ageTags) !== JSON.stringify(original.ageTags)) {
    changes.ageTags = current.ageTags;
  }

  if (current.coverImage !== original.coverImage) {
    changes.coverImageId = current.coverImage;
  }

  // For simplicity, always update scheduleJson if any schedule-related field changed
  if (
    JSON.stringify(current.dates) !== JSON.stringify(original.dates) ||
    current.allDay !== original.allDay ||
    current.startTime !== original.startTime ||
    current.endTime !== original.endTime ||
    current.repeatEnabled !== original.repeatEnabled
  ) {
    changes.scheduleJson = buildEventPayload(current).scheduleJson;
  }

  // Pricing changes
  if (current.pricingMode !== original.pricingMode || current.price !== original.price) {
    const p = current.price?.trim();
    const parsed = p ? parseFloat(p) : NaN;
    const has = p && !Number.isNaN(parsed);
    changes.priceFrom =
      (current.pricingMode === "fixed" || current.pricingMode === "from") && has
        ? parsed
        : null;
    changes.priceTo =
      current.pricingMode === "fixed" && has ? parsed : null;
    changes.priceText =
      current.pricingMode === "free" ? "бесплатно" : has ? p : "";
  }

  // Venue changes
  if (
    current.venueKind !== original.venueKind ||
    current.placeId !== original.placeId ||
    current.venueName !== original.venueName ||
    current.address !== original.address ||
    current.city !== original.city ||
    current.venueNote !== original.venueNote ||
    current.districtAutoId !== original.districtAutoId ||
    current.districtManualId !== original.districtManualId ||
    current.metroAutoId !== original.metroAutoId ||
    current.metroManualId !== original.metroManualId
  ) {
    changes.venue = buildEventPayload(current).venue;
  }

  return changes;
}
