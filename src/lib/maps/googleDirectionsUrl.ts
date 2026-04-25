import type { EventPageVenue } from "@/lib/event/eventPageTypes";

function destinationFromGoogleMapsQueryUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const q = u.searchParams.get("q");
    return q?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Ссылка «построить маршрут» в Google Maps (от текущего местоположения пользователя).
 */
export function googleDirectionsUrlFromVenue(venue: EventPageVenue): string | null {
  const raw = venue.address?.trim();
  const fromMap = destinationFromGoogleMapsQueryUrl(venue.mapUrl);
  const dest = raw || fromMap;
  if (dest) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  }
  if (venue.routeUrl && /google\./i.test(venue.routeUrl)) return venue.routeUrl;
  if (venue.mapUrl && /google\./i.test(venue.mapUrl)) return venue.mapUrl;
  return null;
}
