import { getSystemInterestLabel } from "@/lib/config/interests";
import { minskIsoWeekday } from "./window";
import type { ShowWindow } from "./window";
import type { FamilyPicksConfig } from "./config";

export type AgeMatch = "MATCH" | "UNKNOWN" | "MISMATCH";
/** NONE — возраст не оценивался (у семьи нет детей с известным возрастом). */
export type CandidateAgeMatch = AgeMatch | "NONE";

export type AgePolicyValue = "UNKNOWN" | "UNRESTRICTED" | "SPECIFIC" | "ADULT_ONLY";

export type FamilyChild = {
  id: string;
  name: string | null;
  /** null — дата рождения неизвестна. */
  ageMonths: number | null;
  interestSlugs: string[];
};

export type FamilyPickCandidate = {
  entityType: "EVENT" | "OFFER";
  id: string;
  categoryId: string | null;
  businessId: string | null;
  agePolicy: AgePolicyValue;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  interestSlugs: string[];
  /** Сеансы внутри окна показа. */
  occurrences: Date[];
  /** Постоянно доступно (нет привязки к дате). */
  alwaysAvailable: boolean;
  territory: "CITY" | "REGION" | "OTHER";
  isFree: boolean;
  /** Общая популярность из движка (eventEngagementScores). */
  engagementScore: number;
  /** История семьи, нормализована в [-1, 1] (experienceAffinity). */
  historyAffinity: number;
};

export type FamilyContext = {
  children: FamilyChild[];
  /** Категории, с которыми у семьи уже есть история (для слота «Попробуйте новое»). */
  knownCategoryIds: ReadonlySet<string>;
  /** `${entityType}:${id}` — скрытое (DISMISS), уже в плане и т.п. */
  excludedKeys: ReadonlySet<string>;
  /** Есть ли у семьи история посещений/оценок. */
  hasHistory: boolean;
};

export type ReasonCode =
  | "AGE_MATCH"
  | "AGE_UNKNOWN"
  | "INTEREST_MATCH"
  | "HISTORY_POSITIVE"
  | "DATE_WEEKEND"
  | "DATE_SOON"
  | "FREE"
  | "NEW_CATEGORY"
  | "POPULAR";

export type PickLevel = "PERSONAL" | "AGE" | "POPULAR" | "NONE";

export type FamilyPickItem = {
  candidate: FamilyPickCandidate;
  position: number;
  ageMatch: CandidateAgeMatch;
  matchedChildIds: string[];
  matchedInterestSlugs: string[];
  score: number;
  scoreBreakdown: {
    age: number;
    interests: number;
    date: number;
    territory: number;
    history: number;
    budget: number;
  };
  isNovelty: boolean;
  reasonCodes: ReasonCode[];
  reasonText: string | null;
};

export type FamilyPicksResult = {
  level: PickLevel;
  title: string | null;
  items: FamilyPickItem[];
  eligibleCount: number;
  filtered: Record<HardFilterReason, number>;
};

export type HardFilterReason = "EXCLUDED" | "ADULT_ONLY" | "AGE_MISMATCH" | "OUT_OF_WINDOW";

// ─── Возраст ───────────────────────────────────────────────────────────────

export function ageMonthsAt(birthDate: Date, at: Date): number {
  let months = (at.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 + (at.getUTCMonth() - birthDate.getUTCMonth());
  if (at.getUTCDate() < birthDate.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/** MATCH / UNKNOWN / MISMATCH для одного ребёнка. Границы диапазона включительно. */
export function ageMatchForChild(
  child: Pick<FamilyChild, "ageMonths">,
  c: Pick<FamilyPickCandidate, "agePolicy" | "ageMinMonths" | "ageMaxMonths">,
): AgeMatch {
  if (c.agePolicy === "ADULT_ONLY") return "MISMATCH";
  if (c.agePolicy === "UNRESTRICTED") return "MATCH";
  const hasRange = c.ageMinMonths != null || c.ageMaxMonths != null;
  if (!hasRange) return "UNKNOWN";
  if (child.ageMonths == null) return "UNKNOWN";
  if (c.ageMinMonths != null && child.ageMonths < c.ageMinMonths) return "MISMATCH";
  if (c.ageMaxMonths != null && child.ageMonths > c.ageMaxMonths) return "MISMATCH";
  return "MATCH";
}

/** Оценка по всем детям: любой MATCH → MATCH; иначе любой UNKNOWN → UNKNOWN; иначе MISMATCH. */
export function evaluateAge(
  children: readonly FamilyChild[],
  c: FamilyPickCandidate,
): { match: CandidateAgeMatch; matchedChildIds: string[] } {
  if (children.length === 0) return { match: "NONE", matchedChildIds: [] };
  const per = children.map((child) => ({ child, m: ageMatchForChild(child, c) }));
  const matched = per.filter((p) => p.m === "MATCH").map((p) => p.child.id);
  if (matched.length > 0) return { match: "MATCH", matchedChildIds: matched };
  if (per.some((p) => p.m === "UNKNOWN")) return { match: "UNKNOWN", matchedChildIds: [] };
  return { match: "MISMATCH", matchedChildIds: [] };
}

// ─── Жёсткие фильтры ──────────────────────────────────────────────────────

export function hardFilterReason(
  c: FamilyPickCandidate,
  ctx: FamilyContext,
): { reason: HardFilterReason | null; age: ReturnType<typeof evaluateAge> } {
  const age = evaluateAge(ctx.children, c);
  if (ctx.excludedKeys.has(`${c.entityType}:${c.id}`)) return { reason: "EXCLUDED", age };
  if (c.agePolicy === "ADULT_ONLY") return { reason: "ADULT_ONLY", age };
  if (age.match === "MISMATCH") return { reason: "AGE_MISMATCH", age };
  if (c.occurrences.length === 0 && !c.alwaysAvailable) return { reason: "OUT_OF_WINDOW", age };
  return { reason: null, age };
}

// ─── Скоринг ──────────────────────────────────────────────────────────────

/** Подгонка по дате к [0, 1]. Выходные: сб/вс = 1, пт вечер 0.8, остальное 0.5; неделя: чем ближе, тем лучше. */
export function dateFit(c: FamilyPickCandidate, window: ShowWindow, now: Date): number {
  if (c.occurrences.length === 0) return c.alwaysAvailable ? 0.4 : 0;
  let best = 0;
  for (const at of c.occurrences) {
    let fit: number;
    if (window.mode === "WEEKEND") {
      const dow = minskIsoWeekday(at);
      fit = dow === 6 || dow === 7 ? 1 : dow === 5 ? 0.8 : 0.5;
    } else {
      const days = Math.max(0, (at.getTime() - now.getTime()) / 86_400_000);
      fit = Math.max(0.3, 1 - (days / 7) * 0.7);
    }
    best = Math.max(best, fit);
  }
  return best;
}

function territoryFit(t: FamilyPickCandidate["territory"]): number {
  return t === "CITY" ? 1 : t === "REGION" ? 0.5 : 0;
}

function earliest(c: FamilyPickCandidate): number {
  return c.occurrences.length > 0 ? Math.min(...c.occurrences.map((d) => d.getTime())) : Number.POSITIVE_INFINITY;
}

type Scored = {
  candidate: FamilyPickCandidate;
  ageMatch: CandidateAgeMatch;
  matchedChildIds: string[];
  matchedInterestSlugs: string[];
  score: number;
  breakdown: FamilyPickItem["scoreBreakdown"];
  earliestAt: number;
};

export function scoreCandidate(
  c: FamilyPickCandidate,
  ctx: FamilyContext,
  window: ShowWindow,
  config: FamilyPicksConfig,
  now: Date,
  age = evaluateAge(ctx.children, c),
): Scored {
  const w = config.weights;
  // Интересы учитываем у детей, которым событие подходит (или возраст неизвестен), не у MISMATCH.
  const eligibleChildren = ctx.children.filter((child) => ageMatchForChild(child, c) !== "MISMATCH");
  const interestSet = new Set<string>();
  for (const child of eligibleChildren) {
    for (const slug of child.interestSlugs) if (c.interestSlugs.includes(slug)) interestSet.add(slug);
  }
  const matchedInterestSlugs = [...interestSet];
  const interestFraction = Math.min(matchedInterestSlugs.length, 2) / 2;
  const breakdown = {
    age: age.match === "MATCH" ? w.age : 0,
    interests: interestFraction * w.interests,
    date: dateFit(c, window, now) * w.date,
    territory: territoryFit(c.territory) * w.territory,
    history: Math.max(-1, Math.min(1, c.historyAffinity)) * w.history,
    budget: c.isFree ? w.budget : 0,
  };
  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return {
    candidate: c,
    ageMatch: age.match,
    matchedChildIds: age.matchedChildIds,
    matchedInterestSlugs,
    score,
    breakdown,
    earliestAt: earliest(c),
  };
}

/** MATCH всегда выше UNKNOWN/NONE; внутри — по баллу, затем популярность, ближайший сеанс, id. */
export function compareScored(a: Scored, b: Scored): number {
  const tier = (s: Scored) => (s.ageMatch === "MATCH" ? 0 : 1);
  if (tier(a) !== tier(b)) return tier(a) - tier(b);
  if (a.score !== b.score) return b.score - a.score;
  if (a.candidate.engagementScore !== b.candidate.engagementScore) {
    return b.candidate.engagementScore - a.candidate.engagementScore;
  }
  if (a.earliestAt !== b.earliestAt) return a.earliestAt - b.earliestAt;
  return a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0;
}

// ─── Причины и тексты ─────────────────────────────────────────────────────

function childLabel(child: FamilyChild): string {
  return child.name?.trim() || "ребёнок";
}

/** «Стёпа», «Стёпа и Маша», «Стёпа, Маша и ещё 1» — без склонений. */
export function formatChildNames(children: readonly FamilyChild[]): string {
  const names = children.map(childLabel);
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} и ${names[1]}`;
  return `${names[0]}, ${names[1]} и ещё ${names.length - 2}`;
}

export function buildReasonCodes(input: {
  ageMatch: CandidateAgeMatch;
  hasInterestMatch: boolean;
  historyAffinity: number;
  dateFit: number;
  window: ShowWindow;
  isFree: boolean;
  isNovelty: boolean;
  personalized: boolean;
}): ReasonCode[] {
  const codes: ReasonCode[] = [];
  if (input.ageMatch === "MATCH") codes.push("AGE_MATCH");
  if (input.ageMatch === "UNKNOWN") codes.push("AGE_UNKNOWN");
  if (input.hasInterestMatch) codes.push("INTEREST_MATCH");
  if (input.historyAffinity > 0) codes.push("HISTORY_POSITIVE");
  if (input.dateFit >= 0.8 && input.window.mode === "WEEKEND") codes.push("DATE_WEEKEND");
  else if (input.dateFit >= 0.7) codes.push("DATE_SOON");
  if (input.isFree) codes.push("FREE");
  if (input.isNovelty) codes.push("NEW_CATEGORY");
  if (!input.personalized) codes.push("POPULAR");
  return codes;
}

/**
 * Одна короткая фраза для карточки. «Подходит …» — только при AGE_MATCH (никогда для UNKNOWN);
 * без профиля семьи персональных формулировок нет.
 */
export function buildReasonText(input: {
  codes: readonly ReasonCode[];
  matchedChildren: readonly FamilyChild[];
  matchedInterestSlugs: readonly string[];
  window: ShowWindow;
}): string | null {
  const { codes } = input;
  if (codes.includes("NEW_CATEGORY")) return "Попробуйте новое";
  if (codes.includes("AGE_MATCH") && input.matchedChildren.length > 0) {
    const names = formatChildNames(input.matchedChildren);
    if (codes.includes("INTEREST_MATCH") && input.matchedInterestSlugs.length > 0) {
      return `Подходит: ${names} · ${getSystemInterestLabel(input.matchedInterestSlugs[0]!).toLowerCase()}`;
    }
    return `Подходит: ${names}`;
  }
  if (codes.includes("AGE_UNKNOWN")) return "Возраст не указан — уточните у организатора";
  if (codes.includes("HISTORY_POSITIVE")) return "Похоже на то, что вам понравилось";
  if (codes.includes("DATE_WEEKEND")) return "В эти выходные";
  if (codes.includes("DATE_SOON")) return input.window.mode === "WEEKEND" ? "В эти выходные" : "На этой неделе";
  if (codes.includes("POPULAR")) return "Популярно в вашем городе";
  return null;
}

export function titleForLevel(level: PickLevel, window: ShowWindow): string | null {
  switch (level) {
    case "PERSONAL":
      return "Для вашей семьи";
    case "AGE":
      return "По возрасту ваших детей";
    case "POPULAR":
      return window.mode === "WEEKEND" ? "Популярное на выходных" : "Популярное на этой неделе";
    default:
      return null;
  }
}

// ─── Выбор ────────────────────────────────────────────────────────────────

export function selectFamilyPicks(
  candidates: readonly FamilyPickCandidate[],
  ctx: FamilyContext,
  window: ShowWindow,
  config: FamilyPicksConfig,
  now: Date,
): FamilyPicksResult {
  const filtered: Record<HardFilterReason, number> = {
    EXCLUDED: 0,
    ADULT_ONLY: 0,
    AGE_MISMATCH: 0,
    OUT_OF_WINDOW: 0,
  };
  const scored: Scored[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const key = `${c.entityType}:${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { reason, age } = hardFilterReason(c, ctx);
    if (reason) {
      filtered[reason] += 1;
      continue;
    }
    scored.push(scoreCandidate(c, ctx, window, config, now, age));
  }

  const eligibleCount = scored.length;
  const childrenWithAge = ctx.children.filter((child) => child.ageMonths != null);
  const hasAgeData = childrenWithAge.length > 0;
  const hasInterestData = ctx.children.some((child) => child.interestSlugs.length > 0) || ctx.hasHistory;
  const personalSignal = (s: Scored) =>
    s.ageMatch === "MATCH" && (s.matchedInterestSlugs.length > 0 || s.candidate.historyAffinity > 0);

  let level: PickLevel;
  if (hasAgeData && hasInterestData && scored.filter(personalSignal).length >= config.minResultCount) {
    level = "PERSONAL";
  } else if (hasAgeData && scored.filter((s) => s.ageMatch === "MATCH").length >= config.minResultCount) {
    level = "AGE";
  } else if (eligibleCount >= config.minResultCount) {
    level = "POPULAR";
  } else {
    return { level: "NONE", title: null, items: [], eligibleCount, filtered };
  }

  let pool = scored;
  if (level === "POPULAR") {
    // Без персональных сигналов — честная популярность: движок-engagement, затем дата.
    pool = [...scored].sort((a, b) => {
      if (a.candidate.engagementScore !== b.candidate.engagementScore) {
        return b.candidate.engagementScore - a.candidate.engagementScore;
      }
      if (a.breakdown.date !== b.breakdown.date) return b.breakdown.date - a.breakdown.date;
      if (a.earliestAt !== b.earliestAt) return a.earliestAt - b.earliestAt;
      return a.candidate.id < b.candidate.id ? -1 : 1;
    });
  } else {
    pool = [...scored].sort(compareScored);
  }

  const categoryCount = new Map<string, number>();
  const businessCount = new Map<string, number>();
  const chosen: Array<{ s: Scored; novelty: boolean }> = [];
  const chosenKeys = new Set<string>();
  let unknownTaken = 0;

  const fits = (s: Scored) => {
    const cat = s.candidate.categoryId;
    const biz = s.candidate.businessId;
    if (cat && (categoryCount.get(cat) ?? 0) >= config.maxPerCategory) return false;
    if (biz && (businessCount.get(biz) ?? 0) >= config.maxPerBusiness) return false;
    return true;
  };
  const take = (s: Scored, novelty: boolean) => {
    const cat = s.candidate.categoryId;
    const biz = s.candidate.businessId;
    if (cat) categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
    if (biz) businessCount.set(biz, (businessCount.get(biz) ?? 0) + 1);
    chosen.push({ s, novelty });
    chosenKeys.add(`${s.candidate.entityType}:${s.candidate.id}`);
    if (s.ageMatch === "UNKNOWN") unknownTaken += 1;
  };
  const unknownAllowed = (s: Scored) =>
    level === "POPULAR" || s.ageMatch !== "UNKNOWN" || unknownTaken < config.maxUnknownAgeItems;

  // Слот «Попробуйте новое»: лучший кандидат из категории вне истории семьи (при MATCH-возрасте, если дети известны).
  let noveltyPick: Scored | null = null;
  if (config.noveltySlots > 0 && level !== "POPULAR") {
    noveltyPick =
      pool.find(
        (s) =>
          s.candidate.categoryId != null &&
          !ctx.knownCategoryIds.has(s.candidate.categoryId) &&
          (!hasAgeData || s.ageMatch === "MATCH"),
      ) ?? null;
  }

  const regularTarget = config.resultCount - (noveltyPick ? Math.min(1, config.noveltySlots) : 0);
  for (const s of pool) {
    if (chosen.length >= regularTarget) break;
    if (noveltyPick && s === noveltyPick) continue;
    if (!fits(s) || !unknownAllowed(s)) continue;
    take(s, false);
  }
  if (noveltyPick) {
    if (fits(noveltyPick)) {
      take(noveltyPick, true);
    } else {
      // Новинка не проходит лимиты — ищем следующую подходящую, иначе добираем обычными.
      const alt = pool.find(
        (s) =>
          !chosenKeys.has(`${s.candidate.entityType}:${s.candidate.id}`) &&
          s.candidate.categoryId != null &&
          !ctx.knownCategoryIds.has(s.candidate.categoryId) &&
          (!hasAgeData || s.ageMatch === "MATCH") &&
          fits(s),
      );
      if (alt) take(alt, true);
    }
    for (const s of pool) {
      if (chosen.length >= config.resultCount) break;
      if (chosenKeys.has(`${s.candidate.entityType}:${s.candidate.id}`)) continue;
      if (!fits(s) || !unknownAllowed(s)) continue;
      take(s, false);
    }
  }

  // «Попробуйте новое» всегда последним (стабильная сортировка).
  chosen.sort((a, b) => Number(a.novelty) - Number(b.novelty));

  if (chosen.length < config.minResultCount) {
    return { level: "NONE", title: null, items: [], eligibleCount, filtered };
  }

  const childById = new Map(ctx.children.map((child) => [child.id, child]));
  const personalized = level !== "POPULAR";
  const items: FamilyPickItem[] = chosen.map(({ s, novelty }, index) => {
    const fit = s.breakdown.date / (config.weights.date || 1);
    const reasonCodes = buildReasonCodes({
      ageMatch: personalized ? s.ageMatch : "NONE",
      hasInterestMatch: personalized && s.matchedInterestSlugs.length > 0,
      historyAffinity: personalized ? s.candidate.historyAffinity : 0,
      dateFit: config.weights.date > 0 ? fit : dateFit(s.candidate, window, now),
      window,
      isFree: s.candidate.isFree,
      isNovelty: novelty,
      personalized,
    });
    const matchedChildren = s.matchedChildIds
      .map((id) => childById.get(id))
      .filter((child): child is FamilyChild => Boolean(child));
    return {
      candidate: s.candidate,
      position: index + 1,
      ageMatch: s.ageMatch,
      matchedChildIds: s.matchedChildIds,
      matchedInterestSlugs: s.matchedInterestSlugs,
      score: s.score,
      scoreBreakdown: s.breakdown,
      isNovelty: novelty,
      reasonCodes,
      reasonText: buildReasonText({
        codes: reasonCodes,
        matchedChildren,
        matchedInterestSlugs: s.matchedInterestSlugs,
        window,
      }),
    };
  });

  return { level, title: titleForLevel(level, window), items, eligibleCount, filtered };
}
