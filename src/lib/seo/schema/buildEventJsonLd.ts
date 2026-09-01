import { absolutePublicImageUrl } from "@/lib/seo/schema/url";

export type EventAttendanceFormat = "ONLINE" | "OFFLINE" | "HYBRID" | string | null | undefined;

export type BuildEventJsonLdInput = {
  canonicalUrl: string;
  title: string;
  description?: string | null;
  image?: string | null;
  startDate?: Date | string | null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasEventType(value: unknown): boolean {
  if (value === "Event") return true;
  return Array.isArray(value) && value.includes("Event");
}

function hasValidStructuredStartDate(value: unknown): boolean {
  return typeof value === "string" && normalizeSessionDate(value) !== null;
}

export function eventJsonLdOverrideHasMissingStartDate(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => eventJsonLdOverrideHasMissingStartDate(item));
  }
  if (!isRecord(value)) return false;

  if (hasEventType(value["@type"]) && !hasValidStructuredStartDate(value.startDate)) {
    return true;
  }

  return eventJsonLdOverrideHasMissingStartDate(value["@graph"]);
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
  const mostRecentPast = normalized[normalized.length - 1];
  return (nextUpcoming ?? mostRecentPast)?.toISOString();
}

function resolveEventStartDate(input: BuildEventJsonLdInput): string | undefined {
  const explicitStartDate = normalizeSessionDate(input.startDate);
  return explicitStartDate?.toISOString() ?? pickEventStartDate(input.sessions ?? []);
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

export function buildEventJsonLd(input: BuildEventJsonLdInput): Record<string, unknown> | null {
  const startDate = resolveEventStartDate(input);
  if (!startDate) return null;

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
    startDate,
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
