/**
 * MVP schema for Route:
 * Use `ItemList` (stable, widely supported) with places as list items.
 * Later can evolve to `TouristTrip` if needed.
 */
export function buildRouteJsonLd(args: {
  route: {
    slug: string;
    title: string;
    stops: Array<{
      place?: { id: string; title: string } | null;
      customTitle?: string | null;
    }>;
  };
  publicBase: string;
}): Record<string, unknown> {
  const { route, publicBase } = args;
  const url = `${publicBase}/routes/${route.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: route.title,
    url,
    itemListOrder: "http://schema.org/ItemListOrderAscending",
    numberOfItems: route.stops.length,
    itemListElement: route.stops.map((s, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: s.place?.title ?? s.customTitle ?? `Stop ${idx + 1}`,
      url: s.place?.id ? `${publicBase}/places/${s.place.id}` : undefined,
    })),
  };
}

