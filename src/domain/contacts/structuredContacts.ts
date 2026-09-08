import { z } from "zod";

const optionalText = z.string().trim().min(1).optional();
const optionalUrl = z.string().trim().url().optional();

export const CONTACT_SOCIAL_KINDS = [
  "instagram",
  "telegram",
  "vk",
  "tiktok",
  "youtube",
  "other",
] as const;

export const StructuredContactPhoneSchema = z.object({
  value: z.string().trim().min(1),
  label: optionalText,
});

export const StructuredSocialLinkSchema = z.object({
  kind: z.enum(CONTACT_SOCIAL_KINDS),
  url: z.string().trim().url(),
});

export const SharedContactsDataSchema = z.object({
  address: optionalText,
  phones: z.array(StructuredContactPhoneSchema).default([]),
  email: z.string().trim().email().optional(),
  website: optionalUrl,
  socials: z.array(StructuredSocialLinkSchema).default([]),
  coordinates: z
    .object({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
    })
    .optional(),
  mapUrl: optionalUrl,
});

export type SharedContactsData = z.infer<typeof SharedContactsDataSchema>;

export type PlaceContactsSource = {
  address?: string | null;
  phone?: string | null;
  phoneLabel?: string | null;
  phone2?: string | null;
  phone2Label?: string | null;
  phone3?: string | null;
  phone3Label?: string | null;
  website?: string | null;
  instagramUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  mapUrl?: string | null;
};

function clean(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function normalizeSharedContactsData(input: unknown): SharedContactsData {
  const parsed = SharedContactsDataSchema.parse(input);
  const seenPhones = new Set<string>();
  const seenLinks = new Set<string>();

  return {
    ...parsed,
    phones: parsed.phones.filter((phone) => {
      if (seenPhones.has(phone.value)) return false;
      seenPhones.add(phone.value);
      return true;
    }),
    socials: parsed.socials.filter((social) => {
      if (seenLinks.has(social.url)) return false;
      seenLinks.add(social.url);
      return true;
    }),
  };
}

export function contactsFromPlace(source: PlaceContactsSource): SharedContactsData {
  const phones = [
    { value: clean(source.phone), label: clean(source.phoneLabel) },
    { value: clean(source.phone2), label: clean(source.phone2Label) },
    { value: clean(source.phone3), label: clean(source.phone3Label) },
  ].flatMap((phone) => (phone.value ? [{ value: phone.value, label: phone.label }] : []));

  const latitude = typeof source.lat === "number" ? source.lat : source.latitude;
  const longitude = typeof source.lng === "number" ? source.lng : source.longitude;

  return normalizeSharedContactsData({
    address: clean(source.address),
    phones,
    website: clean(source.website),
    socials: clean(source.instagramUrl)
      ? [{ kind: "instagram", url: clean(source.instagramUrl) }]
      : [],
    coordinates:
      typeof latitude === "number" && typeof longitude === "number"
        ? { latitude, longitude }
        : undefined,
    mapUrl: clean(source.mapUrl),
  });
}

type GoogleAddressComponent = { long_name: string; short_name: string; types: string[] };

function findAddressComponent(components: GoogleAddressComponent[], types: string[]): string | undefined {
  for (const type of types) {
    const match = components.find((component) => component.types.includes(type));
    if (match?.long_name) return match.long_name;
  }
  return undefined;
}

/**
 * Builds "г.Город, ул.Улица, Дом" from Google Places `address_components`
 * (matched by `types`, not by splitting Google's own `formatted_address`
 * string — that string's punctuation/order varies by place type and
 * locale, while `locality`/`route`/`street_number` are stable). Falls back
 * to `fallback` (normally Google's formatted_address) whenever there isn't
 * even a locality to anchor on, so this never produces a worse result than
 * just using the raw address.
 */
export function formatAddressFromGoogleComponents(components: GoogleAddressComponent[], fallback: string): string {
  const city = findAddressComponent(components, ["locality", "sublocality", "sublocality_level_1"]);
  if (!city) return fallback;
  const street = findAddressComponent(components, ["route"]);
  const houseNumber = findAddressComponent(components, ["street_number"]);
  const parts = [`г.${city}`];
  if (street) parts.push(houseNumber ? `ул.${street}, ${houseNumber}` : `ул.${street}`);
  return parts.join(", ");
}
