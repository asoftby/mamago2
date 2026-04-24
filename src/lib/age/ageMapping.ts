import {
  AGE_OPTIONS,
  getCombinedAgeRange,
  isValidAgeKey,
  sortAgeKeys,
  type AgeKey,
} from "@/lib/config/ages";

export type AgeBucket = AgeKey;
export type AgeDetectionConfidence = "high" | "medium" | "low" | "none";

export interface AgeDetection {
  raw: string | null;
  confidence: AgeDetectionConfidence;
  suggestedBuckets: AgeBucket[];
  normalizedLabel: string | null;
  parsedMinAge: number | null;
  parsedMaxAge: number | null;
}

type ConfidenceResult = {
  buckets: AgeBucket[];
  confidence: Exclude<AgeDetectionConfidence, "none">;
  normalizedLabel: string | null;
  parsedMinAge: number | null;
  parsedMaxAge: number | null;
};

const CHILD_BUCKETS = AGE_OPTIONS.filter((option) => option.key !== "18+");

const MEDIUM_KEYWORD_RULES: Array<{ pattern: RegExp; buckets: AgeBucket[] }> = [
  { pattern: /\bмалыш/i, buckets: ["0-1", "1-3", "3-5"] },
  { pattern: /\bдошколь/i, buckets: ["3-5", "5-7"] },
  { pattern: /\bшкольник/i, buckets: ["7-9", "9-12", "12-14"] },
  { pattern: /\bподрост/i, buckets: ["12-14", "14-16", "16-18"] },
  { pattern: /\bсемейн/i, buckets: ["1-3", "3-5", "5-7", "7-9", "9-12"] },
  { pattern: /\bвзросл/i, buckets: ["18+"] },
];

function normalizeAgeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/[,]/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeBuckets(buckets: AgeBucket[]): AgeBucket[] {
  return sortAgeKeys(Array.from(new Set(buckets)).filter(isValidAgeKey));
}

function overlaps(min: number, max: number | null, bucket: (typeof AGE_OPTIONS)[number]): boolean {
  const bucketStart = bucket.min;
  const bucketEnd = bucket.max ?? 120;
  const rangeStart = min;
  const rangeEnd = max ?? 120;
  return rangeStart < bucketEnd && rangeEnd > bucketStart;
}

function bucketsFromRange(min: number, max: number | null): AgeBucket[] {
  if (min >= 18) return ["18+"];

  const pool = max == null || max <= 18 ? CHILD_BUCKETS : AGE_OPTIONS;
  return dedupeBuckets(
    pool
      .filter((bucket) => overlaps(min, max, bucket))
      .map((bucket) => bucket.key as AgeBucket),
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toString().replace(".", ",");
}

function formatNormalizedLabel(min: number, max: number | null): string {
  if (max == null) return `от ${formatNumber(min)} лет`;
  if (min === 0) return `до ${formatNumber(max)} лет`;
  return `${formatNumber(min)}–${formatNumber(max)} лет`;
}

function rangeResult(min: number, max: number | null): ConfidenceResult {
  return {
    buckets: bucketsFromRange(min, max),
    confidence: "high",
    normalizedLabel: formatNormalizedLabel(min, max),
    parsedMinAge: min,
    parsedMaxAge: max,
  };
}

export function mapParsedAgeToBuckets(input: string): ConfidenceResult {
  const normalized = normalizeAgeText(input);

  const exactBucketMatch = normalized.match(/^(\d{1,2}(?:\.\d+)?)\s*(?:\+|лет\+|год\+|года\+)$/i);
  if (exactBucketMatch) {
    const min = Number.parseFloat(exactBucketMatch[1]);
    return rangeResult(min, null);
  }

  const fromToMatch = normalized.match(
    /(?:от|с)\s*(\d{1,2}(?:\.\d+)?)\s*(?:до|по)\s*(\d{1,2}(?:\.\d+)?)(?:\s*(?:лет|года|год))?/i,
  );
  if (fromToMatch) {
    const min = Number.parseFloat(fromToMatch[1]);
    const max = Number.parseFloat(fromToMatch[2]);
    return rangeResult(min, max);
  }

  const rangeMatch = normalized.match(/(\d{1,2}(?:\.\d+)?)\s*-\s*(\d{1,2}(?:\.\d+)?)/);
  if (rangeMatch) {
    const min = Number.parseFloat(rangeMatch[1]);
    const max = Number.parseFloat(rangeMatch[2]);
    return rangeResult(min, max);
  }

  const fromMatch = normalized.match(/(?:от|с)\s*(\d{1,2}(?:\.\d+)?)\s*(?:лет|года|год)?/i);
  if (fromMatch) {
    const min = Number.parseFloat(fromMatch[1]);
    return rangeResult(min, null);
  }

  const tillMatch = normalized.match(/до\s*(\d{1,2}(?:\.\d+)?)\s*(?:лет|года|год)?/i);
  if (tillMatch) {
    const max = Number.parseFloat(tillMatch[1]);
    return rangeResult(0, max);
  }

  for (const rule of MEDIUM_KEYWORD_RULES) {
    if (rule.pattern.test(normalized)) {
      return {
        buckets: dedupeBuckets(rule.buckets),
        confidence: "medium",
        normalizedLabel: null,
        parsedMinAge: null,
        parsedMaxAge: null,
      };
    }
  }

  return {
    buckets: [],
    confidence: "low",
    normalizedLabel: null,
    parsedMinAge: null,
    parsedMaxAge: null,
  };
}

export function detectAgeBuckets(input: string | null | undefined): AgeDetection {
  if (!input || input.trim().length === 0) {
    return {
      raw: null,
      confidence: "none",
      suggestedBuckets: [],
      normalizedLabel: null,
      parsedMinAge: null,
      parsedMaxAge: null,
    };
  }

  const mapped = mapParsedAgeToBuckets(input);
  return {
    raw: input.trim(),
    confidence: mapped.confidence,
    suggestedBuckets: mapped.buckets,
    normalizedLabel: mapped.normalizedLabel,
    parsedMinAge: mapped.parsedMinAge,
    parsedMaxAge: mapped.parsedMaxAge,
  };
}

export function getAgeRangeFromBuckets(buckets: AgeBucket[]): {
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
} {
  const range = getCombinedAgeRange(buckets);
  return {
    ageMinMonths: range?.minMonths ?? null,
    ageMaxMonths: range?.maxMonths ?? null,
  };
}
