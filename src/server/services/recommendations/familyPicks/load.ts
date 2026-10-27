import { AnalyticsEntityType, RecommendationSurface } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import type { Subject } from "@/lib/decision/decisionContext";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { activeFamilyUserIds, activePlanScopeFor, childScopeFor } from "@/server/family/familyAccess";
import {
  eventSystemInterestSlugs,
  rankPlanSuggestionsForCity,
} from "@/server/services/planSuggestions.service";
import { resolveSelectedExperienceAffinity } from "@/server/services/recommendations/experienceAffinity";
import { recordRecommendationRun } from "@/server/services/recommendations/RecommendationTraceService";
import { FAMILY_PICKS_ALGORITHM_VERSION, normalizeFamilyPicksConfig, type FamilyPicksConfig } from "./config";
import {
  ageMonthsAt,
  ageFilterKeysForChildren,
  selectFamilyPicks,
  type FamilyChild,
  type FamilyContext,
  type FamilyPickCandidate,
  type FamilyPicksResult,
} from "./select";
import { collectUpcomingOccurrences, resolveShowWindow, type ShowWindow } from "./window";

/** Постоянные расписания (как в общем движке): видимы независимо от дня. */
const ALWAYS_AVAILABLE_MODES: ReadonlySet<string> = new Set(["ALWAYS", "ON_DEMAND", "RECURRING"]);

export type FamilyPickCard = {
  entityType: "EVENT";
  id: string;
  exposureId: string | null;
  position: number;
  title: string;
  href: string;
  imageUrl: string | null;
  categoryName: string | null;
  ageLabel: string | null;
  startsAt: string | null;
  isFree: boolean;
  priceText: string | null;
  ageMatch: string;
  isNovelty: boolean;
  reasonCodes: string[];
  reasonText: string | null;
  /** До двух чипов причин для карточки. */
  reasonChips: string[];
};

export type FamilyPicksResponse = {
  level: FamilyPicksResult["level"];
  title: string | null;
  window: ShowWindow;
  /** guest — без аккаунта; user — авторизован (даже если детей в профиле ещё нет). */
  audience: "guest" | "user";
  /** Ключи возрастных групп детей для ссылки «Другие идеи» (`age=`). Пусто, если возраст неизвестен. */
  ageFilter: string[];
  runId: string | null;
  algorithmVersion: string;
  items: FamilyPickCard[];
};

export type LoadFamilyPicksInput = {
  citySlug: string;
  userId?: string | null;
  sessionId?: string | null;
  anonymousId?: string | null;
  now?: Date;
  config?: Partial<FamilyPicksConfig> | unknown;
};

async function loadDismissedKeys(input: {
  userId: string | null;
  anonymousId: string | null;
  since: Date;
}): Promise<string[]> {
  const actors: Array<{ userId: { in: string[] } } | { anonymousId: string }> = [];
  if (input.userId) actors.push({ userId: { in: await activeFamilyUserIds(input.userId) } });
  if (input.anonymousId) actors.push({ anonymousId: input.anonymousId });
  if (actors.length === 0) return [];
  const rows = await prisma.userEvent.findMany({
    where: {
      OR: actors,
      eventType: "DISMISS",
      entityType: AnalyticsEntityType.EVENT,
      entityId: { not: null },
      createdAt: { gte: input.since },
    },
    select: { entityId: true },
  });
  return rows.flatMap((row) => (row.entityId ? [`EVENT:${row.entityId}`] : []));
}

async function loadFamily(userId: string, anonymousId: string | null, now: Date, config: FamilyPicksConfig) {
  const childRows = await prisma.child.findMany({
    where: await childScopeFor(userId),
    select: {
      id: true,
      name: true,
      birthDate: true,
      systemInterests: { select: { interestSlug: true } },
    },
  });
  const children: FamilyChild[] = childRows.map((row) => ({
    id: row.id,
    name: row.name,
    ageMonths: row.birthDate ? ageMonthsAt(row.birthDate, now) : null,
    interestSlugs: row.systemInterests.map((i) => i.interestSlug),
  }));
  const subjects: Subject[] = children.map((child) => ({
    kind: "child",
    refId: child.id,
    source: "profile",
  }));

  const dismissSince = new Date(now.getTime() - config.dismissCooldownDays * 86_400_000);
  const [planned, dismissedKeys, experienceAffinity] = await Promise.all([
    prisma.planItem.findMany({
      where: { ...(await activePlanScopeFor(userId)), activityId: { not: null } },
      select: { activityId: true },
    }),
    loadDismissedKeys({ userId, anonymousId, since: dismissSince }),
    resolveSelectedExperienceAffinity({ userId, subjects, now }),
  ]);

  const excludedKeys = new Set<string>();
  for (const p of planned) if (p.activityId) excludedKeys.add(`EVENT:${p.activityId}`);
  for (const key of dismissedKeys) excludedKeys.add(key);

  const knownCategoryIds = new Set<string>();
  for (const subject of experienceAffinity.subjects) {
    for (const categoryId of subject.categoryScores.keys()) knownCategoryIds.add(categoryId);
  }

  return {
    children,
    subjects,
    experienceAffinity,
    ctx: {
      children,
      knownCategoryIds,
      excludedKeys,
      hasHistory: experienceAffinity.outcomeEventCount > 0,
    } satisfies FamilyContext,
  };
}

/**
 * Серверная выдача блока «Для вашей семьи». Кандидаты и сигналы (популярность, интересы, история)
 * берутся из общего движка rankPlanSuggestionsForCity; поверх — политика поверхности HOME
 * (жёсткие фильтры, возраст по каждому ребёнку, разнообразие, fallback). Запуск пишется в
 * RecommendationRun/Exposure, impressionId = RecommendationExposure.id.
 */
export async function loadFamilyPicks(input: LoadFamilyPicksInput): Promise<FamilyPicksResponse> {
  const now = input.now ?? new Date();
  const config = normalizeFamilyPicksConfig(input.config);
  const window = resolveShowWindow(now, config.weekHorizonDays);
  const empty: FamilyPicksResponse = {
    level: "NONE",
    title: null,
    window,
    audience: input.userId ? "user" : "guest",
    ageFilter: [],
    runId: null,
    algorithmVersion: FAMILY_PICKS_ALGORITHM_VERSION,
    items: [],
  };

  const city = await findCityBySlug(input.citySlug.toLowerCase());
  if (!city) return empty;

  const family = input.userId
    ? await loadFamily(input.userId, input.anonymousId ?? null, now, config)
    : {
        children: [] as FamilyChild[],
        subjects: [] as Subject[],
        experienceAffinity: undefined,
        ctx: {
          children: [],
          knownCategoryIds: new Set<string>(),
          excludedKeys: new Set<string>(
            await loadDismissedKeys({
              userId: null,
              anonymousId: input.anonymousId ?? null,
              since: new Date(now.getTime() - config.dismissCooldownDays * 86_400_000),
            }),
          ),
          hasHistory: false,
        } satisfies FamilyContext,
      };

  const profileInterestSlugs = [...new Set(family.children.flatMap((child) => child.interestSlugs))];
  const batch = await rankPlanSuggestionsForCity({
    citySlug: input.citySlug,
    excludeActivityIds: [],
    dateFrom: window.dateFrom,
    dateTo: window.dateTo,
    exhaustiveCandidatePool: true,
    profileInterestSlugs,
    experienceAffinity: family.experienceAffinity,
  });
  if (batch.suggestions.length === 0) return empty;

  const range = {
    start: fromZonedTime(`${window.dateFrom}T00:00:00`, DEFAULT_TZ),
    end: new Date(fromZonedTime(`${window.dateTo}T00:00:00`, DEFAULT_TZ).getTime() + 86_400_000),
  };
  const ids = batch.suggestions.map((s) => s.activity.id);
  const extras = await prisma.activity.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      cityId: true,
      businessId: true,
      agePolicy: true,
      ageMinMonths: true,
      ageMaxMonths: true,
      priceMode: true,
      nextOccurrenceAt: true,
      scheduleMode: true,
      sessions: {
        // Нижняя граница — не раньше now: сеансы, закончившиеся сегодня утром, не рекомендуем.
        where: { withdrawnAt: null, startsAt: { gte: new Date(Math.max(range.start.getTime(), now.getTime())), lt: range.end } },
        select: { startsAt: true },
      },
    },
  });
  const extraById = new Map(extras.map((row) => [row.id, row]));

  const candidates: FamilyPickCandidate[] = [];
  const suggestionById = new Map(batch.suggestions.map((s) => [s.activity.id, s]));
  for (const s of batch.suggestions) {
    const extra = extraById.get(s.activity.id);
    if (!extra) continue;
    const occurrences = collectUpcomingOccurrences({
      sessionStarts: extra.sessions.map((row) => row.startsAt),
      nextOccurrenceAt: extra.nextOccurrenceAt,
      rangeStart: range.start,
      rangeEnd: range.end,
      now,
    });
    candidates.push({
      entityType: "EVENT",
      id: s.activity.id,
      categoryId: s.activity.eventCategory?.id ?? null,
      businessId: extra.businessId,
      agePolicy: extra.agePolicy,
      ageMinMonths: extra.ageMinMonths,
      ageMaxMonths: extra.ageMaxMonths,
      interestSlugs: eventSystemInterestSlugs(s.activity.scheduleJson),
      occurrences,
      alwaysAvailable:
        occurrences.length === 0 &&
        extra.nextOccurrenceAt == null &&
        ALWAYS_AVAILABLE_MODES.has(extra.scheduleMode),
      territory: extra.cityId === city.id ? "CITY" : "REGION",
      isFree: extra.priceMode === "FREE",
      engagementScore: s.scoreBreakdown.engagementScore,
      interestBoost: s.scoreBreakdown.interestBoost,
      experienceAffinityBoost: s.scoreBreakdown.experienceAffinityBoost,
    });
  }

  const result = selectFamilyPicks(candidates, family.ctx, window, config, now);
  if (result.items.length === 0) return { ...empty, level: result.level };

  const trace = await recordRecommendationRun({
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    anonymousId: input.userId ? null : input.anonymousId ?? null,
    surface: RecommendationSurface.HOME,
    cityId: city.id,
    citySlug: input.citySlug,
    targetDateFrom: window.dateFrom,
    targetDateTo: window.dateTo,
    algorithmVersion: FAMILY_PICKS_ALGORITHM_VERSION,
    candidateCount: candidates.length,
    decisionContext: {
      intent: "family_picks",
      subjects: family.subjects,
      constraints: {
        level: { value: result.level, source: "derived" },
        window: { value: window, source: "derived" },
      },
      actor: input.userId ? { kind: "user", id: input.userId } : { kind: "guest", id: input.anonymousId ?? null },
    },
    items: result.items.map((item) => ({
      entityType: AnalyticsEntityType.EVENT,
      entityId: item.candidate.id,
      position: item.position,
      score: item.score,
      scoreBreakdown: {
        ...item.scoreBreakdown,
        level: result.level,
        ageMatch: item.ageMatch,
        isNovelty: item.isNovelty,
        engagementScore: item.candidate.engagementScore,
        isPromoted: false,
      },
      reasonCodes: item.reasonCodes,
    })),
  });

  const items: FamilyPickCard[] = result.items.map((item) => {
    const s = suggestionById.get(item.candidate.id)!;
    const activity = s.activity;
    const earliest = item.candidate.occurrences.length
      ? new Date(Math.min(...item.candidate.occurrences.map((d) => d.getTime())))
      : null;
    return {
      entityType: "EVENT",
      id: activity.id,
      exposureId: trace?.exposureIdByEntityKey.get(`EVENT:${activity.id}`) ?? null,
      position: item.position,
      title: activity.title,
      href: `/${input.citySlug}/events/${activity.slug ?? activity.id}`,
      imageUrl: activity.coverImageUrl ?? null,
      categoryName: activity.eventCategory?.nameRu ?? null,
      ageLabel: activity.ageLabel ?? null,
      startsAt: earliest ? earliest.toISOString() : null,
      isFree: item.candidate.isFree,
      priceText: activity.priceText ?? null,
      ageMatch: item.ageMatch,
      isNovelty: item.isNovelty,
      reasonCodes: item.reasonCodes,
      reasonText: item.reasonText,
      reasonChips: item.reasonChips,
    };
  });

  return {
    level: result.level,
    title: result.title,
    window,
    audience: input.userId ? "user" : "guest",
    ageFilter: ageFilterKeysForChildren(family.children),
    runId: trace?.runId ?? null,
    algorithmVersion: FAMILY_PICKS_ALGORITHM_VERSION,
    items,
  };
}
