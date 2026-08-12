import { ActivityType, ScheduleMode, type Prisma } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInAnyOfCitiesWhere } from "@/server/discovery/activityInCityWhere";
import { resolveKudaDiscoveryCityIds } from "@/server/discovery/discoveryHubExpand";
import { getEventEngagementScores } from "@/server/discovery/eventEngagementScores";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";

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
  eventCategory: { select: { nameRu: true } },
  priceFrom: true,
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
} as const;

export type PlanSuggestionActivity = Prisma.ActivityGetPayload<{
  select: typeof suggestionActivitySelect;
}>;

/**
 * Короткий список опубликованных событий в городе для блока «Рекомендации» в «Мой план».
 * Не recommendation engine: ранжирование по engagement + свежести, как в ленте «Куда пойти».
 */
export async function listPlanSuggestionsForCity(input: {
  citySlug: string;
  excludeActivityIds: string[];
  /** Сколько карточек отдать клиенту */
  take?: number;
  /**
   * Значения возрастных групп (как в Activity.ageTags), из выбранных в «Мой план» детей / фильтра.
   * Если задано — оставляем события без возраста или с пересечением по тегам (не «умный» подбор).
   */
  ageRangeValues?: string[];
  /**
   * "YYYY-MM-DD" — календарный день в Europe/Minsk, выбранный в «Мой план».
   * Без него дата не влияет на выдачу вообще (было так раньше — сознательно оставлено
   * опциональным для обратной совместимости с другими вызывающими, если появятся).
   * В отличие от возраста — без фолбэка: пустой день на этот день остаётся пустым,
   * а не подменяется случайным ближайшим контентом.
   */
  date?: string;
}): Promise<PlanSuggestionActivity[]> {
  const take = input.take ?? 6;
  const ageRangeValues = (input.ageRangeValues ?? []).filter(Boolean);
  const city = await findCityBySlug(input.citySlug.toLowerCase());
  if (!city) return [];

  const { primaryCityId, expandedCityIds } = await resolveKudaDiscoveryCityIds(
    input.citySlug,
    city.id,
  );
  void primaryCityId;

  const pub = getPublicListingActivityWhere();
  const pubParts = (pub.AND ?? []) as Prisma.ActivityWhereInput[];

  const exclude = input.excludeActivityIds.filter(Boolean);

  const dayFilterAnd: Prisma.ActivityWhereInput[] = input.date
    ? (() => {
        const range = zonedDayRange(input.date!, DEFAULT_TZ);
        return [
          {
            OR: [
              { sessions: { some: { startsAt: { gte: range.start, lt: range.end } } } },
              { nextOccurrenceAt: { gte: range.start, lt: range.end } },
              {
                AND: [
                  { scheduleMode: { in: ALWAYS_AVAILABLE_SCHEDULE_MODES } },
                  { nextOccurrenceAt: null },
                ],
              },
            ],
          },
        ];
      })()
    : [];

  const baseAnd: Prisma.ActivityWhereInput[] = [
    { type: ActivityType.EVENT },
    activityInAnyOfCitiesWhere(expandedCityIds),
    ...pubParts,
    ...dayFilterAnd,
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

  async function fetchCandidateRows(
    withAgePreference: boolean,
  ): Promise<Row[]> {
    const agePart =
      withAgePreference && ageFilterAnd.length > 0 ? ageFilterAnd : [];
    const where: Prisma.ActivityWhereInput = {
      AND: [...baseAnd, ...agePart],
    };
    return (await prisma.activity.findMany({
      where,
      take: Math.min(80, Math.max(take * 5, 24)),
      orderBy: [{ nextOccurrenceAt: "desc" }, { createdAt: "desc" }],
      select: {
        ...suggestionActivitySelect,
        nextOccurrenceAt: true,
        createdAt: true,
      },
    })) as Row[];
  }

  let rows = await fetchCandidateRows(true);
  if (rows.length === 0 && ageRangeValues.length > 0) {
    rows = await fetchCandidateRows(false);
  }

  const scoreMap = await getEventEngagementScores(rows.map((r) => r.id));

  rows.sort((a, b) => {
    const sa = scoreMap.get(a.id) ?? 0;
    const sb = scoreMap.get(b.id) ?? 0;
    if (sa !== sb) return sb - sa;
    const ta = a.nextOccurrenceAt?.getTime() ?? a.createdAt.getTime();
    const tb = b.nextOccurrenceAt?.getTime() ?? b.createdAt.getTime();
    return tb - ta;
  });

  return rows.slice(0, take).map(({ nextOccurrenceAt: _n, createdAt: _c, ...activity }) => activity);
}
