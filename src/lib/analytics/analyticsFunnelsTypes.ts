export type AnalyticsFunnelStepKey =
  | "view"
  | "open"
  | "save"
  | "plan"
  | "click";

export type AnalyticsFunnelStepMetrics = {
  key: AnalyticsFunnelStepKey;
  label: string;
  count: number;
  /**
   * Ratio of this event count to the previous event count, in percent.
   * This is NOT sequential user/session conversion and can exceed 100%.
   */
  pctFromPrevious: number;
  /**
   * Ratio of this event count to canonical content impressions, in percent.
   * This is an event-volume ratio, not a unique-user conversion rate.
   */
  pctFromFirst: number;
};

export type AnalyticsFunnelSeries = {
  steps: AnalyticsFunnelStepMetrics[];
  raw: {
    view: number;
    open: number;
    save: number;
    plan: number;
    click: number;
  };
};

export type AnalyticsFunnelDropTransition = {
  from: AnalyticsFunnelStepKey;
  to: AnalyticsFunnelStepKey;
  fromCount: number;
  toCount: number;
  /** Positive decrease in raw event volume; 0 when downstream volume is >= upstream. */
  lost: number;
  /** Positive decrease percentage in raw event volume; never represents sequential-user drop-off. */
  dropOffPct: number;
};

export type AnalyticsFunnelWorstEntity = {
  entityType: string;
  entityId: string;
  title: string;
  views: number;
  opens: number;
  saves: number;
  planAdds: number;
  ctaClicks: number;
  /** Event-count ratio (for example opens / impressions), not unique-user conversion. */
  transitionRate: number;
};

export type AnalyticsFunnelVerticalDrop = {
  vertical: string;
  funnel: AnalyticsFunnelSeries;
  /** Ordered by largest positive event-volume decrease. */
  transitions: AnalyticsFunnelDropTransition[];
};

export type AnalyticsFunnelComparisonPair = {
  id: string;
  label: string;
  left: { key: string; label: string; funnel: AnalyticsFunnelSeries };
  right: { key: string; label: string; funnel: AnalyticsFunnelSeries };
};

export type AnalyticsFunnelsResult = {
  range: { start: string; end: string };
  /**
   * Explicit contract marker: this endpoint compares first-party event volumes.
   * Acquisition/session funnels belong to external analytics (GA4), not this dataset.
   */
  measurement: "event_volume";
  globalFunnel: AnalyticsFunnelSeries;
  breakdowns: {
    byEntityType: Record<string, AnalyticsFunnelSeries>;
    byVertical: Record<string, AnalyticsFunnelSeries>;
    bySegment: Record<string, AnalyticsFunnelSeries>;
    byCity: Array<{
      citySlug: string;
      cityName: string;
      funnel: AnalyticsFunnelSeries;
    }>;
  };
  comparisons: AnalyticsFunnelComparisonPair[];
  dropOff: {
    biggestSteps: AnalyticsFunnelDropTransition[];
    byEntity: {
      viewToOpen: AnalyticsFunnelWorstEntity[];
      openToSave: AnalyticsFunnelWorstEntity[];
      saveToPlan: AnalyticsFunnelWorstEntity[];
      planToClick: AnalyticsFunnelWorstEntity[];
    };
    byVertical: AnalyticsFunnelVerticalDrop[];
  };
};
