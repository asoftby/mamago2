import type { Offer, Place } from "@prisma/client";

export function buildOfferJsonLd(args: {
  offer: Pick<Offer, "title" | "description" | "slug" | "priceFrom" | "priceText" | "coverImage">;
  place?: Pick<Place, "title" | "slug"> | null;
  publicBase: string;
}): Record<string, unknown> {
  const { offer, place, publicBase } = args;
  const url = offer.slug ? `${publicBase}/offers/${offer.slug}` : undefined;
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

