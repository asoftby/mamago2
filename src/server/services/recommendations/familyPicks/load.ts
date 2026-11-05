import { canonicalPublicActivityPath } from "@/lib/business/eventPublicLink";
import { parseSafeOpaqueId } from "@/lib/decision/identifiers";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { AnalyticsEntityType, RecommendationSurface } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import type { Subject } from "@/lib/decision/decisionContext";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { activeFamilyUserIds, activePlanScopeFor } from "@/server/family/familyAccess";
import {
  type RankedPlanSuggestion,
  eventSystemInterestSlugs,
  rankPlanSuggestionsForCity,
} from "@/server/services/planSuggestions.service";
import { resolveSelectedExperienceAffinity } from "@/server/services/recommendations/experienceAffinity";
import { recordRecommendationRun } from "@/server/services/recommendations/RecommendationTraceService";
import {
  FAMILY_PICKS_ALGORITHM_VERSION,
  DEFAULT_FAMILY_PICKS_CONFIG,
  PERSONAL_FAMILY_PICKS_POLICY,
  normalizeFamilyPicksConfig,
  type FamilyPicksConfig,
} from "./config";
import {
  selectPersonalFamilyPicks,
  type PersonalFamilySelection,
  type PersonalFamilyPick,
  type PersonalFamilyCandidate,
  ageMonthsAt,
  ageFilterKeysForChildren,
  selectFamilyPicks,
  type FamilyChild,
  type FamilyContext,
  type FamilyPickCandidate,
  type FamilyPicksResult,
} from "./select";
import { loadFamilyPicksProfile, familyPicksProfileContext, type FamilyPicksProfileChild, type FamilyPicksProfile } from "./profile";
import {
  personalWindowRange,
  collectConfirmedOccurrences,
  resolvePersonalShowWindow,
  type PersonalShowWindow,
  collectUpcomingOccurrences,
  resolveShowWindow,
  type ShowWindow,
} from "./window";

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
  /** Profile audience is independent of the legacy ranking level/audience. */
  profileContext: ReturnType<typeof familyPicksProfileContext>;
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

async function loadFamily(userId: string, childRows: FamilyPicksProfileChild[], anonymousId: string | null, now: Date, config: FamilyPicksConfig) {
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
  const profile = await loadFamilyPicksProfile(input.userId ?? null);
  const profileContext = familyPicksProfileContext(profile);
  const empty: FamilyPicksResponse = {
    level: "NONE",
    title: null,
    window,
    audience: input.userId ? "user" : "guest",
    profileContext,
    ageFilter: [],
    runId: null,
    algorithmVersion: FAMILY_PICKS_ALGORITHM_VERSION,
    items: [],
  };

  const city = await findCityBySlug(input.citySlug.toLowerCase());
  if (!city) return empty;

  const family = input.userId
    ? await loadFamily(input.userId, profile.children, input.anonymousId ?? null, now, config)
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
    profileContext,
    ageFilter: ageFilterKeysForChildren(family.children),
    runId: trace?.runId ?? null,
    algorithmVersion: FAMILY_PICKS_ALGORITHM_VERSION,
    items,
  };
}

export class FamilyPicksSelectionUnavailableError extends Error {
  constructor() { super("selection_unavailable"); this.name = "FamilyPicksSelectionUnavailableError"; }
}

type PersonalExtras = {
  id: string;
  agePolicy: FamilyPickCandidate["agePolicy"];
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  businessId: string | null;
  priceMode?: import("@prisma/client").PublicationPriceMode;
  priceFrom?: number | null;
  priceTo?: number | null;
  currency?: string | null;
  nextOccurrenceAt: Date | null;
  sessions: { startsAt: Date; withdrawnAt: Date | null; soldOut?: boolean }[];
  _count: { sessions: number };
};

type PersonalLoadDependencies = {
  loadProfile: typeof loadFamilyPicksProfile;
  rank: typeof rankPlanSuggestionsForCity;
  loadExcluded: (userId: string, now: Date, selection: PersonalFamilySelection) => Promise<string[]>;
  loadAffinity: typeof resolveSelectedExperienceAffinity;
  loadExtras: (ids: string[], now: Date, range: { start: Date; end: Date }) => Promise<PersonalExtras[]>;
};
const personalDependencies: PersonalLoadDependencies = {
  loadProfile: loadFamilyPicksProfile,
  rank: rankPlanSuggestionsForCity,
  loadAffinity: resolveSelectedExperienceAffinity,
  loadExcluded: async (userId, now, selection) => {
    const [planned, dismissed] = await Promise.all([
      prisma.planItem.findMany({ where: { ...(await activePlanScopeFor(userId)), activityId: { not: null } }, select: { activityId: true } }),
      // HOME dismissal is scoped to the account AND optional owned child.
      // Legacy dismissals with no child remain account-wide.
      prisma.userEvent.findMany({ where: {
        userId, eventType: "DISMISS", entityType: "EVENT", entityId: { not: null },
        createdAt: { gte: new Date(now.getTime() - DEFAULT_FAMILY_PICKS_CONFIG.dismissCooldownDays * 86_400_000) },
      }, orderBy: { createdAt: "desc" }, take: 2000, select: { entityId: true, meta: true } }),
    ]);
    return [
      ...planned.flatMap(row => row.activityId ? [row.activityId] : []),
      ...dismissed.flatMap(row => {
        if (!row.entityId) return [];
        const meta = row.meta && typeof row.meta === "object" && !Array.isArray(row.meta) ? row.meta : {};
        const childScope = typeof meta.homeSelectedChildId === "string" ? meta.homeSelectedChildId : null;
        // All-family selection does not inherit individual child rejections.
        if (childScope && !(selection.mode === "CHILD" && childScope === selection.selectedChildId)
          && !(selection.mode === "PERSONAS" && selection.selectedChildIds.includes(childScope))) return [];
        return [row.entityId];
      }),
    ];
  },
  loadExtras: (ids, now, range) => prisma.activity.findMany({
    // Recheck visibility at hydration, not only at shared candidate generation.
    where: { AND: [{ id: { in: ids }, type: "EVENT", status: { in: ["PUBLISHED", "PENDING_UPDATE"] } }, getPublicListingActivityWhere(now)] },
    select: {
      id: true, businessId: true, agePolicy: true, ageMinMonths: true, ageMaxMonths: true, nextOccurrenceAt: true,
      priceMode: true, priceFrom: true, priceTo: true, currency: true,
      _count: { select: { sessions: true } },
      // Keep withdrawn rows to prevent fallback resurrecting a cancelled session.
      sessions: { where: { startsAt: { gte: range.start, lt: range.end } }, select: { startsAt: true, withdrawnAt: true } },
    },
  }),
};

/** Prepared INTERNAL v2 composition only. Not reachable from the public API/Home in PR 2.
 * No runs/exposures are written, including non-empty previews and the 7→30 retry.
 * PR 3 must explicitly wire delivery and trace once, after final selection.
 */
export async function loadPersonalFamilyPicks(input: {
  userId: string | null;
  citySlug: string;
  selection: PersonalFamilySelection;
  manualAgeRanges?: string[];
  /** Trusted same-request server snapshot only; never deserialize from an HTTP body. */
  serverProfile?: FamilyPicksProfile;
  excludeActivityIds?: string[];
  now?: Date;
}, deps: PersonalLoadDependencies = personalDependencies) {
  const now = input.now ?? new Date();
  const profile = input.serverProfile ?? await deps.loadProfile(input.userId);
  if (profile.userId !== input.userId) throw new FamilyPicksSelectionUnavailableError();
  const selection = input.selection;
  const allowed = new Set(profile.children.map(child => child.id));
  if ((selection.mode === "CHILD" && (!parseSafeOpaqueId(selection.selectedChildId)
      || !allowed.has(selection.selectedChildId)))
    || (selection.mode === "PERSONAS" && (!selection.includeAdult && selection.selectedChildIds.length === 0
      || selection.selectedChildIds.some(id => !parseSafeOpaqueId(id) || !allowed.has(id))))) {
    throw new FamilyPicksSelectionUnavailableError();
  }
  let candidateCount = 0;
  let cardExtras = new Map<string, PersonalExtras>();
  let citySlugById = new Map<string, string>();
  const response = (window: PersonalShowWindow, items: PersonalFamilyPick[], suggestions: RankedPlanSuggestion[], sharedAlgorithmVersion: string | null) => {
    const byId = new Map(suggestions.map(suggestion => [suggestion.activity.id, suggestion]));
    return {
      policyVersion: PERSONAL_FAMILY_PICKS_POLICY.version,
      sharedAlgorithmVersion,
      candidateCount,
      window,
      selection,
      status: profile.audience !== "personalized" ? "UNAVAILABLE" as const : items.length ? "READY" as const : "EMPTY" as const,
      runId: null,
      items: items.map(pick => ({
        id: pick.candidate.id, title: byId.get(pick.candidate.id)!.activity.title,
        href: canonicalPublicActivityPath({
          activityId: pick.candidate.id,
          activitySlug: byId.get(pick.candidate.id)!.activity.slug,
          activityCitySlug: citySlugById.get(byId.get(pick.candidate.id)!.activity.cityId ?? ""),
          placeCitySlug: byId.get(pick.candidate.id)!.activity.place?.city?.slug,
          venueCitySlug: byId.get(pick.candidate.id)!.activity.venue?.place?.city?.slug,
          cityField: input.citySlug,
        }),
        physicalCitySlug: citySlugById.get(byId.get(pick.candidate.id)!.activity.cityId ?? "") ?? input.citySlug,
        imageUrl: byId.get(pick.candidate.id)!.activity.coverImageUrl ?? null,
        categoryName: byId.get(pick.candidate.id)!.activity.eventCategory?.nameRu ?? null,
        agePolicy: pick.candidate.agePolicy, ageMinMonths: pick.candidate.ageMinMonths, ageMaxMonths: pick.candidate.ageMaxMonths,
        priceMode: cardExtras.get(pick.candidate.id)?.priceMode ?? "UNKNOWN",
        priceFrom: cardExtras.get(pick.candidate.id)?.priceFrom ?? null,
        priceTo: cardExtras.get(pick.candidate.id)?.priceTo ?? null,
        currency: cardExtras.get(pick.candidate.id)?.currency ?? null,
        startsAt: pick.startsAt.toISOString(), matchedChildIds: pick.matchedChildIds,
        // Badge evidence is disabled in the portable build until a reviewed,
        // independently deployable signal provider is available. Age alone is
        // never sufficient to claim that an activity suits a specific child.
        matchBadgeChildIds: [] as string[],
        allChildrenMatch: pick.allChildrenMatch, position: pick.position,
        score: pick.candidate.sharedScore, exposureId: null,
      })),
    };
  };
  if (profile.audience !== "personalized" || !profile.userId) {
    return response(resolvePersonalShowWindow(now, 30), [], [], null);
  }
  const selectedChildren = selection.mode === "CHILD"
    ? profile.children.filter(child => child.id === selection.selectedChildId)
    : selection.mode === "PERSONAS"
      ? profile.children.filter(child => selection.selectedChildIds.includes(child.id))
      : selection.mode === "DISCOVERY" ? [] : profile.children;
  const subjects: Subject[] = selectedChildren.map(child => ({ kind: "child", refId: child.id, source: "profile" }));
  const [storedExcluded, experienceAffinity] = await Promise.all([
    deps.loadExcluded(profile.userId, now, selection), deps.loadAffinity({ userId: profile.userId, subjects, now }),
  ]);
  const excluded = [...new Set([...storedExcluded, ...(input.excludeActivityIds ?? [])])];
  let lastAlgorithmVersion: string | null = null;
  for (const horizon of PERSONAL_FAMILY_PICKS_POLICY.horizons) {
    const window = resolvePersonalShowWindow(now, horizon);
    const range = personalWindowRange(window);
    const batch = await deps.rank({
      citySlug: input.citySlug, excludeActivityIds: excluded, dateFrom: window.dateFrom, dateTo: window.dateTo,
      exhaustiveCandidatePool: true,
      homeGeoFallback: selection.mode === "DISCOVERY" || selection.mode === "PERSONAS",
      profileInterestSlugs: [...new Set(selectedChildren.flatMap(child => child.systemInterests.map(interest => interest.interestSlug)))],
      experienceAffinity,
    });
    lastAlgorithmVersion = batch.algorithmVersion;
    candidateCount = batch.candidateCount;
    const extras = batch.suggestions.length ? await deps.loadExtras(batch.suggestions.map(s => s.activity.id), now, range) : [];
    const byId = new Map(extras.map(extra => [extra.id, extra]));
    cardExtras = byId;
    // Resolve physical city only if cards reference a different city. One
    // small batched lookup, no N+1 query and no guessing from the home region.
    const cityIds = [...new Set(batch.suggestions.map(s => s.activity.cityId).filter(
      (id): id is string => typeof id === "string" && id.length > 0))];
    if (cityIds.length > 0) {
      const cities = await prisma.city.findMany({ where: { id: { in: cityIds } }, select: { id: true, slug: true } });
      citySlugById = new Map(cities.map(c => [c.id, c.slug]));
    }
    const candidates: PersonalFamilyCandidate[] = batch.suggestions.flatMap(suggestion => {
      const extra = byId.get(suggestion.activity.id);
      if (!extra || excluded.includes(extra.id)) return [];
      return [{
        id: extra.id, categoryId: suggestion.activity.eventCategory?.id ?? null, businessId: extra.businessId,
        agePolicy: extra.agePolicy, ageMinMonths: extra.ageMinMonths, ageMaxMonths: extra.ageMaxMonths,
        sharedScore: suggestion.score,
        occurrences: collectConfirmedOccurrences({
          sessions: extra.sessions, hasStoredSessions: extra._count.sessions > 0,
          nextOccurrenceAt: extra.nextOccurrenceAt, rangeStart: range.start, rangeEnd: range.end, now,
        }),
      }];
    });
    const items = selectPersonalFamilyPicks(candidates, profile.children, selection, input.manualAgeRanges);
    const activeAudience = selection.mode === "PERSONAS" ||
      (selection.mode === "DISCOVERY" && (input.manualAgeRanges?.length ?? 0) > 0);
    // Do not stop at 7 days merely because irrelevant child events exist.
    // Search the 30-day horizon for actual audience matches before falling back.
    if (horizon === 30 || (items.length > 0 && (!activeAudience || items.some(item => item.targetFit)))) {
      return response(window, items, batch.suggestions, lastAlgorithmVersion);
    }
  }
  throw new Error("unreachable_family_picks_horizon");
}
