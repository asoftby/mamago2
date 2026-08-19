import {
  buildCtaStepFormValueFromCanonical,
  type CtaStepCalendarDay,
  type CtaStepFormValue,
  createDefaultCtaStepFormValue,
} from "@/components/business/wizard/shared/CtaStep";
import type {
  PublicationAccess,
  PublicationAccessTimeSlot,
} from "@/features/publication-access";
import { EventCtaAdapter } from "@/lib/cta-platform";
import type { EventFormData } from "./types";

export type EventLegacyBookingMode =
  | "REQUEST_ONLY"
  | "USE_PUBLICATION_DATES"
  | "USE_PUBLICATION_SLOTS"
  | null;

export type EventLegacyParticipationMode =
  | "external-link"
  | "prebook"
  | "time-slots"
  | "simple-booking"
  | "request"
  | "info-only"
  | "walk-in"
  | string
  | null;

export interface EventLegacyCtaFields {
  id: string;
  participationMode: EventLegacyParticipationMode;
  ticketLink: string;
  prebookMethod: "phone" | "link" | null;
  prebookPhone: string;
  prebookUrl: string;
  timeSlots: EventFormData["timeSlots"];
  simpleBookingDate: string | null;
  simpleBookingTime: string | null;
  simpleBookingCapacity: number | null;
  bookingEnabled: boolean;
  bookingMode: EventLegacyBookingMode;
  bookingPhone: string;
  bookingNote: string;
}

function trim(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function createDefaultCalendarSlot() {
  return {
    id: `cta-slot-${Date.now()}`,
    startTime: "",
    endTime: "",
    capacity: null,
  };
}

function createDefaultCalendarDay(): CtaStepCalendarDay {
  return {
    id: `cta-day-${Date.now()}`,
    date: "",
    capacity: null,
    slots: [createDefaultCalendarSlot()],
  };
}

function createEmptyLegacyFields(
  overrides: Partial<EventLegacyCtaFields> = {},
): EventLegacyCtaFields {
  return {
    id: overrides.id ?? "",
    participationMode: overrides.participationMode ?? null,
    ticketLink: overrides.ticketLink ?? "",
    prebookMethod: overrides.prebookMethod ?? null,
    prebookPhone: overrides.prebookPhone ?? "",
    prebookUrl: overrides.prebookUrl ?? "",
    timeSlots: overrides.timeSlots ?? { dates: [] },
    simpleBookingDate: overrides.simpleBookingDate ?? null,
    simpleBookingTime: overrides.simpleBookingTime ?? null,
    simpleBookingCapacity: overrides.simpleBookingCapacity ?? null,
    bookingEnabled: overrides.bookingEnabled ?? false,
    bookingMode: overrides.bookingMode ?? null,
    bookingPhone: overrides.bookingPhone ?? "",
    bookingNote: overrides.bookingNote ?? "",
  };
}

function buildCalendarDaysFromEventTimeSlots(
  value: EventFormData["timeSlots"],
): CtaStepCalendarDay[] {
  if (!value.dates.length) return [createDefaultCalendarDay()];

  return value.dates.map((date) => {
    const slots =
      date.slots.length > 0
        ? date.slots.map((slot) => ({
            id: slot.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            capacity: slot.capacity ?? null,
          }))
        : [createDefaultCalendarSlot()];

    return {
      id: date.id,
      date: date.isoDate,
      capacity:
        date.slots.length === 1 &&
        !trim(date.slots[0]?.startTime) &&
        !trim(date.slots[0]?.endTime)
          ? (date.slots[0]?.capacity ?? null)
          : null,
      slots,
    };
  });
}

function buildEventTimeSlotsFromPublicationAccess(
  timeSlots: PublicationAccessTimeSlot[] | undefined,
): EventFormData["timeSlots"] {
  const byDate = new Map<
    string,
    EventFormData["timeSlots"]["dates"][number]
  >();

  for (const slot of timeSlots ?? []) {
    if (!slot.date) continue;
    const existing = byDate.get(slot.date);
    const slotRecord = {
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime ?? slot.startTime,
      capacity: slot.capacity ?? 1,
    };

    if (existing) {
      existing.slots.push(slotRecord);
      continue;
    }

    byDate.set(slot.date, {
      id: `date-${slot.date}`,
      isoDate: slot.date,
      label: slot.date,
      slots: [slotRecord],
    });
  }

  return {
    dates: Array.from(byDate.values()).sort((a, b) =>
      a.isoDate.localeCompare(b.isoDate),
    ),
  };
}

function buildLegacyTimeSlotsFromCtaStep(
  value: CtaStepFormValue,
): EventFormData["timeSlots"] {
  if (value.requestMode !== "CALENDAR") {
    return { dates: [] };
  }

  const dates = value.calendarDays
    .filter((day) => trim(day.date))
    .map((day) => {
      const slots =
        value.calendarMode === "DATE_AND_TIME"
          ? day.slots
              .filter((slot) => trim(slot.startTime))
              .map((slot) => ({
                id: slot.id,
                startTime: trim(slot.startTime),
                endTime: trim(slot.endTime) || trim(slot.startTime),
                capacity: slot.capacity ?? 1,
              }))
        : [
              {
                id: `${day.id}-date-only`,
                startTime: "",
                endTime: "",
                capacity: day.capacity ?? 1,
              },
            ];

      return {
        id: day.id,
        isoDate: trim(day.date),
        label: trim(day.date),
        slots,
      };
    });

  return { dates };
}

function resolveRequestCompatibilityMode(
  value: CtaStepFormValue,
): Pick<
  EventLegacyCtaFields,
  | "participationMode"
  | "prebookMethod"
  | "prebookPhone"
  | "prebookUrl"
  | "bookingEnabled"
  | "bookingMode"
  | "bookingPhone"
  | "timeSlots"
  | "simpleBookingDate"
  | "simpleBookingTime"
  | "simpleBookingCapacity"
> {
  const phone = trim(value.fallback.phone);
  const website = trim(value.fallback.website);

  if (value.requestMode === "CALENDAR") {
    if (value.legacyOrigin === "BOOKING") {
      return {
        participationMode: null,
        prebookMethod: null,
        prebookPhone: "",
        prebookUrl: "",
        bookingEnabled: true,
        bookingMode:
          value.calendarMode === "DATE_AND_TIME"
            ? "USE_PUBLICATION_SLOTS"
            : "USE_PUBLICATION_DATES",
        bookingPhone: phone,
        timeSlots: buildLegacyTimeSlotsFromCtaStep(value),
        simpleBookingDate: null,
        simpleBookingTime: null,
        simpleBookingCapacity: null,
      };
    }

    return {
      participationMode: "time-slots",
      prebookMethod: null,
      prebookPhone: "",
      prebookUrl: "",
      bookingEnabled: false,
      bookingMode: null,
      bookingPhone: phone,
      timeSlots: buildLegacyTimeSlotsFromCtaStep(value),
      simpleBookingDate: null,
      simpleBookingTime: null,
      simpleBookingCapacity: null,
    };
  }

  if (value.legacyOrigin === "BOOKING") {
    if (value.requestLabelKind === "BOOK") {
      return {
        participationMode: "prebook",
        prebookMethod: website ? "link" : "phone",
        prebookPhone: phone,
        prebookUrl: website,
        bookingEnabled: false,
        bookingMode: null,
        bookingPhone: phone,
        timeSlots: { dates: [] },
        simpleBookingDate: null,
        simpleBookingTime: null,
        simpleBookingCapacity: null,
      };
    }

    return {
      participationMode: null,
      prebookMethod: null,
      prebookPhone: "",
      prebookUrl: "",
      bookingEnabled: true,
      bookingMode: "REQUEST_ONLY",
      bookingPhone: phone,
      timeSlots: { dates: [] },
      simpleBookingDate: null,
      simpleBookingTime: null,
      simpleBookingCapacity: null,
    };
  }

  if (value.requestLabelKind === "REQUEST") {
    return {
      participationMode: "request",
      prebookMethod: null,
      prebookPhone: "",
      prebookUrl: "",
      bookingEnabled: false,
      bookingMode: null,
      bookingPhone: phone,
      timeSlots: { dates: [] },
      simpleBookingDate: null,
      simpleBookingTime: null,
      simpleBookingCapacity: null,
    };
  }

  const firstDay = value.calendarDays.find((day) => trim(day.date));
  const firstSlot = firstDay?.slots.find((slot) => trim(slot.startTime));

  return {
    participationMode: "simple-booking",
    prebookMethod: null,
    prebookPhone: "",
    prebookUrl: "",
    bookingEnabled: false,
    bookingMode: null,
    bookingPhone: phone,
    timeSlots: { dates: [] },
    simpleBookingDate: trim(firstDay?.date) || null,
    simpleBookingTime: firstSlot
      ? `${trim(firstSlot.startTime)}-${trim(firstSlot.endTime) || trim(firstSlot.startTime)}`
      : null,
    simpleBookingCapacity: firstSlot?.capacity ?? firstDay?.capacity ?? null,
  };
}

function resolveDiscoverCompatibilityMode(
  value: CtaStepFormValue,
): EventLegacyParticipationMode {
  if (value.legacyOrigin === "BOOKING") return "request";
  if (value.requestLabelKind === "REQUEST") return "info-only";
  return "walk-in";
}

function buildPublicationAccessFromCtaStepValue(
  value: CtaStepFormValue,
): PublicationAccess {
  const instructions = trim(value.instructions) || undefined;
  const phone = trim(value.fallback.phone) || undefined;
  const website = trim(value.fallback.website) || undefined;

  if (value.actionChoice === "EXTERNAL") {
    if (value.externalKind === "TICKETS") {
      return {
        method: "ticket",
        ticketUrl: trim(value.externalUrl) || undefined,
        externalUrl: website,
        phone,
        instructions,
      };
    }

    return {
      method: "external",
      externalUrl: trim(value.externalUrl) || undefined,
      ticketUrl: website,
      phone,
      instructions,
    };
  }

  if (value.actionChoice === "REQUEST") {
    if (value.requestMode === "CALENDAR") {
      const timeSlots = value.calendarDays.flatMap((day) => {
        const date = trim(day.date);
        if (!date) return [];

        if (value.calendarMode === "DATE_AND_TIME") {
          return day.slots
            .filter((slot) => trim(slot.startTime))
            .map((slot) => ({
              id: slot.id,
              date,
              startTime: trim(slot.startTime),
              endTime: trim(slot.endTime) || undefined,
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
        phone,
        externalUrl: website,
        instructions,
      };
    }

    if (value.requestLabelKind === "BOOK") {
      return {
        method: "prebooking",
        phone,
        externalUrl: website,
        instructions,
      };
    }

    return {
      method: "contact",
      phone,
      externalUrl: website,
      instructions,
    };
  }

  return {
    method: "details",
    phone,
    externalUrl: website,
    instructions,
  };
}

function mapPublicationAccessToStepValue(access: PublicationAccess): CtaStepFormValue {
  const formValue = createDefaultCtaStepFormValue();
  formValue.instructions = trim(access.instructions);
  formValue.fallback.phone = trim(access.phone);

  switch (access.method) {
    case "ticket":
      formValue.actionChoice = "EXTERNAL";
      formValue.externalKind = "TICKETS";
      formValue.externalUrl = trim(access.ticketUrl);
      formValue.fallback.website = trim(access.externalUrl);
      formValue.legacyOrigin = "CTA";
      return formValue;
    case "external":
      formValue.actionChoice = "EXTERNAL";
      formValue.externalKind = "SITE";
      formValue.externalUrl = trim(access.externalUrl);
      formValue.fallback.website = trim(access.ticketUrl);
      formValue.legacyOrigin = "CTA";
      return formValue;
    case "contact":
      formValue.actionChoice = "REQUEST";
      formValue.requestMode = "SIMPLE";
      formValue.requestLabelKind = "REQUEST";
      formValue.fallback.website = trim(access.externalUrl);
      formValue.legacyOrigin = "CTA";
      return formValue;
    case "timeslots": {
      const timeSlots = buildEventTimeSlotsFromPublicationAccess(access.timeSlots);
      formValue.actionChoice = "REQUEST";
      formValue.requestMode = "CALENDAR";
      formValue.calendarMode = (access.timeSlots ?? []).some((slot) => trim(slot.startTime))
        ? "DATE_AND_TIME"
        : "DATE_ONLY";
      formValue.calendarDays = buildCalendarDaysFromEventTimeSlots(timeSlots);
      formValue.fallback.website = trim(access.externalUrl);
      formValue.legacyOrigin = "CTA";
      return formValue;
    }
    case "prebooking":
      formValue.actionChoice = "REQUEST";
      formValue.requestMode = "SIMPLE";
      formValue.requestLabelKind = "BOOK";
      formValue.fallback.website = trim(access.externalUrl);
      formValue.legacyOrigin = "BOOKING";
      return formValue;
    case "details":
    default:
      formValue.actionChoice = "DISCOVER";
      formValue.fallback.website = trim(access.externalUrl);
      formValue.legacyOrigin = "CTA";
      return formValue;
  }
}

export function mapEventLegacyCtaToStepValue(
  input: EventLegacyCtaFields,
): CtaStepFormValue {
  const canonical = EventCtaAdapter.toCanonical({
    id: input.id,
    participationMode: input.participationMode,
    ticketLink: input.ticketLink,
    prebookMethod: input.prebookMethod,
    prebookPhone: input.prebookPhone,
    prebookUrl: input.prebookUrl,
    bookingEnabled: input.bookingEnabled,
    bookingMode: input.bookingMode,
    bookingPhone: input.bookingPhone,
    bookingNote: input.bookingNote,
  });

  const formValue = buildCtaStepFormValueFromCanonical(canonical);
  formValue.instructions = trim(input.bookingNote);

  switch (input.participationMode) {
    case "external-link":
      formValue.actionChoice = "EXTERNAL";
      formValue.externalKind = "TICKETS";
      formValue.externalUrl = trim(input.ticketLink);
      formValue.legacyOrigin = "CTA";
      break;
    case "prebook":
      formValue.actionChoice = "REQUEST";
      formValue.requestMode = "SIMPLE";
      formValue.requestLabelKind = "BOOK";
      formValue.legacyOrigin = "BOOKING";
      formValue.fallback.phone = trim(input.prebookPhone || input.bookingPhone);
      formValue.fallback.website =
        input.prebookMethod === "link" ? trim(input.prebookUrl) : "";
      break;
    case "time-slots":
      formValue.actionChoice = "REQUEST";
      formValue.requestMode = "CALENDAR";
      formValue.calendarMode = "DATE_AND_TIME";
      formValue.legacyOrigin = "CTA";
      formValue.calendarDays = buildCalendarDaysFromEventTimeSlots(input.timeSlots);
      formValue.fallback.phone = trim(input.bookingPhone);
      break;
    case "simple-booking":
      formValue.actionChoice = "REQUEST";
      formValue.requestMode = "SIMPLE";
      formValue.requestLabelKind = "BOOK";
      formValue.legacyOrigin = "CTA";
      formValue.fallback.phone = trim(input.bookingPhone);
      break;
    case "request":
      formValue.actionChoice = "DISCOVER";
      formValue.legacyOrigin = "BOOKING";
      formValue.requestLabelKind = "REQUEST";
      formValue.fallback.phone = trim(input.bookingPhone);
      break;
    case "info-only":
      formValue.actionChoice = "DISCOVER";
      formValue.legacyOrigin = "CTA";
      formValue.requestLabelKind = "REQUEST";
      formValue.fallback.phone = trim(input.bookingPhone);
      break;
    case "walk-in":
      formValue.actionChoice = "DISCOVER";
      formValue.legacyOrigin = "CTA";
      formValue.requestLabelKind = "BOOK";
      formValue.fallback.phone = trim(input.bookingPhone);
      break;
    default:
      if (input.bookingEnabled) {
        formValue.legacyOrigin = "BOOKING";
        formValue.fallback.phone = trim(input.bookingPhone);
        if (input.bookingMode === "REQUEST_ONLY") {
          formValue.actionChoice = "REQUEST";
          formValue.requestMode = "SIMPLE";
          formValue.requestLabelKind = "REQUEST";
        }
        if (input.bookingMode === "USE_PUBLICATION_DATES") {
          formValue.actionChoice = "REQUEST";
          formValue.requestMode = "CALENDAR";
          formValue.calendarMode = "DATE_ONLY";
          formValue.calendarDays = buildCalendarDaysFromEventTimeSlots(input.timeSlots);
        }
        if (input.bookingMode === "USE_PUBLICATION_SLOTS") {
          formValue.actionChoice = "REQUEST";
          formValue.requestMode = "CALENDAR";
          formValue.calendarMode = "DATE_AND_TIME";
          formValue.calendarDays = buildCalendarDaysFromEventTimeSlots(input.timeSlots);
        }
      }
      break;
  }

  return formValue;
}

export function mapEventFormDataToCtaStepValue(
  data: EventFormData,
  options: {
    id?: string;
  } = {},
): CtaStepFormValue {
  if (data.ctaStepDraft) {
    return data.ctaStepDraft;
  }

  if (data.publicationAccess) {
    return mapPublicationAccessToStepValue(data.publicationAccess);
  }

  return mapEventLegacyCtaToStepValue(
    createEmptyLegacyFields({
      id: options.id ?? "",
      participationMode: data.participationMode,
      ticketLink: data.ticketLink,
      prebookMethod: data.prebookMethod,
      prebookPhone: data.prebookPhone,
      prebookUrl: data.prebookUrl,
      timeSlots: data.timeSlots,
      simpleBookingDate: data.simpleBookingDate,
      simpleBookingTime: data.simpleBookingTime,
      simpleBookingCapacity: data.simpleBookingCapacity,
      bookingPhone: data.prebookPhone,
    }),
  );
}

export function mapCtaStepValueToEventLegacy(
  value: CtaStepFormValue,
  options: {
    id?: string;
  } = {},
): EventLegacyCtaFields {
  const instructions = trim(value.instructions);
  const base = createEmptyLegacyFields({
    id: options.id ?? "",
    bookingNote: instructions,
  });

  if (value.actionChoice === "DISCOVER") {
    return {
      ...base,
      participationMode: resolveDiscoverCompatibilityMode(value),
      bookingPhone: trim(value.fallback.phone),
    };
  }

  if (value.actionChoice === "EXTERNAL") {
    if (value.legacyOrigin === "BOOKING") {
      return {
        ...base,
        participationMode: "prebook",
        prebookMethod: "link",
        prebookUrl: trim(value.externalUrl),
        bookingPhone: trim(value.fallback.phone),
      };
    }

    return {
      ...base,
      participationMode: "external-link",
      ticketLink: trim(value.externalUrl),
      bookingPhone: trim(value.fallback.phone),
    };
  }

  return {
    ...base,
    ...resolveRequestCompatibilityMode(value),
    bookingNote: instructions,
  };
}

export function mapCtaStepValueToEventFormPatch(
  value: CtaStepFormValue,
  options: {
    id?: string;
  } = {},
): Partial<EventFormData> {
  const legacy = mapCtaStepValueToEventLegacy(value, options);
  const participationMode =
    legacy.participationMode === "external-link" ||
    legacy.participationMode === "time-slots" ||
    legacy.participationMode === "prebook"
      ? legacy.participationMode
      : "walk-in";

  return {
    publicationAccess: buildPublicationAccessFromCtaStepValue(value),
    ctaStepDraft: value,
    participationMode,
    ticketLink: trim(legacy.ticketLink),
    prebookMethod: legacy.prebookMethod,
    prebookPhone: trim(legacy.prebookPhone),
    prebookUrl: trim(legacy.prebookUrl),
    timeSlots: legacy.timeSlots,
    simpleBookingDate: legacy.simpleBookingDate,
    simpleBookingTime: legacy.simpleBookingTime,
    simpleBookingCapacity: legacy.simpleBookingCapacity,
  };
}
