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
  /** null when views (the denominator) is 0 — do not render as a fake 0%. */
  openRate: number | null;
  /** null when opens is 0 */
  saveRate: number | null;
  /** null when saves is 0 */
  planRate: number | null;
  /** CTA / opens, null when opens is 0 */
  clickRateVsOpens: number | null;
  /** CTA / plan adds, null when planAdds is 0 */
  clickRateVsPlans: number | null;
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
  saveRate: number | null;
  planRate: number | null;
  clickRateVsOpens: number | null;
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

export type PublicationCtaBreakdownRow = {
  /** Raw meta.targetAction value, or null when a CTA_CLICK carried no targetAction. */
  action: string | null;
  /** Russian label from ctaTargetActionLabels.ts — safe to render directly. */
  label: string;
  count: number;
};

/** Per-publication drill-down — aggregate counts only, never raw UserEvent rows. */
export type PublicationAnalyticsDetail = {
  entityType: string;
  entityId: string;
  title: string;
  vertical: string | null;
  cityName: string | null;
  range: { start: string; end: string };
  metrics: {
    impressions: number;
    opens: number;
    saves: number;
    planAdds: number;
    ctaClicks: number;
  };
  rates: {
    /** opens / impressions, null when impressions is 0 */
    openRate: number | null;
    /** saves / opens, null when opens is 0 */
    saveRate: number | null;
    /** planAdds / saves, null when saves is 0 */
    planRate: number | null;
    /** ctaClicks / opens, null when opens is 0 */
    ctaRateVsOpens: number | null;
  };
  ctaBreakdown: PublicationCtaBreakdownRow[];
};
