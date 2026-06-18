import { absolutePublicImageUrl, absolutePublicUrl } from "@/lib/seo/schema/url";

export type OfferStructuredDataType = "CAMP" | "SERVICE" | "EVENT_LIKE" | "PROMO";

export type BuildOfferStructuredDataInput = {
  canonicalUrl: string;
  publicType: OfferStructuredDataType;
  title: string;
  description?: string | null;
  image?: string | null;
  price?: number | null;
  priceText?: string | null;
  priceCurrency?: string | null;
  place?: {
    name?: string | null;
    slug?: string | null;
    address?: string | null;
    url?: string | null;
  } | null;
  publicBaseUrl?: string;
};

function buildOfferNode(input: BuildOfferStructuredDataInput, publicBaseUrl?: string) {
  const image = absolutePublicImageUrl(input.image, publicBaseUrl);
  const placeUrl = absolutePublicUrl(input.place?.url, publicBaseUrl);
  const seller =
    input.place?.name?.trim()
      ? {
          "@type": "Place",
          name: input.place.name.trim(),
          url: placeUrl,
          address: input.place.address?.trim() || undefined,
        }
      : undefined;

  return {
    "@type": "Offer",
    "@id": `${input.canonicalUrl}#offer`,
    url: input.canonicalUrl,
    name: input.title,
    description: input.description?.trim() || undefined,
    image: image ? [image] : undefined,
    price: typeof input.price === "number" ? input.price : undefined,
    priceCurrency:
      typeof input.price === "number" ? input.priceCurrency?.trim() || "BYN" : undefined,
    priceSpecification: input.priceText?.trim()
      ? {
          "@type": "PriceSpecification",
          description: input.priceText.trim(),
        }
      : undefined,
    seller,
  };
}

function buildServiceNode(input: BuildOfferStructuredDataInput) {
  const image = absolutePublicImageUrl(input.image, input.publicBaseUrl);
  const placeUrl = absolutePublicUrl(input.place?.url, input.publicBaseUrl);
  const hasOfferPayload =
    typeof input.price === "number" || Boolean(input.priceText?.trim());

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${input.canonicalUrl}#service`,
    url: input.canonicalUrl,
    name: input.title,
    description: input.description?.trim() || undefined,
    image: image ? [image] : undefined,
    provider: input.place?.name?.trim()
      ? {
          "@type": "Place",
          name: input.place.name.trim(),
          url: placeUrl,
          address: input.place.address?.trim() || undefined,
        }
      : undefined,
    offers: hasOfferPayload ? buildOfferNode(input, input.publicBaseUrl) : undefined,
  };
}

export function buildOfferStructuredData(
  input: BuildOfferStructuredDataInput,
): Record<string, unknown> {
  if (input.publicType === "CAMP" || input.publicType === "SERVICE") {
    return buildServiceNode(input);
  }

  return {
    "@context": "https://schema.org",
    ...buildOfferNode(input, input.publicBaseUrl),
  };
}
