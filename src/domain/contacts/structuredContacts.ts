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

  const latitude = source.latitude;
  const longitude = source.longitude;

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
