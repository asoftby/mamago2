import { absolutePublicImageUrl } from "@/lib/seo/schema/url";

export type EventAttendanceFormat = "ONLINE" | "OFFLINE" | "HYBRID" | string | null | undefined;

export type BuildEventJsonLdInput = {
  canonicalUrl: string;
  title: string;
  description?: string | null;
  image?: string | null;
  sessions?: Array<{
    startsAt?: Date | string | null;
  }> | null;
  format?: EventAttendanceFormat;
  location?: {
    name?: string | null;
    address?: string | null;
  } | null;
  publicBaseUrl?: string;
};

function normalizeSessionDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function pickEventStartDate(
  sessions: Array<{ startsAt?: Date | string | null }>,
): string | undefined {
  const normalized = sessions
    .map((session) => normalizeSessionDate(session.startsAt))
    .filter((date): date is Date => date !== null)
    .sort((left, right) => left.getTime() - right.getTime());

  if (normalized.length === 0) return undefined;

  const nowTs = Date.now();
  const nextUpcoming = normalized.find((date) => date.getTime() >= nowTs);
  return (nextUpcoming ?? normalized[0])?.toISOString();
}

function mapAttendanceMode(format: EventAttendanceFormat): string | undefined {
  switch (format) {
    case "ONLINE":
      return "https://schema.org/OnlineEventAttendanceMode";
    case "OFFLINE":
      return "https://schema.org/OfflineEventAttendanceMode";
    case "HYBRID":
      return "https://schema.org/MixedEventAttendanceMode";
    default:
      return undefined;
  }
}

export function buildEventJsonLd(input: BuildEventJsonLdInput): Record<string, unknown> {
  const image = absolutePublicImageUrl(input.image, input.publicBaseUrl);
  const locationName = input.location?.name?.trim() || undefined;
  const locationAddress = input.location?.address?.trim() || undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${input.canonicalUrl}#event`,
    url: input.canonicalUrl,
    name: input.title,
    description: input.description?.trim() || undefined,
    image: image ? [image] : undefined,
    startDate: pickEventStartDate(input.sessions ?? []),
    location:
      locationName || locationAddress
        ? {
            "@type": "Place",
            name: locationName,
            address: locationAddress,
          }
        : undefined,
    eventAttendanceMode: mapAttendanceMode(input.format),
  };
}
