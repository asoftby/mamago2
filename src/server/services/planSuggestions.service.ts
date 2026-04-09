import { ActivityType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInAnyOfCitiesWhere } from "@/server/discovery/activityInCityWhere";
import { resolveKudaDiscoveryCityIds } from "@/server/discovery/discoveryHubExpand";
import { getEventEngagementScores } from "@/server/discovery/eventEngagementScores";

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
}): Promise<PlanSuggestionActivity[]> {
  const take = input.take ?? 6;
  const ageRangeValues = (input.ageRangeValues ?? []).filter(Boolean);
  const city = await prisma.city.findUnique({
    where: { slug: input.citySlug.toLowerCase() },
  });
  if (!city) return [];

  const { primaryCityId, expandedCityIds } = await resolveKudaDiscoveryCityIds(
    input.citySlug,
    city.id,
  );
  void primaryCityId;

  const pub = getPublicListingActivityWhere();
  const pubParts = (pub.AND ?? []) as Prisma.ActivityWhereInput[];

  const exclude = input.excludeActivityIds.filter(Boolean);

  const baseAnd: Prisma.ActivityWhereInput[] = [
    { type: ActivityType.EVENT },
    activityInAnyOfCitiesWhere(expandedCityIds),
    ...pubParts,
    ...(exclude.length > 0 ? [{ id: { notIn: exclude } }] : []),
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
