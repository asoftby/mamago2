import { absolutePublicImageUrl } from "@/lib/seo/schema/url";

export type BuildPlaceJsonLdInput = {
  canonicalUrl: string;
  name: string;
  description?: string | null;
  image?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  website?: string | null;
  instagramUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  publicBaseUrl?: string;
};

function normalizeSameAsUrl(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const candidates = /^https?:\/\//i.test(trimmed) ? [trimmed] : [`https://${trimmed}`];

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.toString();
      }
    } catch {
      // Ignore invalid candidate and fall through.
    }
  }

  return undefined;
}

export function buildPlaceJsonLd(input: BuildPlaceJsonLdInput): Record<string, unknown> {
  const image = absolutePublicImageUrl(input.image, input.publicBaseUrl);
  const sameAs = [normalizeSameAsUrl(input.website), normalizeSameAsUrl(input.instagramUrl)].filter(
    (item, index, array): item is string => Boolean(item) && array.indexOf(item) === index,
  );
  const hasGeo = typeof input.lat === "number" && typeof input.lng === "number";

  return {
    "@context": "https://schema.org",
    "@type": "Place",
    "@id": `${input.canonicalUrl}#place`,
    url: input.canonicalUrl,
    name: input.name,
    description: input.description ?? undefined,
    image: image ? [image] : undefined,
    address: input.address ?? undefined,
    geo: hasGeo
      ? {
          "@type": "GeoCoordinates",
          latitude: input.lat,
          longitude: input.lng,
        }
      : undefined,
    telephone: input.phone ?? undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    // Google Search review snippets do not support generic schema.org Place
    // as the reviewed parent type. Ratings remain available to the UI and
    // callers, but must not be serialized into this Place JSON-LD. If a
    // future page emits an explicitly supported subtype such as
    // LocalBusiness, aggregateRating can be added in that dedicated schema.
  };
}
