import { getOfferPublicSection } from "@/lib/offers/offerPublicUrl";
import {
  buildOfferStructuredData,
  type OfferStructuredDataType,
} from "@/lib/seo/schema/buildOfferStructuredData";

export type OfferJsonLdOffer = {
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

export type OfferJsonLdPlace = {
  title: string;
  slug: string | null;
  address?: string | null;
  city?: { slug: string } | null;
} | null;

export function resolveOfferStructuredDataType(offer: {
  kind: string;
  campProgramType?: string | null;
}): OfferStructuredDataType {
  if (offer.campProgramType) return "CAMP";
  if (offer.kind === "SERVICE") return "SERVICE";
  if (offer.kind === "EVENT") return "EVENT_LIKE";
  return "PROMO";
}

export function buildOfferJsonLd(args: {
  offer: OfferJsonLdOffer;
  place?: OfferJsonLdPlace;
  citySlug?: string;
  publicBase: string;
}): Record<string, unknown> {
  const { offer, place, citySlug, publicBase } = args;

  const effectiveCitySlug = citySlug || place?.city?.slug || "minsk";
  const section = getOfferPublicSection(offer);
  const canonicalUrl = offer.slug
    ? `${publicBase}/${effectiveCitySlug}/offers/${section}/${offer.slug}`
    : `${publicBase}/${effectiveCitySlug}/offers/${section}`;

  return buildOfferStructuredData({
    canonicalUrl,
    publicType: resolveOfferStructuredDataType(offer),
    title: offer.title,
    description: offer.description,
    image: offer.coverImage,
    price: offer.priceFrom,
    priceText: offer.priceText,
    priceCurrency: "BYN",
    place: place
      ? {
          name: place.title,
          slug: place.slug,
          address: place.address,
          url: place.slug ? `/places/${place.slug}` : undefined,
        }
      : null,
    publicBaseUrl: publicBase,
  });
}
