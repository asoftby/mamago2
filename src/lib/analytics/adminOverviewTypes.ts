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
  /** 0..100 относительно первого шага (views) */
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
  views: number;
  opens: number;
};

export type AnalyticsOverviewResult = {
  range: { start: string; end: string };
  activeUsers: number;
  sessions: number;
  views: number;
  opens: number;
  saves: number;
  planAdds: number;
  ctaClicks: number;
  saveRate: number;
  planRate: number;
  clickRate: number;
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
