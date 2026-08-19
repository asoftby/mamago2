import { createCanonicalCta } from "../contract";
import {
  createPhoneFallback,
  createPhoneTarget,
  createUrlTarget,
} from "../helpers";
import type { CanonicalCtaObject, CanonicalCtaSeed } from "../types";

export interface OfferCtaLegacyInput {
  id: string;
  ctaType?:
    | "записаться"
    | "забронировать"
    | "купить_билет"
    | "отправить_заявку"
    | "перейти_на_сайт"
    | string
    | null;
  ctaPhone?: string | null;
  ctaLink?: string | null;
  ctaInstructions?: string | null;
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

function fromBookingSettings(input: OfferCtaLegacyInput): CanonicalCtaSeed | null {
  if (!input.bookingEnabled) return null;

  const contactFallback =
    createPhoneFallback(input.bookingPhone ?? "") ??
    createPhoneFallback(input.ctaPhone ?? "");
  const selectionMode =
    input.bookingMode === "USE_PUBLICATION_SLOTS"
      ? "SLOT"
      : input.bookingMode === "USE_PUBLICATION_DATES"
        ? "DATE"
        : "NONE";

  return {
    actionKind: "REQUEST",
    sourceEntityType: "OFFER",
    sourceEntityId: input.id,
    primaryLabel:
      input.bookingMode === "REQUEST_ONLY" ? "Записаться" : "Забронировать",
    requestConfig: {
      runtime: "BOOKING",
      selectionMode,
    },
    instructions: input.bookingNote ?? input.ctaInstructions ?? undefined,
    contactFallback: contactFallback ? [contactFallback] : undefined,
  };
}

function fromCtaType(input: OfferCtaLegacyInput): CanonicalCtaSeed {
  const urlTarget = createUrlTarget(input.ctaLink ?? "");
  const phoneTarget = createPhoneTarget(input.ctaPhone ?? "");
  const phoneFallback = createPhoneFallback(input.ctaPhone ?? "");

  switch (input.ctaType) {
    case "купить_билет":
      return {
        actionKind: "EXTERNAL",
        sourceEntityType: "OFFER",
        sourceEntityId: input.id,
        primaryLabel: "Купить билет",
        externalTarget: urlTarget,
        availability: urlTarget ? "AVAILABLE" : "UNAVAILABLE",
        availabilityReason: urlTarget ? undefined : "Missing external ticket target",
      };
    case "перейти_на_сайт":
      return {
        actionKind: "EXTERNAL",
        sourceEntityType: "OFFER",
        sourceEntityId: input.id,
        primaryLabel: "Перейти на сайт",
        externalTarget: urlTarget,
        instructions: input.ctaInstructions ?? undefined,
        availability: urlTarget ? "AVAILABLE" : "UNAVAILABLE",
        availabilityReason: urlTarget ? undefined : "Missing external target",
      };
    case "записаться":
      if (!phoneTarget && !urlTarget) {
        return {
          actionKind: "REQUEST",
          sourceEntityType: "OFFER",
          sourceEntityId: input.id,
          primaryLabel: "Записаться",
          requestConfig: {
            runtime: "BOOKING",
            selectionMode: "NONE",
          },
          instructions: input.bookingNote ?? input.ctaInstructions ?? undefined,
          contactFallback: phoneFallback ? [phoneFallback] : undefined,
        };
      }
      return {
        actionKind: "EXTERNAL",
        sourceEntityType: "OFFER",
        sourceEntityId: input.id,
        primaryLabel: "Записаться",
        externalTarget: phoneTarget ?? urlTarget,
        contactFallback: phoneFallback ? [phoneFallback] : undefined,
        instructions: input.ctaInstructions ?? undefined,
        availability: phoneTarget || urlTarget ? "AVAILABLE" : "UNAVAILABLE",
        availabilityReason:
          phoneTarget || urlTarget ? undefined : "Missing registration target",
      };
    case "отправить_заявку":
      if (!phoneTarget && !urlTarget) {
        return {
          actionKind: "REQUEST",
          sourceEntityType: "OFFER",
          sourceEntityId: input.id,
          primaryLabel: "Оставить заявку",
          requestConfig: {
            runtime: "BOOKING",
            selectionMode: "NONE",
          },
          instructions: input.bookingNote ?? input.ctaInstructions ?? undefined,
          contactFallback: phoneFallback ? [phoneFallback] : undefined,
        };
      }
      return {
        actionKind: "EXTERNAL",
        sourceEntityType: "OFFER",
        sourceEntityId: input.id,
        primaryLabel: "Оставить заявку",
        externalTarget: urlTarget ?? phoneTarget,
        contactFallback: phoneFallback ? [phoneFallback] : undefined,
        instructions: input.ctaInstructions ?? undefined,
        availability: phoneTarget || urlTarget ? "AVAILABLE" : "UNAVAILABLE",
        availabilityReason:
          phoneTarget || urlTarget ? undefined : "Missing request target",
      };
    case "забронировать":
      return {
        actionKind: "REQUEST",
        sourceEntityType: "OFFER",
        sourceEntityId: input.id,
        primaryLabel: "Забронировать",
        requestConfig: {
          runtime: "BOOKING",
          selectionMode: "NONE",
        },
        instructions: input.bookingNote ?? input.ctaInstructions ?? undefined,
        contactFallback: phoneFallback ? [phoneFallback] : undefined,
      };
    default:
      if (phoneTarget) {
        return {
          actionKind: "EXTERNAL",
          sourceEntityType: "OFFER",
          sourceEntityId: input.id,
          primaryLabel: "Позвонить",
          externalTarget: phoneTarget,
          contactFallback: phoneFallback ? [phoneFallback] : undefined,
          instructions: input.ctaInstructions ?? undefined,
        };
      }
      if (urlTarget) {
        return {
          actionKind: "EXTERNAL",
          sourceEntityType: "OFFER",
          sourceEntityId: input.id,
          primaryLabel: "Перейти",
          externalTarget: urlTarget,
          instructions: input.ctaInstructions ?? undefined,
        };
      }
      return {
        actionKind: "DISCOVER",
        sourceEntityType: "OFFER",
        sourceEntityId: input.id,
        primaryLabel: "Подробнее",
        instructions: input.ctaInstructions ?? input.bookingNote ?? undefined,
      };
  }
}

export const OfferCtaAdapter = {
  toCanonical(input: OfferCtaLegacyInput): CanonicalCtaObject {
    return createCanonicalCta(
      fromBookingSettings(input) ?? fromCtaType(input),
    );
  },
};
