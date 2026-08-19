import { createCanonicalCta } from "../contract";
import {
  createPhoneFallback,
  createPhoneTarget,
  createUrlTarget,
} from "../helpers";
import type { CanonicalCtaObject } from "../types";

export interface PlaceCtaLegacyInput {
  id: string;
  bookingEnabled?: boolean | null;
  bookingPhone?: string | null;
  bookingNote?: string | null;
  phone?: string | null;
  website?: string | null;
}

export const PlaceCtaAdapter = {
  toCanonical(input: PlaceCtaLegacyInput): CanonicalCtaObject {
    const bookingFallback =
      createPhoneFallback(input.bookingPhone ?? "") ??
      createPhoneFallback(input.phone ?? "");

    const phoneTarget =
      createPhoneTarget(input.bookingPhone ?? "") ??
      createPhoneTarget(input.phone ?? "");
    if (phoneTarget) {
      return createCanonicalCta({
        actionKind: "EXTERNAL",
        sourceEntityType: "PLACE",
        sourceEntityId: input.id,
        primaryLabel: "Позвонить",
        externalTarget: phoneTarget,
        contactFallback: bookingFallback ? [bookingFallback] : undefined,
        instructions: input.bookingNote ?? undefined,
      });
    }

    const websiteTarget = createUrlTarget(input.website ?? "");
    if (websiteTarget) {
      return createCanonicalCta({
        actionKind: "EXTERNAL",
        sourceEntityType: "PLACE",
        sourceEntityId: input.id,
        primaryLabel: "Перейти на сайт",
        externalTarget: websiteTarget,
        instructions: input.bookingNote ?? undefined,
      });
    }

    if (input.bookingEnabled) {
      return createCanonicalCta({
        actionKind: "DISCOVER",
        sourceEntityType: "PLACE",
        sourceEntityId: input.id,
        primaryLabel: "Подробнее",
        instructions: input.bookingNote ?? undefined,
        contactFallback: bookingFallback ? [bookingFallback] : undefined,
      });
    }

    return createCanonicalCta({
      actionKind: "DISCOVER",
      sourceEntityType: "PLACE",
      sourceEntityId: input.id,
      primaryLabel: "Подробнее",
      instructions: input.bookingNote ?? undefined,
    });
  },
};
