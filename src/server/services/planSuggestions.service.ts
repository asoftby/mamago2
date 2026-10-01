import { ActivityType, ScheduleMode, type Prisma } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInAnyOfCitiesWhere } from "@/server/discovery/activityInCityWhere";
import { resolveKudaDiscoveryCityIds } from "@/server/discovery/discoveryHubExpand";
import { getEventEngagementScores } from "@/server/discovery/eventEngagementScores";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";

/**
 * Current real shared EVENT ranking contract. This is deliberately versioned
 * before any ML/personal ranking is introduced so historic exposures remain
 * explainable after the algorithm evolves.
 */
export const PLAN_SUGGESTION_ALGORITHM_VERSION = "engagement-profile-interest-v2";
export const INTEREST_MATCH_WEIGHT = 4;
export const MAX_INTEREST_MATCHES = 2;

const CANONICAL_INTEREST_SLUGS = new Set(SYSTEM_INTERESTS.map((interest) => interest.slug));

export function eventSystemInterestSlugs(scheduleJson: unknown): string[] {
  if (!scheduleJson || typeof scheduleJson !== "object" || Array.isArray(scheduleJson)) return [];
  const signals = (scheduleJson as Record<string, unknown>).signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return [];
  const interests = (signals as Record<string, unknown>).interests;
  if (!Array.isArray(interests)) return [];
  return [...new Set(interests.filter(
    (value): value is string => typeof value === "string" && CANONICAL_INTEREST_SLUGS.has(value),
  ))];
}

export function profileInterestScore(
  profileInterestSlugs: readonly string[],
  scheduleJson: unknown,
): { interestMatchCount: number; interestBoost: number } {
  const selected = new Set(profileInterestSlugs.filter((slug) => CANONICAL_INTEREST_SLUGS.has(slug)));
  const matchCount = eventSystemInterestSlugs(scheduleJson).filter((slug) => selected.has(slug)).length;
  const interestMatchCount = Math.min(matchCount, MAX_INTEREST_MATCHES);
  return { interestMatchCount, interestBoost: interestMatchCount * INTEREST_MATCH_WEIGHT };
}

export function planSuggestionScore(input: {
  engagementScore: number;
  profileInterestSlugs: readonly string[];
  scheduleJson: unknown;
}): {
  score: number;
  interestMatchCount: number;
  interestBoost: number;
  interestReasonCodes: string[];
} {
  const interest = profileInterestScore(input.profileInterestSlugs, input.scheduleJson);
  return {
    score: input.engagementScore + interest.interestBoost,
    ...interest,
    interestReasonCodes: interest.interestMatchCount > 0 ? ["INTEREST_MATCH"] : [],
  };
}

/** Следующий календарный день для "YYYY-MM-DD" — чистая арифметика по частям даты, без Date/TZ. */
function nextDateKey(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const utcNext = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + 1));
  const yy = utcNext.getUTCFullYear();
  const mm = String(utcNext.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utcNext.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** [день, день+1) в Europe/Minsk для `date` вида "YYYY-MM-DD" — не локальное время процесса. */
function zonedDayRange(dateIso: string, timeZone: string): { start: Date; end: Date } {
  const start = fromZonedTime(`${dateIso}T00:00:00`, timeZone);
  const end = fromZonedTime(`${nextDateKey(dateIso)}T00:00:00`, timeZone);
  return { start, end };
}

/** [dateFrom, dateTo+1) в указанной TZ; используется surface horizon без форка ranking. */
function zonedDateRange(
  dateFrom: string,
  dateTo: string,
  timeZone: string,
): { start: Date; end: Date } {
  const safeTo = dateTo >= dateFrom ? dateTo : dateFrom;
  return {
    start: fromZonedTime(`${dateFrom}T00:00:00`, timeZone),
    end: fromZonedTime(`${nextDateKey(safeTo)}T00:00:00`, timeZone),
  };
}

/** Постоянно доступные активности (без привязки к сессии) — видимы независимо от выбранного дня. */
const ALWAYS_AVAILABLE_SCHEDULE_MODES: ScheduleMode[] = [
  ScheduleMode.ALWAYS,
  ScheduleMode.ON_DEMAND,
  ScheduleMode.RECURRING,
];

const suggestionActivitySelect = {
  id: true,
  slug: true,
  title: true,
  type: true,
  coverImageUrl: true,
  ageLabel: true,
  eventCategory: { select: { id: true, nameRu: true } },
  priceFrom: true,
  priceTo: true,
  priceText: true,
  currency: true,
  status: true,
  owner: {
    select: {
      business: { select: { operationalStatus: true } },
    },
  },
  place: {
    select: {
      shortAddress: true,
      formattedAddr: true,
      customAddress: true,
      city: { select: { name: true } },
    },
  },
  venue: {
    select: {
      addressLine: true,
      kind: true,
      place: {
        select: {
          shortAddress: true,
          formattedAddr: true,
          customAddress: true,
          city: { select: { name: true } },
        },
      },
    },
  },
  scheduleJson: true,
  schedulingKind: true,
} as const;

export type PlanSuggestionActivity = Prisma.ActivityGetPayload<{
  select: typeof suggestionActivitySelect;
}>;

export type RankedPlanSuggestion = {
  activity: PlanSuggestionActivity;
  /** Existing engagement score. Freshness is only a tie-break in v1. */
  score: number;
  scoreBreakdown: {
    engagementScore: number;
    interestMatchCount: number;
    interestBoost: number;
    freshnessSortAt: string;
    ageFilterApplied: boolean;
    ageFallbackUsed: boolean;
  };
  reasonCodes: string[];
};

export type PlanSuggestionRankedBatch = {
  suggestions: RankedPlanSuggestion[];
  candidateCount: number;
  algorithmVersion: typeof PLAN_SUGGESTION_ALGORITHM_VERSION;
};

export type PlanSuggestionsInput = {
  citySlug: string;
  excludeActivityIds: string[];
  /** Сколько карточек отдать клиенту */
  take?: number;
  /** Значения возрастных групп (как в Activity.ageTags). */
  ageRangeValues?: string[];
  /** "YYYY-MM-DD" — один календарный день в Europe/Minsk. */
  date?: string;
  /** Опциональный диапазон для surface horizon. Игнорируется, если задан `date`. */
  dateFrom?: string;
  dateTo?: string;
  /**
   * Read-only diagnostics/composition may need the complete ranked set before
   * applying a surface policy. Normal product calls stay bounded to avoid an
   * unbounded query. This does not change scoring or signal interpretation.
   */
  exhaustiveCandidatePool?: boolean;
  /** Server-resolved canonical ChildInterest.interestSlug values. Never client supplied. */
  profileInterestSlugs?: string[];
};

/**
 * Shared ranked EVENT batch. The function is surface-agnostic: My Plan,
 * Telegram and future consumers may pass different candidate windows, but
 * scoring/engagement interpretation remains one shared implementation.
 */
export async function rankPlanSuggestionsForCity(
  input: PlanSuggestionsInput,
): Promise<PlanSuggestionRankedBatch> {
  const take = input.take ?? 6;
  const exhaustiveCandidatePool = input.exhaustiveCandidatePool === true;
  const ageRangeValues = (input.ageRangeValues ?? []).filter(Boolean);
  const profileInterestSlugs = [...new Set(input.profileInterestSlugs ?? [])]
    .filter((slug) => CANONICAL_INTEREST_SLUGS.has(slug))
    .slice(0, SYSTEM_INTERESTS.length);
  const city = await findCityBySlug(input.citySlug.toLowerCase());
  if (!city) {
    return {
      suggestions: [],
      candidateCount: 0,
      algorithmVersion: PLAN_SUGGESTION_ALGORITHM_VERSION,
    };
  }

  const { expandedCityIds } = await resolveKudaDiscoveryCityIds(
    input.citySlug,
    city.id,
  );

  const pub = getPublicListingActivityWhere();
  const pubParts = (pub.AND ?? []) as Prisma.ActivityWhereInput[];
  const exclude = input.excludeActivityIds.filter(Boolean);

  const requestedRange = input.date
    ? zonedDayRange(input.date, DEFAULT_TZ)
    : input.dateFrom
      ? zonedDateRange(input.dateFrom, input.dateTo ?? input.dateFrom, DEFAULT_TZ)
      : null;

  const scheduleFilterAnd: Prisma.ActivityWhereInput[] = requestedRange
    ? [
        {
          OR: [
            { sessions: { some: { startsAt: { gte: requestedRange.start, lt: requestedRange.end }, withdrawnAt: null } } },
            { nextOccurrenceAt: { gte: requestedRange.start, lt: requestedRange.end } },
            {
              AND: [
                { scheduleMode: { in: ALWAYS_AVAILABLE_SCHEDULE_MODES } },
                { nextOccurrenceAt: null },
              ],
            },
          ],
        },
      ]
    : [];

  const baseAnd: Prisma.ActivityWhereInput[] = [
    { type: ActivityType.EVENT },
    activityInAnyOfCitiesWhere(expandedCityIds),
    ...pubParts,
    ...scheduleFilterAnd,
    ...(exclude.length > 0 ? [{ id: { notIn: exclude } }] : []),
    ...(ageRangeValues.some((value) => value !== "18+")
      ? [{ agePolicy: { not: "ADULT_ONLY" as const } }]
      : []),
  ];

  const ageFilterAnd: Prisma.ActivityWhereInput[] =
    ageRangeValues.length > 0
      ? [
          {
            OR: [
              { ageTags: { equals: [] } },
              { ageTags: { hasSome: ageRangeValues } },
            ],
          },
        ]
      : [];

  type Row = PlanSuggestionActivity & {
    nextOccurrenceAt: Date | null;
    createdAt: Date;
  };

  async function fetchCandidateRows(withAgePreference: boolean): Promise<Row[]> {
    const agePart =
      withAgePreference && ageFilterAnd.length > 0 ? ageFilterAnd : [];
    const where: Prisma.ActivityWhereInput = {
      AND: [...baseAnd, ...agePart],
    };
    return (await prisma.activity.findMany({
      where,
      ...(exhaustiveCandidatePool
        ? {}
        : { take: Math.min(80, Math.max(take * 5, 24)) }),
      orderBy: [{ nextOccurrenceAt: "desc" }, { createdAt: "desc" }],
      select: {
        ...suggestionActivitySelect,
        nextOccurrenceAt: true,
        createdAt: true,
      },
    })) as Row[];
  }

  let ageFallbackUsed = false;
  let rows = await fetchCandidateRows(true);
  if (rows.length === 0 && ageRangeValues.length > 0) {
    ageFallbackUsed = true;
    rows = await fetchCandidateRows(false);
  }

  const candidateCount = rows.length;
  const scoreMap = await getEventEngagementScores(rows.map((row) => row.id));

  rows.sort((a, b) => {
    const scoreA = planSuggestionScore({ engagementScore: scoreMap.get(a.id) ?? 0, profileInterestSlugs, scheduleJson: a.scheduleJson }).score;
    const scoreB = planSuggestionScore({ engagementScore: scoreMap.get(b.id) ?? 0, profileInterestSlugs, scheduleJson: b.scheduleJson }).score;
    if (scoreA !== scoreB) return scoreB - scoreA;
    const timeA = a.nextOccurrenceAt?.getTime() ?? a.createdAt.getTime();
    const timeB = b.nextOccurrenceAt?.getTime() ?? b.createdAt.getTime();
    return timeB - timeA;
  });

  const ageFilterApplied = ageRangeValues.length > 0 && !ageFallbackUsed;
  const rankedRows = exhaustiveCandidatePool ? rows : rows.slice(0, take);
  const suggestions = rankedRows.map((row) => {
    const {
      nextOccurrenceAt,
      createdAt,
      ...activity
    } = row;
    const engagementScore = scoreMap.get(row.id) ?? 0;
    const interestSignal = planSuggestionScore({ engagementScore, profileInterestSlugs, scheduleJson: row.scheduleJson });
    const { interestMatchCount, interestBoost } = interestSignal;
    const freshnessSortAt = (nextOccurrenceAt ?? createdAt).toISOString();
    const reasonCodes = [
      ...(ageFilterApplied ? ["AGE_SCOPE"] : []),
      ...(ageFallbackUsed ? ["AGE_FALLBACK"] : []),
      ...(engagementScore > 0 ? ["ENGAGEMENT"] : []),
      ...interestSignal.interestReasonCodes,
      "FRESHNESS_TIE_BREAK",
    ];

    return {
      activity,
      score: interestSignal.score,
      scoreBreakdown: {
        engagementScore,
        interestMatchCount,
        interestBoost,
        freshnessSortAt,
        ageFilterApplied,
        ageFallbackUsed,
      },
      reasonCodes,
    };
  });

  return {
    suggestions,
    candidateCount,
    algorithmVersion: PLAN_SUGGESTION_ALGORITHM_VERSION,
  };
}

/**
 * Backward-compatible activity-only wrapper. New recommendation surfaces should
 * consume a ranked batch and record a RecommendationRun instead of duplicating
 * this ranking logic.
 */
export async function listPlanSuggestionsForCity(
  input: PlanSuggestionsInput,
): Promise<PlanSuggestionActivity[]> {
  const batch = await rankPlanSuggestionsForCity(input);
  return batch.suggestions.map((item) => item.activity);
}
