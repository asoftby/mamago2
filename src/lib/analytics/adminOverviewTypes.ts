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
  /** 0..100 относительно первого шага (canonical content impressions) */
  percentOfTop: number;
};

export type AnalyticsOverviewTopItem = {
  label: string;
  sublabel?: string;
  count: number;
};

export type AnalyticsOverviewDayPoint = {
  day: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Legacy field name; Contract v1 meaning = canonical content card impressions. */
  views: number;
  opens: number;
};

export type AnalyticsOverviewResult = {
  range: { start: string; end: string };
  activeUsers: number;
  sessions: number;
  /** Legacy field name; Contract v1 meaning = canonical content card impressions. */
  views: number;
  opens: number;
  saves: number;
  planAdds: number;
  ctaClicks: number;
  /** saves / opens; null when opens = 0 */
  saveRate: number | null;
  /** planAdds / saves; null when saves = 0 */
  planRate: number | null;
  /** canonical CTA clicks / opens; null when opens = 0 */
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
