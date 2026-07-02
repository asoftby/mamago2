import {
  buildCanonicalCtaFromCtaStepValue,
  buildCtaStepFormValueFromCanonical,
  type CtaStepFormValue,
  type CtaStepSourceContext,
} from "@/components/business/wizard/shared/CtaStep";
import type { PublicationAccess } from "@/features/publication-access";
import { OfferCtaAdapter } from "@/lib/cta-platform";
import type { OfferFormData } from "./types";

export type OfferLegacyBookingMode =
  | "REQUEST_ONLY"
  | "USE_PUBLICATION_DATES"
  | "USE_PUBLICATION_SLOTS"
  | null;

export interface OfferLegacyCtaFields {
  id: string;
  ctaType: OfferFormData["ctaType"];
  ctaPhone: string;
  ctaLink: string;
  ctaInstructions: string;
  bookingEnabled: boolean;
  bookingMode: OfferLegacyBookingMode;
  bookingPhone: string;
  bookingNote: string;
}

const OFFER_CTA_SOURCE: CtaStepSourceContext = {
  sourceEntityType: "OFFER",
  sourceEntityId: "offer-cta-mapper",
};

function createDefaultBookingSettings(): OfferFormData["bookingSettings"] {
  return {
    mode: null,
    selectionType: null,
    availableDaysAhead: null,
    capacityPerUnit: null,
    leadTime: null,
    slotDurationMinutes: null,
    externalUrl: null,
    externalButtonLabel: null,
    weeklyAvailability: [
      { day: "monday", enabled: false, startTime: null, endTime: null },
      { day: "tuesday", enabled: false, startTime: null, endTime: null },
      { day: "wednesday", enabled: false, startTime: null, endTime: null },
      { day: "thursday", enabled: false, startTime: null, endTime: null },
      { day: "friday", enabled: false, startTime: null, endTime: null },
      { day: "saturday", enabled: false, startTime: null, endTime: null },
      { day: "sunday", enabled: false, startTime: null, endTime: null },
    ],
    excludedDates: [],
  };
}

function trim(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function buildEmptyLegacyFields(
  overrides: Partial<OfferLegacyCtaFields> = {},
): OfferLegacyCtaFields {
  return {
    id: overrides.id ?? "",
    ctaType: overrides.ctaType ?? null,
    ctaPhone: overrides.ctaPhone ?? "",
    ctaLink: overrides.ctaLink ?? "",
    ctaInstructions: overrides.ctaInstructions ?? "",
    bookingEnabled: overrides.bookingEnabled ?? false,
    bookingMode: overrides.bookingMode ?? null,
    bookingPhone: overrides.bookingPhone ?? "",
    bookingNote: overrides.bookingNote ?? "",
  };
}

export function mapOfferLegacyCtaToStepValue(
  input: OfferLegacyCtaFields,
): CtaStepFormValue {
  const canonical = OfferCtaAdapter.toCanonical({
    id: input.id,
    ctaType: input.ctaType,
    ctaPhone: input.ctaPhone,
    ctaLink: input.ctaLink,
    ctaInstructions: input.ctaInstructions,
    bookingEnabled: input.bookingEnabled,
    bookingMode: input.bookingMode,
    bookingPhone: input.bookingPhone,
    bookingNote: input.bookingNote,
  });

  const formValue = buildCtaStepFormValueFromCanonical(canonical);

  formValue.legacyOrigin = input.bookingEnabled ? "BOOKING" : "CTA";
  formValue.instructions = trim(input.bookingNote) || trim(input.ctaInstructions);

  if (input.ctaType === "записаться" || input.bookingMode === "REQUEST_ONLY") {
    formValue.requestLabelKind = "BOOK";
  }

  if (input.ctaType === "отправить_заявку") {
    formValue.requestLabelKind = "REQUEST";
  }

  if (!trim(formValue.fallback.phone)) {
    formValue.fallback.phone = trim(input.bookingPhone) || trim(input.ctaPhone);
  }

  if (!trim(formValue.externalUrl) && canonical.externalTarget?.channel === "URL") {
    formValue.externalUrl = canonical.externalTarget.href;
  }

  return formValue;
}

function resolveBookingModeFromForm(data: OfferFormData): OfferLegacyBookingMode {
  if (data.ctaType !== "забронировать") return null;
  if (data.bookingSettings.mode === "slot") return "USE_PUBLICATION_SLOTS";
  if (data.bookingSettings.mode === "request") {
    return data.bookingSettings.selectionType === "date_time"
      ? "USE_PUBLICATION_SLOTS"
      : "USE_PUBLICATION_DATES";
  }
  return "USE_PUBLICATION_DATES";
}

function resolveLegacyFieldsFromPublicationAccess(
  data: OfferFormData,
): OfferLegacyCtaFields | null {
  if (!data.publicationAccess) return null;

  const access = data.publicationAccess;

  switch (access.method) {
    case "external":
      return buildEmptyLegacyFields({
        ctaType: "перейти_на_сайт",
        ctaPhone: access.phone ?? "",
        ctaLink: access.externalUrl ?? "",
        ctaInstructions: access.instructions ?? "",
      });
    case "contact":
      return buildEmptyLegacyFields({
        ctaType: "отправить_заявку",
        ctaPhone: access.phone ?? "",
        ctaInstructions: access.instructions ?? "",
      });
    case "prebooking":
      return buildEmptyLegacyFields({
        ctaType:
          access.externalUrl?.trim() && !access.phone?.trim()
            ? "отправить_заявку"
            : "записаться",
        ctaPhone: access.phone ?? "",
        ctaLink: access.externalUrl ?? "",
        ctaInstructions: access.instructions ?? "",
        bookingEnabled: true,
        bookingMode: "REQUEST_ONLY",
        bookingPhone: access.phone ?? "",
        bookingNote: access.instructions ?? "",
      });
    case "timeslots": {
      const hasSlotTimes = (access.timeSlots ?? []).some(
        (slot) => slot.startTime?.trim() || slot.endTime?.trim(),
      );
      const bookingMode =
        hasSlotTimes ||
        data.bookingSettings.mode === "slot" ||
        data.bookingSettings.selectionType === "date_time"
          ? "USE_PUBLICATION_SLOTS"
          : "USE_PUBLICATION_DATES";
      return buildEmptyLegacyFields({
        ctaType: "забронировать",
        ctaInstructions: access.instructions ?? "",
        bookingEnabled: true,
        bookingMode,
      });
    }
    case "details":
      return buildEmptyLegacyFields({
        ctaType: access.externalUrl?.trim() ? "перейти_на_сайт" : null,
        ctaLink: access.externalUrl ?? "",
        ctaInstructions: access.instructions ?? "",
      });
    default:
      return buildEmptyLegacyFields();
  }
}

export function mapOfferFormDataToCtaStepValue(
  data: OfferFormData,
  options: {
    id?: string;
  } = {},
): CtaStepFormValue {
  const fromPublicationAccess = resolveLegacyFieldsFromPublicationAccess(data);
  const legacyFields =
    fromPublicationAccess ??
    buildEmptyLegacyFields({
      id: options.id ?? "",
      ctaType: data.ctaType,
      ctaPhone: data.ctaPhone,
      ctaLink: data.ctaLink,
      ctaInstructions: data.ctaInstructions,
      bookingEnabled: data.ctaType === "забронировать",
      bookingMode: resolveBookingModeFromForm(data),
      bookingPhone: data.ctaPhone,
      bookingNote: data.ctaInstructions,
    });

  return mapOfferLegacyCtaToStepValue({
    ...legacyFields,
    id: options.id ?? legacyFields.id,
  });
}

function buildPublicationAccessFromCtaStepValue(
  value: CtaStepFormValue,
): PublicationAccess {
  const instructions = trim(value.instructions) || undefined;
  const phone = trim(value.fallback.phone) || undefined;

  if (value.actionChoice === "EXTERNAL") {
    return {
      method: "external",
      externalUrl: trim(value.externalUrl) || undefined,
      instructions,
    };
  }

  if (value.actionChoice === "REQUEST") {
    if (value.requestMode === "CALENDAR") {
      const timeSlots = value.calendarDays.flatMap((day) => {
        const date = day.date.trim();
        if (!date) return [];

        if (value.calendarMode === "DATE_AND_TIME") {
          return day.slots
            .filter(
              (slot) => slot.startTime.trim().length > 0 || slot.endTime.trim().length > 0,
            )
            .map((slot) => ({
              id: slot.id,
              date,
              startTime: slot.startTime.trim(),
              endTime: slot.endTime.trim() || undefined,
              capacity: slot.capacity,
            }));
        }

        return [
          {
            id: day.id,
            date,
            startTime: "",
            endTime: undefined,
            capacity: day.capacity,
          },
        ];
      });

      return {
        method: "timeslots",
        timeSlots,
        instructions,
      };
    }

    if (value.requestLabelKind === "BOOK") {
      return {
        method: "prebooking",
        phone,
        instructions,
      };
    }

    return {
      method: "contact",
      phone,
      instructions,
    };
  }

  return {
    method: "details",
    instructions,
  };
}

function buildBookingSettingsFromCtaStepValue(
  value: CtaStepFormValue,
): OfferFormData["bookingSettings"] {
  const bookingSettings = createDefaultBookingSettings();

  if (value.actionChoice !== "REQUEST" || value.requestMode !== "CALENDAR") {
    return bookingSettings;
  }

  const capacities = value.calendarDays
    .flatMap((day) => [
      day.capacity,
      ...day.slots.map((slot) => slot.capacity),
    ])
    .filter((capacity): capacity is number => typeof capacity === "number" && capacity > 0);
  const capacityPerUnit = capacities[0] ?? 1;

  if (value.calendarMode === "DATE_AND_TIME") {
    const firstSlot = value.calendarDays
      .flatMap((day) => day.slots)
      .find((slot) => slot.startTime.trim() && slot.endTime.trim());

    const weeklyAvailability = bookingSettings.weeklyAvailability.map((day) => ({ ...day }));

    for (const calendarDay of value.calendarDays) {
      const date = calendarDay.date.trim();
      if (!date) continue;

      const weekday = new Date(`${date}T00:00:00`).getDay();
      const weekdayKey = (
        ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const
      )[weekday];
      const match = weeklyAvailability.find((item) => item.day === weekdayKey);
      const slot =
        calendarDay.slots.find((item) => item.startTime.trim() && item.endTime.trim()) ??
        firstSlot;

      if (match && slot) {
        match.enabled = true;
        match.startTime = slot.startTime.trim();
        match.endTime = slot.endTime.trim();
      }
    }

    let slotDurationMinutes = 60;
    if (firstSlot) {
      const [startHour = 0, startMinute = 0] = firstSlot.startTime.split(":").map(Number);
      const [endHour = 0, endMinute = 0] = firstSlot.endTime.split(":").map(Number);
      const duration = endHour * 60 + endMinute - (startHour * 60 + startMinute);
      if (duration >= 15) {
        slotDurationMinutes = duration;
      }
    }

    return {
      ...bookingSettings,
      mode: "slot",
      selectionType: "date_time",
      availableDaysAhead: 30,
      capacityPerUnit,
      slotDurationMinutes,
      weeklyAvailability,
    };
  }

  return {
    ...bookingSettings,
    mode: "request",
    selectionType: "date_only",
    availableDaysAhead: 30,
    capacityPerUnit,
  };
}

export function mapCtaStepValueToOfferLegacy(
  value: CtaStepFormValue,
  options: {
    id?: string;
  } = {},
): OfferLegacyCtaFields {
  const canonical = buildCanonicalCtaFromCtaStepValue(
    {
      ...OFFER_CTA_SOURCE,
      sourceEntityId: options.id ?? OFFER_CTA_SOURCE.sourceEntityId,
    },
    value,
  );
  const phone = trim(value.fallback.phone);
  const instructions = trim(value.instructions);
  const requestLabelKind = value.requestLabelKind ?? "REQUEST";

  if (canonical.actionKind === "EXTERNAL") {
    return buildEmptyLegacyFields({
      id: options.id,
      ctaType: value.externalKind === "TICKETS" ? "купить_билет" : "перейти_на_сайт",
      ctaPhone: phone,
      ctaLink: trim(value.externalUrl),
      ctaInstructions: instructions,
    });
  }

  if (canonical.actionKind === "REQUEST") {
    if (value.requestMode === "CALENDAR") {
      return buildEmptyLegacyFields({
        id: options.id,
        ctaType: "забронировать",
        ctaInstructions: instructions,
        bookingEnabled: true,
        bookingMode:
          value.calendarMode === "DATE_AND_TIME"
            ? "USE_PUBLICATION_SLOTS"
            : "USE_PUBLICATION_DATES",
        bookingPhone: phone,
        bookingNote: instructions,
      });
    }

    if (value.legacyOrigin === "BOOKING") {
      return buildEmptyLegacyFields({
        id: options.id,
        ctaType: requestLabelKind === "BOOK" ? "записаться" : "отправить_заявку",
        ctaInstructions: instructions,
        bookingEnabled: true,
        bookingMode: "REQUEST_ONLY",
        bookingPhone: phone,
        bookingNote: instructions,
      });
    }

    return buildEmptyLegacyFields({
      id: options.id,
      ctaType: requestLabelKind === "BOOK" ? "записаться" : "отправить_заявку",
      ctaPhone: phone,
      ctaInstructions: instructions,
    });
  }

  return buildEmptyLegacyFields({
    id: options.id,
    ctaInstructions: instructions,
  });
}

export function mapCtaStepValueToOfferFormPatch(
  value: CtaStepFormValue,
  options: {
    id?: string;
  } = {},
): Partial<OfferFormData> {
  const legacy = mapCtaStepValueToOfferLegacy(value, options);
  const fallbackPhone = trim(legacy.bookingPhone) || trim(legacy.ctaPhone);
  const instructions = trim(legacy.bookingNote) || trim(legacy.ctaInstructions);

  return {
    publicationAccess: buildPublicationAccessFromCtaStepValue(value),
    ctaType: legacy.ctaType,
    ctaPhone: fallbackPhone,
    ctaLink: trim(legacy.ctaLink),
    ctaInstructions: instructions,
    bookingSettings: buildBookingSettingsFromCtaStepValue(value),
  };
}
