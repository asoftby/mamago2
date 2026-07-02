import { createCanonicalCta } from "../contract";
import { createPhoneFallback, createPhoneTarget, createUrlTarget } from "../helpers";
import type { CanonicalCtaObject, CanonicalCtaSeed } from "../types";

export interface EventCtaLegacyInput {
  id: string;
  participationMode?:
    | "external-link"
    | "prebook"
    | "time-slots"
    | "simple-booking"
    | "request"
    | "info-only"
    | "walk-in"
    | string
    | null;
  ticketLink?: string | null;
  prebookMethod?: "phone" | "link" | string | null;
  prebookPhone?: string | null;
  prebookUrl?: string | null;
  bookingEnabled?: boolean | null;
  bookingMode?:
    | "REQUEST_ONLY"
    | "USE_PUBLICATION_DATES"
    | "USE_PUBLICATION_SLOTS"
    | string
    | null;
  bookingPhone?: string | null;
  bookingNote?: string | null;
}

function fromParticipationMode(input: EventCtaLegacyInput): CanonicalCtaSeed | null {
  const mode = input.participationMode;
  if (!mode) return null;

  if (mode === "external-link") {
    const externalTarget = createUrlTarget(input.ticketLink ?? "");
      return {
      actionKind: "EXTERNAL",
      sourceEntityType: "EVENT",
      sourceEntityId: input.id,
      primaryLabel: "Купить билет",
      externalTarget,
      availability: externalTarget ? "AVAILABLE" : "UNAVAILABLE",
      availabilityReason: externalTarget ? undefined : "Missing ticket link",
    };
  }

  if (mode === "prebook") {
    const externalTarget =
      input.prebookMethod === "link"
        ? createUrlTarget(input.prebookUrl ?? "")
        : createPhoneTarget(input.prebookPhone ?? input.bookingPhone ?? "");
    const contactFallback =
      createPhoneFallback(input.prebookPhone ?? "") ??
      createPhoneFallback(input.bookingPhone ?? "");
      return {
      actionKind: "EXTERNAL",
      sourceEntityType: "EVENT",
      sourceEntityId: input.id,
      primaryLabel: "Записаться",
      externalTarget,
      contactFallback: contactFallback ? [contactFallback] : undefined,
      instructions: input.bookingNote ?? undefined,
      availability: externalTarget ? "AVAILABLE" : "UNAVAILABLE",
      availabilityReason: externalTarget ? undefined : "Missing prebook target",
    };
  }

  if (mode === "time-slots") {
      return {
      actionKind: "REQUEST",
      sourceEntityType: "EVENT",
      sourceEntityId: input.id,
      primaryLabel: "Выбрать время",
      requestConfig: {
        runtime: "BOOKING",
        selectionMode: "SLOT",
      },
      instructions: input.bookingNote ?? undefined,
      contactFallback: createPhoneFallback(input.bookingPhone ?? "")
        ? [createPhoneFallback(input.bookingPhone ?? "")!]
        : undefined,
    };
  }

  if (mode === "simple-booking") {
      return {
      actionKind: "REQUEST",
      sourceEntityType: "EVENT",
      sourceEntityId: input.id,
      primaryLabel: "Записаться",
      requestConfig: {
        runtime: "BOOKING",
        selectionMode: "NONE",
      },
      instructions: input.bookingNote ?? undefined,
      contactFallback: createPhoneFallback(input.bookingPhone ?? "")
        ? [createPhoneFallback(input.bookingPhone ?? "")!]
        : undefined,
    };
  }

  if (mode === "request" || mode === "info-only" || mode === "walk-in") {
      return {
      actionKind: "DISCOVER",
      sourceEntityType: "EVENT",
      sourceEntityId: input.id,
      primaryLabel: "Подробнее",
      instructions: input.bookingNote ?? undefined,
      contactFallback: createPhoneFallback(input.bookingPhone ?? "")
        ? [createPhoneFallback(input.bookingPhone ?? "")!]
        : undefined,
    };
  }

  return null;
}

function fromBookingSettings(input: EventCtaLegacyInput): CanonicalCtaSeed {
  const contactFallback = createPhoneFallback(input.bookingPhone ?? "");

  if (input.bookingEnabled) {
    const selectionMode =
      input.bookingMode === "USE_PUBLICATION_SLOTS"
        ? "SLOT"
        : input.bookingMode === "USE_PUBLICATION_DATES"
          ? "DATE"
          : "NONE";
    return {
      actionKind: "REQUEST",
      sourceEntityType: "EVENT",
      sourceEntityId: input.id,
      primaryLabel:
        selectionMode === "SLOT"
          ? "Выбрать время"
          : selectionMode === "DATE"
            ? "Выбрать дату"
            : "Оставить заявку",
      requestConfig: {
        runtime: "BOOKING",
        selectionMode,
      },
      instructions: input.bookingNote ?? undefined,
      contactFallback: contactFallback ? [contactFallback] : undefined,
    };
  }

  const externalTarget = createPhoneTarget(input.bookingPhone ?? "");
  if (externalTarget) {
    return {
      actionKind: "EXTERNAL",
      sourceEntityType: "EVENT",
      sourceEntityId: input.id,
      primaryLabel: "Позвонить",
      externalTarget,
      contactFallback: contactFallback ? [contactFallback] : undefined,
      instructions: input.bookingNote ?? undefined,
    };
  }

  return {
    actionKind: "DISCOVER",
    sourceEntityType: "EVENT",
    sourceEntityId: input.id,
    primaryLabel: "Подробнее",
    instructions: input.bookingNote ?? undefined,
  };
}

export const EventCtaAdapter = {
  toCanonical(input: EventCtaLegacyInput): CanonicalCtaObject {
    return createCanonicalCta(
      fromParticipationMode(input) ?? fromBookingSettings(input),
    );
  },
};
