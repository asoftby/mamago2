export type ContentPerformanceEntityRow = {
  entityType: string;
  entityId: string;
  title: string;
  vertical: string | null;
  cityId: string | null;
  cityName: string | null;
  views: number;
  opens: number;
  saves: number;
  planAdds: number;
  ctaClicks: number;
  openRate: number;
  saveRate: number;
  planRate: number;
  /** CTA / opens */
  clickRateVsOpens: number;
  /** CTA / plan adds */
  clickRateVsPlans: number;
};

export type ContentPerformanceTopItem = {
  entityType: string;
  entityId: string;
  title: string;
  vertical: string | null;
  cityName: string | null;
  primaryMetric: number;
  saves: number;
  planAdds: number;
  opens: number;
  ctaClicks: number;
  views: number;
};

export type ContentPerformanceConverterRow = ContentPerformanceEntityRow & {
  score?: number;
};

export type ContentPerformanceComparisonRow = {
  key: string;
  label: string;
  views: number;
  opens: number;
  saves: number;
  planAdds: number;
  ctaClicks: number;
  saveRate: number;
  planRate: number;
  clickRateVsOpens: number;
};

export type AnalyticsContentPerformanceResult = {
  range: { start: string; end: string };
  topViews: ContentPerformanceTopItem[];
  topOpens: ContentPerformanceTopItem[];
  topSaves: ContentPerformanceTopItem[];
  topPlanAdds: ContentPerformanceTopItem[];
  topClicks: ContentPerformanceTopItem[];
  performanceTable: ContentPerformanceEntityRow[];
  performanceTotal: number;
  page: number;
  pageSize: number;
  sortKey: string;
  sortDir: "asc" | "desc";
  bestConverters: {
    bySaveRate: ContentPerformanceConverterRow[];
    byPlanRate: ContentPerformanceConverterRow[];
    byClickRate: ContentPerformanceConverterRow[];
  };
  worstConverters: ContentPerformanceConverterRow[];
  entityTypeComparison: ContentPerformanceComparisonRow[];
  verticalComparison: ContentPerformanceComparisonRow[];
};
