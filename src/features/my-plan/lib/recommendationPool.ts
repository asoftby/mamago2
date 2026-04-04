import type { PlanItemWithActivity } from "@/server/services/plan.service";

export type PlanSlotType = "morning" | "afternoon" | "evening";

/** Максимум событий в одном слоте (утро / день / вечер) на дату */
export const MAX_PLAN_ITEMS_PER_SLOT = 3;

export type PlanChildForRec = {
  id: string;
  birthDate: string;
  systemInterests: string[];
};

export type RecommendationCandidate = {
  key: string;
  slot: PlanSlotType;
  /** Пусто — подходит любому профилю интересов */
  interestSlugs: string[];
  ageMin: number;
  ageMax: number;
  buildForDate: (dateIso: string) => PlanItemWithActivity;
};

function ageInYears(birthDateIso: string): number {
  const birth = new Date(birthDateIso);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let y = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) y -= 1;
  return Math.max(0, y);
}

function atTime(dateIso: string, hours: number, minutes: number): Date {
  const [yy, mm, dd] = dateIso.split("-").map(Number);
  return new Date(yy, (mm ?? 1) - 1, dd ?? 1, hours, minutes, 0, 0);
}

function baseActivity(
  p: Omit<
    NonNullable<PlanItemWithActivity["activity"]>,
    "place" | "venue" | "slug"
  > & {
    place: NonNullable<PlanItemWithActivity["activity"]>["place"];
    slug?: string | null;
  },
): NonNullable<PlanItemWithActivity["activity"]> {
  return {
    ...p,
    slug: p.slug ?? null,
    venue: null,
  };
}

function makeItem(
  id: string,
  activityId: string,
  dateIso: string,
  startsAt: Date,
  title: string,
  cover: string,
  activity: NonNullable<PlanItemWithActivity["activity"]>,
): PlanItemWithActivity {
  return {
    id,
    userId: "me",
    activityId,
    date: dateIso,
    startsAt,
    title,
    coverImageUrl: cover,
    createdAt: new Date(),
    activity,
  };
}

/** Демо-пул: несколько вариантов на каждый слот с разными интересами и возрастом */
export const RECOMMENDATION_POOL: RecommendationCandidate[] = [
  {
    key: "m-ceramics",
    slot: "morning",
    interestSlugs: ["art", "creativity"],
    ageMin: 5,
    ageMax: 12,
    buildForDate: (dateIso) =>
      makeItem(
        `rec-${dateIso}-m1`,
        "act_m_ceramics",
        dateIso,
        atTime(dateIso, 10, 0),
        "Мастер-класс по керамике",
        "/images/ceramics.jpg",
        baseActivity({
          id: "act_m_ceramics",
          title: "Мастер-класс по керамике",
          type: "CLASS_SCHEDULE",
          coverImageUrl: "/images/ceramics.jpg",
          ageLabel: "5–12 лет",
          eventCategory: { nameRu: "Мастер-классы" },
          priceFrom: 25,
          priceText: "от 25 BYN",
          currency: "BYN",
          status: "PUBLISHED",
          owner: null,
          scheduleJson: {
            participationMode: "external-link",
            ticketLink: "https://example.com/tickets",
          },
          place: {
            shortAddress: "ул. Комсомольская, 13",
            formattedAddr: null,
            customAddress: null,
            city: { name: "Минск" },
          },
        }),
      ),
  },
  {
    key: "m-zoo",
    slot: "morning",
    interestSlugs: ["animals", "nature"],
    ageMin: 3,
    ageMax: 10,
    buildForDate: (dateIso) =>
      makeItem(
        `rec-${dateIso}-m2`,
        "act_m_zoo",
        dateIso,
        atTime(dateIso, 9, 30),
        "Экскурсия в зоопарк",
        "/images/play.jpg",
        baseActivity({
          id: "act_m_zoo",
          title: "Экскурсия в зоопарк",
          type: "EVENT_FIXED",
          coverImageUrl: "/images/play.jpg",
          ageLabel: "3–10 лет",
          eventCategory: { nameRu: "Прогулки" },
          priceFrom: 12,
          priceText: "от 12 BYN",
          currency: "BYN",
          status: "PUBLISHED",
          owner: null,
          place: {
            shortAddress: "зоопарк, ул. Ташкентская, 40",
            formattedAddr: null,
            customAddress: null,
            city: { name: "Минск" },
          },
        }),
      ),
  },
  {
    key: "m-science",
    slot: "morning",
    interestSlugs: ["science"],
    ageMin: 6,
    ageMax: 14,
    buildForDate: (dateIso) =>
      makeItem(
        `rec-${dateIso}-m3`,
        "act_m_science",
        dateIso,
        atTime(dateIso, 11, 0),
        "Научное шоу для детей",
        "/images/ceramics.jpg",
        baseActivity({
          id: "act_m_science",
          title: "Научное шоу для детей",
          type: "EVENT_FIXED",
          coverImageUrl: "/images/ceramics.jpg",
          ageLabel: "6–14 лет",
          eventCategory: { nameRu: "Наука и эксперименты" },
          priceFrom: 18,
          priceText: "от 18 BYN",
          currency: "BYN",
          status: "PUBLISHED",
          owner: null,
          place: {
            shortAddress: "пр-т Победителей, 23",
            formattedAddr: null,
            customAddress: null,
            city: { name: "Минск" },
          },
        }),
      ),
  },
  {
    key: "a-theater",
    slot: "afternoon",
    interestSlugs: ["books", "music"],
    ageMin: 3,
    ageMax: 8,
    buildForDate: (dateIso) =>
      makeItem(
        `rec-${dateIso}-a1`,
        "act_a_theater",
        dateIso,
        atTime(dateIso, 14, 0),
        'Спектакль «Лиса и медведь»',
        "/images/play.jpg",
        baseActivity({
          id: "act_a_theater",
          title: 'Спектакль «Лиса и медведь»',
          type: "EVENT_FIXED",
          coverImageUrl: "/images/play.jpg",
          ageLabel: "3–8 лет",
          eventCategory: { nameRu: "Театр" },
          priceFrom: 0,
          priceText: "Бесплатно",
          currency: "BYN",
          status: "PUBLISHED",
          owner: null,
          place: {
            shortAddress: "пр-т Независимости, 58",
            formattedAddr: null,
            customAddress: null,
            city: { name: "Минск" },
          },
        }),
      ),
  },
  {
    key: "a-music",
    slot: "afternoon",
    interestSlugs: ["music"],
    ageMin: 4,
    ageMax: 12,
    buildForDate: (dateIso) =>
      makeItem(
        `rec-${dateIso}-a2`,
        "act_a_music",
        dateIso,
        atTime(dateIso, 15, 30),
        "Пробное занятие по вокалу",
        "/images/ceramics.jpg",
        baseActivity({
          id: "act_a_music",
          title: "Пробное занятие по вокалу",
          type: "CLASS_SCHEDULE",
          coverImageUrl: "/images/ceramics.jpg",
          ageLabel: "4–12 лет",
          eventCategory: { nameRu: "Музыка" },
          priceFrom: 20,
          priceText: "от 20 BYN",
          currency: "BYN",
          status: "PUBLISHED",
          owner: null,
          scheduleJson: { participationMode: "simple-booking" },
          place: {
            shortAddress: "ул. Кальварийская, 17",
            formattedAddr: null,
            customAddress: null,
            city: { name: "Минск" },
          },
        }),
      ),
  },
  {
    key: "a-sport",
    slot: "afternoon",
    interestSlugs: ["sport", "active-games"],
    ageMin: 5,
    ageMax: 14,
    buildForDate: (dateIso) =>
      makeItem(
        `rec-${dateIso}-a3`,
        "act_a_sport",
        dateIso,
        atTime(dateIso, 16, 0),
        "Детский скалодром",
        "/images/play.jpg",
        baseActivity({
          id: "act_a_sport",
          title: "Детский скалодром",
          type: "PERMANENT",
          coverImageUrl: "/images/play.jpg",
          ageLabel: "5–14 лет",
          eventCategory: { nameRu: "Спорт" },
          priceFrom: 15,
          priceText: "от 15 BYN",
          currency: "BYN",
          status: "PUBLISHED",
          owner: null,
          place: {
            shortAddress: "ул. Притыцкого, 156",
            formattedAddr: null,
            customAddress: null,
            city: { name: "Минск" },
          },
        }),
      ),
  },
  {
    key: "e-pool",
    slot: "evening",
    interestSlugs: ["sport"],
    ageMin: 5,
    ageMax: 12,
    buildForDate: (dateIso) =>
      makeItem(
        `rec-${dateIso}-e1`,
        "act_e_pool",
        dateIso,
        atTime(dateIso, 18, 30),
        "Семейное плавание",
        "/images/ceramics.jpg",
        baseActivity({
          id: "act_e_pool",
          title: "Семейное плавание",
          type: "CLASS_SCHEDULE",
          coverImageUrl: "/images/ceramics.jpg",
          ageLabel: "5–12 лет",
          eventCategory: { nameRu: "Плавание" },
          priceFrom: 22,
          priceText: "от 22 BYN",
          currency: "BYN",
          status: "PUBLISHED",
          owner: null,
          place: {
            shortAddress: "ул. Сурганова, 2",
            formattedAddr: null,
            customAddress: null,
            city: { name: "Минск" },
          },
        }),
      ),
  },
  {
    key: "e-quiet",
    slot: "evening",
    interestSlugs: ["books", "quiet-activities"],
    ageMin: 3,
    ageMax: 10,
    buildForDate: (dateIso) =>
      makeItem(
        `rec-${dateIso}-e2`,
        "act_e_quiet",
        dateIso,
        atTime(dateIso, 19, 0),
        "Сказка перед сном (чтение)",
        "/images/play.jpg",
        baseActivity({
          id: "act_e_quiet",
          title: "Сказка перед сном (чтение)",
          type: "EVENT_FIXED",
          coverImageUrl: "/images/play.jpg",
          ageLabel: "3–10 лет",
          eventCategory: { nameRu: "Книги" },
          priceFrom: 0,
          priceText: "Бесплатно",
          currency: "BYN",
          status: "PUBLISHED",
          owner: null,
          place: {
            shortAddress: "ул. Раковская, 18",
            formattedAddr: null,
            customAddress: null,
            city: { name: "Минск" },
          },
        }),
      ),
  },
  {
    key: "e-dance",
    slot: "evening",
    interestSlugs: ["dance", "music"],
    ageMin: 5,
    ageMax: 15,
    buildForDate: (dateIso) =>
      makeItem(
        `rec-${dateIso}-e3`,
        "act_e_dance",
        dateIso,
        atTime(dateIso, 20, 0),
        "Пробный урок хип-хопа",
        "/images/ceramics.jpg",
        baseActivity({
          id: "act_e_dance",
          title: "Пробный урок хип-хопа",
          type: "CLASS_SCHEDULE",
          coverImageUrl: "/images/ceramics.jpg",
          ageLabel: "5–15 лет",
          eventCategory: { nameRu: "Танцы" },
          priceFrom: 17,
          priceText: "от 17 BYN",
          currency: "BYN",
          status: "PUBLISHED",
          owner: null,
          place: {
            shortAddress: "ул. Октябрьская, 5",
            formattedAddr: null,
            customAddress: null,
            city: { name: "Минск" },
          },
        }),
      ),
  },
];

function scopedChildren(
  children: PlanChildForRec[],
  scope: "all" | string | string[],
): PlanChildForRec[] {
  if (scope === "all") return children;
  if (Array.isArray(scope)) {
    return children.filter((c) => scope.includes(c.id));
  }
  return children.filter((c) => c.id === scope);
}

function childMatchesCandidate(
  child: PlanChildForRec,
  candidate: RecommendationCandidate,
): boolean {
  const y = ageInYears(child.birthDate);
  if (y < candidate.ageMin || y > candidate.ageMax) return false;
  if (candidate.interestSlugs.length === 0) return true;
  if (!child.systemInterests.length) return true;
  return candidate.interestSlugs.some((s) => child.systemInterests.includes(s));
}

function candidateMatches(
  candidate: RecommendationCandidate,
  children: PlanChildForRec[],
  scope: "all" | string | string[],
): boolean {
  const scoped = scopedChildren(children, scope);
  if (scoped.length === 0) return true;
  return scoped.some((ch) => childMatchesCandidate(ch, candidate));
}

export function getCandidatesForSlot(
  slot: PlanSlotType,
  children: PlanChildForRec[],
  scope: "all" | string | string[],
  pool: RecommendationCandidate[] = RECOMMENDATION_POOL,
): RecommendationCandidate[] {
  const inSlot = pool.filter((c) => c.slot === slot);
  const strict = inSlot.filter((c) => candidateMatches(c, children, scope));
  if (strict.length > 0) return strict;
  return inSlot;
}

export function pickItemForSlot(
  slot: PlanSlotType,
  children: PlanChildForRec[],
  scope: "all" | string | string[],
  cursor: number,
  dateIso: string,
  pool: RecommendationCandidate[] = RECOMMENDATION_POOL,
): PlanItemWithActivity {
  const list = getCandidatesForSlot(slot, children, scope, pool);
  const idx = list.length ? cursor % list.length : 0;
  const candidate = list[idx] ?? pool.find((c) => c.slot === slot) ?? RECOMMENDATION_POOL.find((c) => c.slot === slot)!;
  return candidate.buildForDate(dateIso);
}

/** Следующая рекомендация для слота, без уже добавленных в план активностей */
export function pickItemForSlotExcluding(
  slot: PlanSlotType,
  children: PlanChildForRec[],
  scope: "all" | string | string[],
  cursor: number,
  dateIso: string,
  excludeActivityIds: string[],
  pool: RecommendationCandidate[] = RECOMMENDATION_POOL,
): PlanItemWithActivity {
  const full = getCandidatesForSlot(slot, children, scope, pool);
  const filtered = full.filter((c) => {
    const aid = c.buildForDate(dateIso).activityId;
    if (!aid) return true;
    return !excludeActivityIds.includes(aid);
  });
  const list = filtered.length > 0 ? filtered : full;
  const idx = list.length ? cursor % list.length : 0;
  const candidate = list[idx] ?? full[0] ?? pool.find((s) => s.slot === slot) ?? RECOMMENDATION_POOL.find((s) => s.slot === slot)!;
  return candidate.buildForDate(dateIso);
}

/** Длина списка кандидатов для «Ещё варианты» с учётом exclude (минимум 1 для modulo) */
export function countSelectableCandidatesForSlot(
  slot: PlanSlotType,
  children: PlanChildForRec[],
  scope: "all" | string | string[],
  dateIso: string,
  excludeActivityIds: string[],
  pool: RecommendationCandidate[] = RECOMMENDATION_POOL,
): number {
  const full = getCandidatesForSlot(slot, children, scope, pool);
  const filtered = full.filter((c) => {
    const aid = c.buildForDate(dateIso).activityId;
    if (!aid) return true;
    return !excludeActivityIds.includes(aid);
  });
  const list = filtered.length > 0 ? filtered : full;
  return Math.max(list.length, 1);
}
