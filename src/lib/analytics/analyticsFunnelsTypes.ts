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
  /** Доля от предыдущего шага, %; у первого шага 100 */
  pctFromPrevious: number;
  /** Доля от первого шага (views), % */
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
  lost: number;
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
  /** Доля перехода по объёму (например opens/views) */
  transitionRate: number;
};

export type AnalyticsFunnelVerticalDrop = {
  vertical: string;
  funnel: AnalyticsFunnelSeries;
  /** Упорядочены по убыванию drop-off % */
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
