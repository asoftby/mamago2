// Event Wizard Data Mappers

import type { EventFormData } from "./types";
import type { PendingLocation } from "./types";
import type { Activity, ActivityFormat } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { getDefaultFormData } from "./defaults";
import {
  mapEventFormatsToSignals,
  resolveEventFormatsFromScheduleJson,
} from "@/lib/business/eventFormatSignals";
import { isCinemaEventCategorySlug } from "@/lib/business/eventCategoryCinema";
import { normalizeParticipationMode } from "./participationCtaLabels";
import { normalizePricingMode } from "./pricingMode";
import { normalizePhoneToE164 } from "@/lib/phone/e164";
import { createDefaultScheduleItem, createDefaultSocialLink } from "./defaults";
import { computeEventShortDesc } from "@/lib/business/eventShortDesc";
import { detectAgeBuckets } from "@/lib/age/ageMapping";
import { sortAgeKeys } from "@/lib/config/ages";
import type { EventOrganizerInput } from "@/lib/business/eventOrganizer";
import { DEFAULT_ACTIVITY_FORMAT, normalizeActivityFormat } from "@/domain/activities/activity-format";
import { normalizeRichTextEditorValue } from "@/lib/richtext/utils";
import { expandScheduleItemDates } from "@/lib/event/expandScheduleItemDates";

export type ActivityWithRelations = Activity & {
  id: string;
  title: string | null;
  description: string | null;
  ageTags: string[];
  scheduleJson: Record<string, unknown> | null;
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
  organizer?: {
    id: string;
    name: string;
    unp?: string | null;
    phone?: string | null;
    website?: string | null;
    instagram?: string | null;
    createdFrom?: "IMPORT" | "MANUAL";
  } | null;
  programCategoryLinks?: Array<{ categoryId: string }>;
};

/**
 * Применяет данные из pendingLocation в UI-поля formData.
 * Вызывается при загрузке черновика из сервера.
 */
function applyPendingLocationToFormData(formData: EventFormData, pending: PendingLocation): void {
  switch (pending.mode) {
    case "EXISTING_PLACE":
      formData.locationSource = "PLACE";
      formData.venueKind = "PLACE";
      formData.placeId = pending.placeId ?? null;
      formData.venueName = pending.title ?? "";
      formData.address = pending.address ?? "";
      formData.city = pending.city ?? "";
      formData.lat = pending.lat ?? null;
      formData.lng = pending.lng ?? null;
      break;
    case "NEW_PLACE":
    case "PARSED_LOCATION":
      formData.locationSource = "MANUAL";
      formData.venueKind = "MANUAL";
      formData.placeId = null;
      formData.venueName = pending.title ?? "";
      formData.address = pending.address ?? "";
      formData.city = pending.city ?? "";
      formData.lat = pending.lat ?? null;
      formData.lng = pending.lng ?? null;
      break;
    case "OFFSITE":
      formData.locationSource = null;
      formData.venueKind = "MOBILE";
      formData.placeId = null;
      formData.venueName = "";
      formData.address = "";
      break;
    case "TBA":
      formData.locationSource = null;
      formData.venueKind = "TBD";
      formData.placeId = null;
      formData.venueName = "";
      formData.address = "";
      break;
  }
}

/**
 * Map Activity entity to EventFormData
 * Used when loading event for editing
 */
export function mapEventToFormData(event: ActivityWithRelations): EventFormData {
  const formData = getDefaultFormData();

  // Step 1: Basics
  formData.title = event.title || "";
  formData.format = normalizeActivityFormat(event.format, DEFAULT_ACTIVITY_FORMAT);
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
  const rawAgeDetection = scheduleJson.ageDetection;
  if (rawAgeDetection && typeof rawAgeDetection === "object") {
    const detection = rawAgeDetection as Record<string, unknown>;
    const raw = typeof detection.raw === "string" ? detection.raw : null;
    formData.ageDetection = raw
      ? detectAgeBuckets(raw)
      : {
          raw: null,
          confidence:
            detection.confidence === "high" ||
            detection.confidence === "medium" ||
            detection.confidence === "low" ||
            detection.confidence === "none"
              ? detection.confidence
              : "none",
          suggestedBuckets: [],
          normalizedLabel: null,
          parsedMinAge: null,
          parsedMaxAge: null,
        };
  } else {
    formData.ageDetection = detectAgeBuckets(
      typeof scheduleJson.importedAgeText === "string" ? scheduleJson.importedAgeText : null,
    );
  }
  formData.ageDetectionUserOverride =
    typeof scheduleJson.ageDetectionUserOverride === "boolean"
      ? scheduleJson.ageDetectionUserOverride
      : false;
  formData.ageDetectionAutoApplied =
    typeof scheduleJson.ageDetectionAutoApplied === "boolean"
      ? scheduleJson.ageDetectionAutoApplied
      : !formData.ageDetectionUserOverride &&
        formData.ageDetection?.confidence === "high" &&
        formData.ageRangeIds.length > 0 &&
        sortAgeKeys(formData.ageRangeIds).join("|") ===
          sortAgeKeys(formData.ageDetection?.suggestedBuckets ?? []).join("|");
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
  if (formData.ageRangeIds.length === 0 && formData.ageTags.length > 0) {
    formData.ageRangeIds = [...formData.ageTags];
  }

  // Step 2: Description
  formData.fullDescription = normalizeRichTextEditorValue(event.description);

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

  const scheduleItemsRaw = Array.isArray(scheduleJson.scheduleItems)
    ? scheduleJson.scheduleItems
    : null;
  const normalizedScheduleItems =
    scheduleItemsRaw && scheduleItemsRaw.length > 0
      ? (scheduleItemsRaw as EventFormData["scheduleItems"])
      : null;

  formData.dates = normalizedScheduleItems
    ? expandScheduleItemDates(normalizedScheduleItems)
    : Array.isArray(scheduleJson.dates)
      ? (scheduleJson.dates as string[])
      : [];

  formData.scheduleItems =
    normalizedScheduleItems
      ? normalizedScheduleItems
      : formData.dates.length > 0
        ? formData.dates.map((date, index) => ({
            id: `date-${index}`,
            isMultiDay: false,
            date,
            dateEnd: null,
            allDay: formData.allDay,
            startTime: formData.startTime || "10:00",
            endTime: formData.endTime || "18:00",
            recurringEnabled: formData.repeatEnabled,
            recurrenceInterval: 1,
            recurrenceUnit: formData.repeatUnit || "week",
            recurrenceUntil: formData.repeatUntil,
            isCollapsed: false,
          }))
        : [createDefaultScheduleItem()];

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
  formData.priceDetails =
    typeof scheduleJson.priceDetails === "string"
      ? normalizeRichTextEditorValue(scheduleJson.priceDetails)
      : "";
  formData.ticketLink = typeof scheduleJson.ticketLink === "string" ? scheduleJson.ticketLink : "";

  formData.participationMode = normalizeParticipationMode(scheduleJson.participationMode);
  formData.prebookMethod =
    scheduleJson.prebookMethod === "phone" || scheduleJson.prebookMethod === "link"
      ? scheduleJson.prebookMethod
      : null;
  formData.prebookPhone =
    typeof scheduleJson.prebookPhone === "string" ? scheduleJson.prebookPhone : "";
  formData.prebookUrl =
    typeof scheduleJson.prebookUrl === "string" ? scheduleJson.prebookUrl : "";

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
    formData.venueNote = normalizeRichTextEditorValue(event.venue.note);
    
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

  // pendingLocation — единственный источник правды до публикации.
  // Читаем из scheduleJson и восстанавливаем в formData.
  const rawPendingLocation = scheduleJson.pendingLocation;
  if (rawPendingLocation && typeof rawPendingLocation === "object" && !Array.isArray(rawPendingLocation)) {
    const pl = rawPendingLocation as Record<string, unknown>;
    const plMode = pl.mode;
    if (
      plMode === "EXISTING_PLACE" ||
      plMode === "NEW_PLACE" ||
      plMode === "PARSED_LOCATION" ||
      plMode === "OFFSITE" ||
      plMode === "TBA"
    ) {
      const pending: PendingLocation = { mode: plMode };
      if (typeof pl.placeId === "string") pending.placeId = pl.placeId;
      if (typeof pl.title === "string") pending.title = pl.title;
      if (typeof pl.address === "string") pending.address = pl.address;
      if (typeof pl.city === "string") pending.city = pl.city;
      if (typeof pl.lat === "number") pending.lat = pl.lat;
      if (typeof pl.lng === "number") pending.lng = pl.lng;
      if (pl.source === "manual" || pl.source === "parser") pending.source = pl.source;
      if (pl.raw !== undefined) pending.raw = pl.raw;
      formData.pendingLocation = pending;
      applyPendingLocationToFormData(formData, pending);
    }
  }

  const contacts = scheduleJson.contacts as Record<string, unknown> | undefined;
  formData.contactMode =
    contacts?.mode === "override"
      ? "override"
      : event.venue?.placeId || event.placeId
        ? "inherit"
        : "override";
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
  const organizerModeRaw = typeof org?.mode === "string" ? org.mode : null;
  formData.organizerMode =
    organizerModeRaw === "existing" ||
    organizerModeRaw === "import" ||
    organizerModeRaw === "manual"
      ? organizerModeRaw
      : event.organizerId
        ? "existing"
        : "manual";
  formData.organizerId =
    event.organizer?.id ??
    (typeof org?.id === "string" ? org.id : null) ??
    null;
  formData.organizerName =
    event.organizer?.name ??
    (typeof org?.name === "string" ? org.name : null) ??
    "";
  formData.organizerUnp =
    event.organizer?.unp ??
    (typeof org?.unp === "string" ? org.unp : "") ??
    "";
  formData.organizerPhone =
    normalizePhoneToE164(
      event.organizer?.phone ??
        (typeof org?.phone === "string" ? org.phone : ""),
    );
  formData.organizerWebsite =
    event.organizer?.website ??
    (typeof org?.website === "string" ? org.website : "");
  formData.organizerInstagram =
    event.organizer?.instagram ??
    (typeof org?.instagram === "string" ? org.instagram : "");

  // Occasions — loaded from occasionLinks if present on the activity
  const activityWithOccasions = event as unknown as {
    occasionLinks?: Array<{ occasionId: string }>;
  };
  formData.occasionIds = Array.isArray(activityWithOccasions.occasionLinks)
    ? activityWithOccasions.occasionLinks.map((l) => l.occasionId)
    : [];

  return formData;
}

type EventPayload = {
  title: string;
  shortDesc: string;
  description: string;
  type: "EVENT";
  format: ActivityFormat;
  ageTags: string[];
  scheduleMode: "MULTI_DATE";
  eventCategoryId?: string;
  programCategoryIds: string[];
  scheduleJson: Record<string, unknown> | null;
  priceFrom: number | null;
  priceTo: number | null;
  priceText: string;
  priceDetails?: string;
  currency: string;
  coverImageId: string | null;
  galleryMediaIds: string[];
  occasionIds: string[];
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
  organizerId?: string | null;
  organizerInput?: EventOrganizerInput | null;
};

/**
 * Build Activity payload from EventFormData
 * Used when creating or updating event
 */
export function buildEventPayload(data: EventFormData): EventPayload {
  const normalizedScheduleItems =
    Array.isArray(data.scheduleItems) && data.scheduleItems.length > 0
      ? data.scheduleItems
      : [createDefaultScheduleItem()];
  const firstScheduleItem = normalizedScheduleItems[0] ?? createDefaultScheduleItem();
  const normalizedDates = expandScheduleItemDates(normalizedScheduleItems);

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
    format: normalizeActivityFormat(data.format, DEFAULT_ACTIVITY_FORMAT),

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
      ageDetection: data.ageDetection,
      ageDetectionUserOverride: data.ageDetectionUserOverride,
      ageDetectionAutoApplied: data.ageDetectionAutoApplied,

      ...(Object.keys(genreMap).length > 0 ? { genresByCategoryId: genreMap } : {}),

      cinema: cinemaBlock,

      reelsUrl: data.reelsUrl,

      scheduleMode:
        normalizedScheduleItems.length > 1 || data.scheduleMode === "multiple"
          ? "multiple"
          : "single",
      scheduleItems: normalizedScheduleItems,
      dates: normalizedDates,
      allDay: firstScheduleItem.allDay,
      startTime: firstScheduleItem.startTime,
      endTime: firstScheduleItem.endTime,
      repeatEnabled: firstScheduleItem.recurringEnabled,
      repeatUnit: firstScheduleItem.recurrenceUnit,
      repeatUntil: firstScheduleItem.recurrenceUntil,

      pricingMode: data.pricingMode,
      priceDetails: data.priceDetails,
      ticketLink: data.ticketLink,
      participationMode: normalizeParticipationMode(data.participationMode),
      prebookMethod: data.prebookMethod,
      prebookPhone: normalizePhoneToE164(data.prebookPhone),
      prebookUrl: data.prebookUrl,
      simpleBookingDate: data.simpleBookingDate,
      simpleBookingTime: data.simpleBookingTime,
      simpleBookingCapacity: data.simpleBookingCapacity,
      timeSlots: data.timeSlots,

      contacts: {
        mode:
          data.venueKind === "PLACE" && data.placeId && data.contactMode !== "override"
            ? "inherit"
            : "override",
        phone: normalizePhoneToE164(data.phone),
        website: data.website,
        socialLinks: data.socialLinks.filter((l) => l.url.trim().length > 0),
      },

      organizer: {
        mode: data.organizerMode,
        id: data.organizerId,
        name: data.organizerName,
        unp: data.organizerUnp,
        phone: normalizePhoneToE164(data.organizerPhone),
        website: data.organizerWebsite,
        instagram: data.organizerInstagram,
      },

      // pendingLocation — единственный источник правды о локации до публикации
      ...(data.pendingLocation ? { pendingLocation: data.pendingLocation } : {}),
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
    galleryMediaIds: Array.isArray(data.gallery) ? data.gallery.filter(Boolean) : [],
    occasionIds: Array.isArray(data.occasionIds) ? data.occasionIds : [],

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
    organizerId: data.organizerMode === "existing" ? data.organizerId : null,
    organizerInput: {
      mode: data.organizerMode,
      organizerId: data.organizerId,
      name: data.organizerName,
      unp: data.organizerUnp,
      phone: normalizePhoneToE164(data.organizerPhone),
      website: data.organizerWebsite,
      instagram: data.organizerInstagram,
    },
  };

  return payload;
}

type EventChanges = {
  title?: string;
  description?: string;
  format?: ActivityFormat;
  ageTags?: string[];
  coverImageId?: string | null;
  galleryMediaIds?: string[];
  scheduleJson?: Record<string, unknown>;
  priceFrom?: number | null;
  priceTo?: number | null;
  priceText?: string;
  venue?: EventPayload["venue"];
  occasionIds?: string[];
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

  if (current.format !== original.format) {
    changes.format = current.format;
  }

  if (JSON.stringify(current.ageTags) !== JSON.stringify(original.ageTags)) {
    changes.ageTags = current.ageTags;
  }

  if (current.coverImage !== original.coverImage) {
    changes.coverImageId = current.coverImage;
  }

  if (JSON.stringify(current.gallery) !== JSON.stringify(original.gallery)) {
    changes.galleryMediaIds = current.gallery;
  }

  // For simplicity, always update scheduleJson if any schedule-related field changed
  if (
    JSON.stringify(current.dates) !== JSON.stringify(original.dates) ||
    current.allDay !== original.allDay ||
    current.startTime !== original.startTime ||
    current.endTime !== original.endTime ||
    current.repeatEnabled !== original.repeatEnabled
  ) {
    changes.scheduleJson = buildEventPayload(current).scheduleJson as Record<string, unknown> | undefined;
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
    current.metroManualId !== original.metroManualId ||
    JSON.stringify(current.pendingLocation) !== JSON.stringify(original.pendingLocation)
  ) {
    changes.venue = buildEventPayload(current).venue;
    // Включаем pendingLocation в scheduleJson при изменении локации
    changes.scheduleJson = {
      ...(changes.scheduleJson ?? {}),
      ...(current.pendingLocation ? { pendingLocation: current.pendingLocation } : { pendingLocation: null }),
    };
  }

  // Occasion changes
  const curOccasions = JSON.stringify([...(current.occasionIds ?? [])].sort());
  const origOccasions = JSON.stringify([...(original.occasionIds ?? [])].sort());
  if (curOccasions !== origOccasions) {
    changes.occasionIds = current.occasionIds ?? [];
  }

  return changes;
}
