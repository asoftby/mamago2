import type { AnalyticsOverviewDateRange } from "@/lib/analytics/adminOverviewTypes";

/** Фильтры списка / деталки сегментов (агрегаты по профилям). */
export type AnalyticsSegmentsFilters = {
  dateRange: AnalyticsOverviewDateRange;
  /** slug города или пусто */
  city: string;
};

export type AnalyticsSegmentRow = {
  key: string;
  usersCount: number;
  /** 0..1 доля от всех профилей в фильтре */
  share: number;
  avgSaves: number;
  avgPlanAdds: number;
  avgCtaClicks: number;
  /**
   * % изменения числа активных пользователей сегмента (≥1 UserEvent): последние 7 / 30
   * завершённых минских суток против предыдущих. null — в предыдущем окне активности не было.
   */
  trend7d: number | null;
  trend30d: number | null;
};

export type AnalyticsSegmentTrendPoint = {
  /** YYYY-MM-DD */
  date: string;
  /** Уникальных активных пользователей сегмента (≥1 UserEvent) в этот минский календарный день */
  usersCount: number;
};

export type AnalyticsSegmentTopItem = {
  label: string;
  count: number;
};

export type AnalyticsSegmentContentItem = {
  entityType: string;
  entityId: string;
  title: string;
  eventsCount: number;
};

export type AnalyticsSegmentDetailResult = {
  key: string;
  range: { start: string; end: string };
  usersCount: number;
  trend: AnalyticsSegmentTrendPoint[];
  avgSaves: number;
  avgPlanAdds: number;
  avgCtaClicks: number;
  topCategories: AnalyticsSegmentTopItem[];
  topFormats: AnalyticsSegmentTopItem[];
  topVerticals: AnalyticsSegmentTopItem[];
  topContent: AnalyticsSegmentContentItem[];
  funnel: {
    views: number;
    opens: number;
    saves: number;
    planAdds: number;
    ctaClicks: number;
  };
};
