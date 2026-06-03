import type { StoredGoogleReview } from "@/types/google-places";

export type GoogleReviewsMatchStatus =
  | "CONFIRMED"
  | "ADDRESS_ONLY"
  | "MISMATCH"
  | "DISABLED";

export interface GoogleReviewsMeta {
  enabled: boolean;
  matchStatus: GoogleReviewsMatchStatus;
  disabledReason: string | null;
  googlePlaceName: string | null;
  googlePlaceAddress: string | null;
  confirmedManually?: boolean;
}

export interface GoogleReviewsPayload {
  reviews?: StoredGoogleReview[];
  syncedAt?: string;
  meta?: GoogleReviewsMeta;
}

function normalizeText(input: string | null | undefined): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=_`~()"]/g, " ")
    .replace(/\b(г|город|ул|улица|пер|переулок|пр-т|проспект|д|дом|область|район)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input: string | null | undefined): string[] {
  return normalizeText(input)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function overlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  const common = a.filter((token) => bSet.has(token)).length;
  return common / Math.max(a.length, b.length);
}

export function classifyGoogleReviewsMatch(input: {
  placeTitle?: string | null;
  placeAddress?: string | null;
  googlePlaceId?: string | null;
  googlePlaceName?: string | null;
  googlePlaceAddress?: string | null;
}): GoogleReviewsMeta {
  if (!input.googlePlaceId) {
    return {
      enabled: false,
      matchStatus: "DISABLED",
      disabledReason: "missing_place_id",
      googlePlaceName: input.googlePlaceName ?? null,
      googlePlaceAddress: input.googlePlaceAddress ?? null,
    };
  }

  const placeTitleTokens = tokenize(input.placeTitle);
  const googleNameTokens = tokenize(input.googlePlaceName);
  const placeAddressTokens = tokenize(input.placeAddress);
  const googleAddressTokens = tokenize(input.googlePlaceAddress);

  const nameScore = overlapScore(placeTitleTokens, googleNameTokens);
  const addressScore = overlapScore(placeAddressTokens, googleAddressTokens);

  const nameMatch =
    nameScore >= 0.45 ||
    normalizeText(input.placeTitle).includes(normalizeText(input.googlePlaceName)) ||
    normalizeText(input.googlePlaceName).includes(normalizeText(input.placeTitle));
  const addressMatch =
    addressScore >= 0.45 ||
    normalizeText(input.placeAddress).includes(normalizeText(input.googlePlaceAddress)) ||
    normalizeText(input.googlePlaceAddress).includes(normalizeText(input.placeAddress));

  if (nameMatch && addressMatch) {
    return {
      enabled: true,
      matchStatus: "CONFIRMED",
      disabledReason: null,
      googlePlaceName: input.googlePlaceName ?? null,
      googlePlaceAddress: input.googlePlaceAddress ?? null,
    };
  }

  if (!nameMatch && addressMatch) {
    return {
      enabled: false,
      matchStatus: "ADDRESS_ONLY",
      disabledReason: "address_only_match",
      googlePlaceName: input.googlePlaceName ?? null,
      googlePlaceAddress: input.googlePlaceAddress ?? null,
    };
  }

  return {
    enabled: false,
    matchStatus: "MISMATCH",
    disabledReason: "name_or_address_mismatch",
    googlePlaceName: input.googlePlaceName ?? null,
    googlePlaceAddress: input.googlePlaceAddress ?? null,
  };
}

export function readGoogleReviewsPayload(
  value: unknown,
): GoogleReviewsPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const metaRaw =
    raw.meta && typeof raw.meta === "object" && !Array.isArray(raw.meta)
      ? (raw.meta as Record<string, unknown>)
      : null;

  return {
    reviews: Array.isArray(raw.reviews) ? (raw.reviews as StoredGoogleReview[]) : undefined,
    syncedAt: typeof raw.syncedAt === "string" ? raw.syncedAt : undefined,
    meta: metaRaw
      ? {
          enabled: metaRaw.enabled === true,
          matchStatus:
            metaRaw.matchStatus === "CONFIRMED" ||
            metaRaw.matchStatus === "ADDRESS_ONLY" ||
            metaRaw.matchStatus === "MISMATCH" ||
            metaRaw.matchStatus === "DISABLED"
              ? metaRaw.matchStatus
              : "DISABLED",
          disabledReason:
            typeof metaRaw.disabledReason === "string" ? metaRaw.disabledReason : null,
          googlePlaceName:
            typeof metaRaw.googlePlaceName === "string" ? metaRaw.googlePlaceName : null,
          googlePlaceAddress:
            typeof metaRaw.googlePlaceAddress === "string"
              ? metaRaw.googlePlaceAddress
              : null,
          confirmedManually: metaRaw.confirmedManually === true,
        }
      : undefined,
  };
}

export function mergeGoogleReviewsMeta(
  current: unknown,
  patch: Partial<GoogleReviewsMeta>,
): GoogleReviewsPayload {
  const existing = readGoogleReviewsPayload(current) ?? {};
  return {
    ...existing,
    meta: {
      enabled: existing.meta?.enabled ?? false,
      matchStatus: existing.meta?.matchStatus ?? "DISABLED",
      disabledReason: existing.meta?.disabledReason ?? null,
      googlePlaceName: existing.meta?.googlePlaceName ?? null,
      googlePlaceAddress: existing.meta?.googlePlaceAddress ?? null,
      confirmedManually: existing.meta?.confirmedManually ?? false,
      ...patch,
    },
  };
}

export function isGoogleReviewsEnabled(
  googlePlaceId: string | null | undefined,
  payload: unknown,
): boolean {
  if (!googlePlaceId) return false;
  const parsed = readGoogleReviewsPayload(payload);
  return parsed?.meta?.enabled === true;
}
