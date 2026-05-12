import type { Offer, Place } from "@prisma/client";
import { getOfferPublicSection } from "@/lib/offers/offerPublicUrl";

export function buildOfferJsonLd(args: {
  offer: {
    title: string;
    description: string | null;
    slug: string | null;
    priceFrom: number | null;
    priceText: string | null;
    coverImage: string | null;
    kind: string;
    durationType?: string | null;
    campProgramType?: string | null;
  };
  place?: {
    title: string;
    slug: string | null;
    city?: any;
  } | null;
  citySlug?: string;
  publicBase: string;
}): Record<string, unknown> {
  const { offer, place, citySlug, publicBase } = args;
  
  const effectiveCitySlug = citySlug || place?.city?.slug || "minsk";
  const section = getOfferPublicSection(offer as any);
  const url = offer.slug ? `${publicBase}/${effectiveCitySlug}/offers/${section}/${offer.slug}` : undefined;
  const image = offer.coverImage ?? undefined;

  const seller = place?.title
    ? {
        "@type": "Organization",
        name: place.title,
        url: place.slug ? `${publicBase}/places/${place.slug}` : undefined,
      }
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: offer.title,
    description: offer.description ?? undefined,
    url,
    image: image ? [image] : undefined,
    price: offer.priceFrom ?? undefined,
    priceCurrency: "BYN",
    priceSpecification: offer.priceText
      ? {
          "@type": "PriceSpecification",
          description: offer.priceText,
        }
      : undefined,
    seller,
  };
}

