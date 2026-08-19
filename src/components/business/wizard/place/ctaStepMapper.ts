import {
  buildCtaStepFormValueFromCanonical,
  type CtaStepFormValue,
} from "@/components/business/wizard/shared/CtaStep";
import { PlaceCtaAdapter } from "@/lib/cta-platform";
import type { PlaceFormData } from "./types";

export interface PlaceLegacyCtaFields {
  id: string;
  bookingEnabled: boolean;
  bookingPhone: string;
  bookingNote: string;
  phone: string;
  website: string;
}

function trim(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function createEmptyLegacyFields(
  overrides: Partial<PlaceLegacyCtaFields> = {},
): PlaceLegacyCtaFields {
  return {
    id: overrides.id ?? "",
    bookingEnabled: overrides.bookingEnabled ?? false,
    bookingPhone: overrides.bookingPhone ?? "",
    bookingNote: overrides.bookingNote ?? "",
    phone: overrides.phone ?? "",
    website: overrides.website ?? "",
  };
}

export function mapPlaceLegacyCtaToStepValue(
  input: PlaceLegacyCtaFields,
): CtaStepFormValue {
  const canonical = PlaceCtaAdapter.toCanonical({
    id: input.id,
    bookingEnabled: input.bookingEnabled,
    bookingPhone: input.bookingPhone,
    bookingNote: input.bookingNote,
    phone: input.phone,
    website: input.website,
  });

  const formValue = buildCtaStepFormValueFromCanonical(canonical);
  formValue.instructions = trim(input.bookingNote);
  formValue.legacyOrigin = input.bookingEnabled ? "BOOKING" : "CTA";

  const primaryPhone = trim(input.bookingPhone) || trim(input.phone);
  const website = trim(input.website);

  if (primaryPhone) {
    formValue.actionChoice = "EXTERNAL";
    formValue.externalKind = "SITE";
    formValue.externalUrl = "";
    formValue.fallback.phone = primaryPhone;
    formValue.fallback.website = website;
    return formValue;
  }

  if (website) {
    formValue.actionChoice = "EXTERNAL";
    formValue.externalKind = "SITE";
    formValue.externalUrl = website;
    formValue.fallback.phone = "";
    formValue.fallback.website = "";
    return formValue;
  }

  formValue.actionChoice = "DISCOVER";
  formValue.externalUrl = "";
  formValue.fallback.phone = "";
  formValue.fallback.website = "";
  return formValue;
}

export function mapPlaceFormDataToCtaStepValue(
  data: PlaceFormData,
  options: {
    id?: string;
  } = {},
): CtaStepFormValue {
  return mapPlaceLegacyCtaToStepValue(
    createEmptyLegacyFields({
      id: options.id ?? data.id ?? "",
      bookingEnabled: data.bookingEnabled,
      bookingPhone: data.bookingPhone ?? "",
      bookingNote: data.bookingNote ?? "",
      phone: data.phone ?? "",
      website: data.website ?? "",
    }),
  );
}

export function mapCtaStepValueToPlaceLegacy(
  value: CtaStepFormValue,
  options: {
    id?: string;
  } = {},
): PlaceLegacyCtaFields {
  const instructions = trim(value.instructions);
  const fallbackPhone = trim(value.fallback.phone);
  const fallbackWebsite = trim(value.fallback.website);
  const externalUrl = trim(value.externalUrl);
  const isBookingOrigin = value.legacyOrigin === "BOOKING";

  if (value.actionChoice === "EXTERNAL") {
    if (!externalUrl && fallbackPhone) {
      return createEmptyLegacyFields({
        id: options.id,
        bookingEnabled: isBookingOrigin,
        bookingPhone: isBookingOrigin ? fallbackPhone : "",
        bookingNote: instructions,
        phone: isBookingOrigin ? "" : fallbackPhone,
        website: fallbackWebsite,
      });
    }

    return createEmptyLegacyFields({
      id: options.id,
      bookingEnabled: false,
      bookingPhone: "",
      bookingNote: instructions,
      phone: "",
      website: externalUrl || fallbackWebsite,
    });
  }

  if (value.actionChoice === "DISCOVER") {
    return createEmptyLegacyFields({
      id: options.id,
      bookingEnabled: isBookingOrigin,
      bookingPhone: "",
      bookingNote: instructions,
    });
  }

  return createEmptyLegacyFields({
    id: options.id,
    bookingEnabled: true,
    bookingPhone: fallbackPhone,
    bookingNote: instructions,
    website: fallbackWebsite,
  });
}

export function mapCtaStepValueToPlaceFormPatch(
  value: CtaStepFormValue,
  options: {
    id?: string;
  } = {},
): Partial<PlaceFormData> {
  const legacy = mapCtaStepValueToPlaceLegacy(value, options);

  return {
    bookingEnabled: legacy.bookingEnabled,
    bookingPhone: legacy.bookingPhone || null,
    bookingNote: legacy.bookingNote || null,
    phone: legacy.phone || null,
    website: legacy.website || null,
  };
}
