export const PLACE_PHONE_LABEL_MAX_LENGTH = 40;

export interface PlacePhoneFields {
  phone?: string | null;
  phoneLabel?: string | null;
  phone2?: string | null;
  phone2Label?: string | null;
  phone3?: string | null;
  phone3Label?: string | null;
}

export interface NormalizedPlacePhone {
  value: string;
  label: string;
  href: string;
  isPrimary: boolean;
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePhoneLabel(value: string | null | undefined): string | null {
  const normalized = normalizeNullableString(value);
  if (!normalized) return null;
  return normalized.slice(0, PLACE_PHONE_LABEL_MAX_LENGTH);
}

function normalizePhoneHrefValue(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function getFallbackPhoneLabel(index: number): string {
  return index === 0 ? "Основной номер" : "Дополнительный номер";
}

export function normalizePlacePhoneFields(input: PlacePhoneFields): Required<PlacePhoneFields> {
  const phone = normalizeNullableString(input.phone);
  const phone2 = normalizeNullableString(input.phone2);
  const phone3 = normalizeNullableString(input.phone3);

  return {
    phone,
    phoneLabel: phone ? normalizePhoneLabel(input.phoneLabel) : null,
    phone2,
    phone2Label: phone2 ? normalizePhoneLabel(input.phone2Label) : null,
    phone3,
    phone3Label: phone3 ? normalizePhoneLabel(input.phone3Label) : null,
  };
}

export function getNormalizedPlacePhones(input: PlacePhoneFields): NormalizedPlacePhone[] {
  const normalized = normalizePlacePhoneFields(input);
  const rawPhones = [
    { value: normalized.phone, label: normalized.phoneLabel, isPrimary: true },
    { value: normalized.phone2, label: normalized.phone2Label, isPrimary: false },
    { value: normalized.phone3, label: normalized.phone3Label, isPrimary: false },
  ];

  const seen = new Set<string>();

  return rawPhones.flatMap((item, index) => {
    if (!item.value) {
      return [];
    }

    const normalizedHrefValue = normalizePhoneHrefValue(item.value);
    if (!normalizedHrefValue || seen.has(normalizedHrefValue)) {
      return [];
    }

    seen.add(normalizedHrefValue);

    return [
      {
        value: item.value,
        label: item.label ?? getFallbackPhoneLabel(index),
        href: `tel:${normalizedHrefValue}`,
        isPrimary: item.isPrimary,
      },
    ];
  });
}
