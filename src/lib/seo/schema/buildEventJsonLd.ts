import { absolutePublicImageUrl } from "@/lib/seo/schema/url";

export type EventAttendanceFormat = "ONLINE" | "OFFLINE" | "HYBRID" | string | null | undefined;
export type EventPriceMode = "FREE" | "EXACT" | "FROM" | "RANGE" | "NONE" | "UNKNOWN" | string | null | undefined;

export type BuildEventJsonLdInput = {
  canonicalUrl: string;
  title: string;
  description?: string | null;
  image?: string | null;
  startDate?: Date | string | null;
  sessions?: Array<{
    startsAt?: Date | string | null;
    isSaleOpen?: boolean | null;
  }> | null;
  format?: EventAttendanceFormat;
  location?: {
    name?: string | null;
    address?: string | null;
    addressLocality?: string | null;
  } | null;
  pricing?: {
    mode?: EventPriceMode;
    priceFrom?: number | null;
    currency?: string | null;
    validFrom?: Date | string | null;
  } | null;
  publicBaseUrl?: string;
};

const EVENT_JSON_LD_TYPES = new Set([
  "Event",
  "https://schema.org/Event",
  "http://schema.org/Event",
]);

const STRUCTURED_DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(?:(Z)|([+-])(\d{2}):(\d{2}))?)?$/;

function normalizeSessionDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEventTypeToken(value: unknown): boolean {
  return typeof value === "string" && EVENT_JSON_LD_TYPES.has(value);
}

function hasEventType(value: unknown): boolean {
  if (isEventTypeToken(value)) return true;
  return Array.isArray(value) && value.some((item) => isEventTypeToken(item));
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

function hasValidStructuredStartDate(value: unknown): boolean {
  if (typeof value !== "string") return false;

  const match = STRUCTURED_DATE_RE.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return false;
  }

  if (match[4] === undefined) return true;

  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  if (hour > 23 || minute > 59 || second > 59) return false;

  const offsetHour = match[10];
  const offsetMinute = match[11];
  if (offsetHour !== undefined && offsetMinute !== undefined) {
    const hours = Number(offsetHour);
    const minutes = Number(offsetMinute);
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) {
      return false;
    }
  }

  return true;
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

function resolveOfferAvailability(
  sessions: BuildEventJsonLdInput["sessions"],
): string | undefined {
  const knownStates = (sessions ?? [])
    .map((session) => session.isSaleOpen)
    .filter((value): value is boolean => typeof value === "boolean");
  if (knownStates.some(Boolean)) return "https://schema.org/InStock";
  if ((sessions?.length ?? 0) > 0 && sessions?.every((session) => session.isSaleOpen === false)) {
    return "https://schema.org/OutOfStock";
  }
  return undefined;
}

function buildEventOffer(
  pricing: BuildEventJsonLdInput["pricing"],
  canonicalUrl: string,
  availability: string | undefined,
): Record<string, unknown> | undefined {
  if (!pricing) return undefined;
  const mode = typeof pricing.mode === "string" ? pricing.mode.toUpperCase() : "";
  if (mode === "NONE" || mode === "UNKNOWN" || !mode) return undefined;

  const currency = pricing.currency?.trim().toUpperCase();
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return undefined;

  let price: number | null = null;
  if (mode === "FREE") {
    price = 0;
  } else if (mode === "EXACT" || mode === "FROM" || mode === "RANGE") {
    const candidate = pricing.priceFrom;
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0) {
      price = candidate;
    }
  }

  if (price == null) return undefined;

  const validFrom = normalizeSessionDate(pricing.validFrom)?.toISOString();

  return {
    "@type": "Offer",
    price,
    priceCurrency: currency,
    url: canonicalUrl,
    availability,
    validFrom,
  };
}

export function buildEventJsonLd(input: BuildEventJsonLdInput): Record<string, unknown> | null {
  const startDate = resolveEventStartDate(input);
  if (!startDate) return null;

  const image = absolutePublicImageUrl(input.image, input.publicBaseUrl);
  const locationName = input.location?.name?.trim() || undefined;
  const locationAddress = input.location?.address?.trim() || undefined;
  const addressLocality = input.location?.addressLocality?.trim() || undefined;
  const offers = buildEventOffer(
    input.pricing,
    input.canonicalUrl,
    resolveOfferAvailability(input.sessions),
  );

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${input.canonicalUrl}#event`,
    url: input.canonicalUrl,
    name: input.title,
    description: input.description?.trim() || undefined,
    image: image ? [image] : undefined,
    startDate,
    eventStatus: "https://schema.org/EventScheduled",
    location:
      locationName || locationAddress
        ? {
            "@type": "Place",
            name: locationName,
            address: locationAddress
              ? {
                  "@type": "PostalAddress",
                  streetAddress: locationAddress,
                  addressLocality,
                  addressCountry: "BY",
                }
              : undefined,
          }
        : undefined,
    eventAttendanceMode: mapAttendanceMode(input.format),
    offers,
  };
}
