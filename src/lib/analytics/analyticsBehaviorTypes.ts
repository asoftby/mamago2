/** Ответ getAnalyticsBehavior — только агрегаты для админки. */
export type BehaviorTimeBucket = "morning" | "day" | "evening" | "night";

export type BehaviorActivityByTime = {
  label: string;
  key: BehaviorTimeBucket;
  events: number;
  sessions: number;
};

export type BehaviorActivityByDay = {
  /** 1 = Mon … 7 = Sun (ISO) */
  isoDow: number;
  label: string;
  events: number;
  sessions: number;
  activeUsers: number;
};

export type BehaviorPlanning = {
  /** 0..1, среднее по профилям пользователей с событиями в фильтре */
  sameDayShare: number;
  /** доля PLAN_ADD с meta.planningTiming === next_day (если нет данных — null) */
  nextDayShare: number | null;
  /** «заранее» из профиля (advance bucket) */
  advanceShare: number;
  weekendShare: number;
};

export type BehaviorGapItem = {
  entityType: string;
  entityId: string;
  title: string;
  metricA: number;
  metricB: number;
  rate: number;
};

export type BehaviorAgeBandRow = {
  band: string;
  views: number;
  saves: number;
  planAdds: number;
};

export type BehaviorNamedBreakdown = {
  label: string;
  key: string;
  views: number;
  saves: number;
  planAdds: number;
  ctaClicks?: number;
};

export type AnalyticsBehaviorResult = {
  range: { start: string; end: string };
  /** UTC — подпись для суточных бакетов */
  timezoneNote: string;
  activityByTime: BehaviorActivityByTime[];
  activityByDay: BehaviorActivityByDay[];
  planning: BehaviorPlanning;
  interactionGaps: {
    openNoSave: BehaviorGapItem[];
    saveNoPlan: BehaviorGapItem[];
    planNoClick: BehaviorGapItem[];
  };
  ageBreakdown: BehaviorAgeBandRow[];
  signalsBreakdown: BehaviorNamedBreakdown[];
  categoryBreakdown: BehaviorNamedBreakdown[];
  formatBreakdown: BehaviorNamedBreakdown[];
  verticalBreakdown: BehaviorNamedBreakdown[];
};
