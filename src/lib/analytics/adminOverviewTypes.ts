import type { AnalyticsEntityType, AnalyticsVertical } from "@prisma/client";

export type AnalyticsOverviewDateRange = "today" | "7d" | "30d" | "90d" | "1y";

/** Совместимо с UI фильтров (lowercase entity / vertical из селектов). */
export type AnalyticsOverviewFilters = {
  dateRange: AnalyticsOverviewDateRange;
  /** `all` или slug сущности: event, place, … */
  entity: string;
  vertical: string;
  /** slug города из фильтра или "" */
  city: string;
  /** ключ сегмента из SegmentResolver (например SAVER) или "" */
  segment: string;
  /** возрастная группа младшего ребёнка: "" | "0-3" | "3-6" | "6-10" | "10+" */
  childAgeBand: string;
};

export type AnalyticsFunnelStep = {
  key: "view" | "open" | "save" | "plan" | "click";
  label: string;
  count: number;
  /** Уникальные люди (не события) */
  /**
   * 0..100: «Открыли» — доля от «Видели контент»; «Сохранили», «Добавили в план»,
   * «Перешли к партнёру» — доля от «Открыли» (отдельные ветки, не цепочка).
   */
  percentOfTop: number;
};

export type AnalyticsOverviewTopItem = {
  label: string;
  sublabel?: string;
  count: number;
};

export type AnalyticsOverviewDayPoint = {
  day: string;
  /** Минский календарный день YYYY-MM-DD */
  date: string;
  /** PAGE_VIEW без внутреннего трафика */
  pageViews: number;
  opens: number;
};

export type AnalyticsOverviewResult = {
  range: { start: string; end: string };
  /** computeCanonicalAudience().visitors (как на /admin) */
  visitors: number;
  /** DISTINCT sessionId (вечный id браузера) — «Устройства», не сессии */
  devices: number;
  /** Только PAGE_VIEW — computeCanonicalAudience().pageViews */
  pageViews: number;
  /** CARD_VIEW — «Показы в ленте», отдельно от просмотров */
  feedImpressions: number;
  opens: number;
  saves: number;
  planAdds: number;
  ctaClicks: number;
  /** Доля открывших (люди), сохранивших после открытия; null, если открывших нет */
  saveRate: number | null;
  /** Доля открывших (люди), добавивших в план после открытия; null, если открывших нет */
  planRate: number | null;
  /** Доля открывших (люди), перешедших к партнёру после открытия; null, если открывших нет */
  clickRate: number | null;
  funnel: AnalyticsFunnelStep[];
  /** Агрегаты из UserBehaviorProfile за период (lastSeen в окне) */
  profilesActiveInRange: number;
  /** Топ вертикалей по событиям */
  topVerticals: AnalyticsOverviewTopItem[];
  /** Топ сущностей (entityType + entityId) */
  topEntities: AnalyticsOverviewTopItem[];
  /** Ряд по дням для графика (ограничен по длине) */
  dailySeries: AnalyticsOverviewDayPoint[];
};
