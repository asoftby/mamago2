import type { ActivityForEventPageInput } from "@/lib/event/buildEventPageDataFromPrisma";

export function buildEventJsonLd(args: {
  activity: ActivityForEventPageInput & { slug?: string | null };
  citySlug: string;
  publicBase: string;
}): Record<string, unknown> {
  const { activity, citySlug, publicBase } = args;
  const starts = activity.sessions?.[0]?.startsAt;
  const ends = activity.sessions?.[activity.sessions.length - 1]?.startsAt;

  const url =
    activity.slug ? `${publicBase}/${citySlug}/activity/${activity.slug}` : undefined;

  const image =
    activity.images?.[0]?.url ||
    activity.coverImageUrl ||
    undefined;

  const venueTitle =
    activity.venue?.place?.title ||
    activity.venue?.title ||
    activity.place?.title ||
    undefined;
  const venueAddress =
    activity.venue?.place?.formattedAddr ||
    activity.venue?.addressLine ||
    activity.place?.formattedAddr ||
    undefined;

  const location =
    venueTitle || venueAddress
      ? {
          "@type": "Place",
          name: venueTitle,
          address: venueAddress,
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: activity.title,
    description: activity.shortDesc,
    startDate: starts ? starts.toISOString() : undefined,
    endDate: ends ? ends.toISOString() : undefined,
    image: image ? [image] : undefined,
    location,
    url,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  };
}

