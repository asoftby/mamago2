import type { Place } from "@prisma/client";

export function buildPlaceJsonLd(args: {
  place: Pick<Place, "title" | "description" | "slug" | "formattedAddr" | "customAddress">;
  publicBase: string;
}): Record<string, unknown> {
  const { place, publicBase } = args;
  const url = place.slug ? `${publicBase}/places/${place.slug}` : undefined;
  const address = place.formattedAddr ?? place.customAddress ?? undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: place.title,
    description: place.description ?? undefined,
    address,
    url,
  };
}

