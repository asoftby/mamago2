/**
 * View models for the /admin growth dashboard: organic recovery against the
 * locked SEO gate, and the product growth overview.
 *
 * Pure functions over the already-materialized `OperationsView.kpis` — no
 * second data source. Every unknown value stays `null` ("Нет данных"),
 * never a fabricated 0.
 */
import { differenceInCalendarISOWeeks, isValid, parse } from "date-fns";

import { SEO_BASELINE } from "../../../config/seo-baseline";
import {
  getBaselineForWeek,
  getLinearGateTargetShare,
  getRequiredWeeklyGrowth,
  nextIsoWeek,
  recoveryShareFromValues,
} from "../../../lib/seo/baseline";
import { comparisonPercent } from "@/lib/performance/performanceMetrics";
import {
  deriveB2BHealth,
  deriveEngagementFunnel,
  deriveGrowth,
  deriveHabit,
  deriveNorthStar,
  deriveProductPulse,
  deriveSupplyHealth,
} from "./dashboardViewModels";

/** Rates computed on fewer users than this are shown as counts only. */
export const MIN_RATE_SAMPLE = 30;

const ISO_WEEK_FORMAT = "RRRR-'W'II";
const ISO_WEEK_REFERENCE = new Date(2000, 0, 3, 12, 0, 0);

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readWeekMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [week, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = readNumber(raw);
    if (n !== null && n >= 0 && /^\d{4}-W\d{2}$/.test(week)) out[week] = n;
  }
  return out;
}

function readSeries(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((point) => {
    if (!point || typeof point !== "object") return [];
    const n = readNumber((point as { value?: unknown }).value);
    return n === null ? [] : [n];
  });
}

function weekDate(isoWeek: string): Date | null {
  const d = parse(isoWeek, ISO_WEEK_FORMAT, ISO_WEEK_REFERENCE);
  return isValid(d) ? d : null;
}

function weeksBetween(from: string, to: string): number | null {
  const a = weekDate(from);
  const b = weekDate(to);
  return a && b ? differenceInCalendarISOWeeks(b, a) : null;
}

// ---------------------------------------------------------------------------
// Organic recovery
// ---------------------------------------------------------------------------

export interface OrganicWeekPoint {
  isoWeek: string;
  /** Evergreen clicks actually observed; null = not measured yet. */
  actual: number | null;
  /** Clicks required that week on the straight-line path to the gate. */
  trajectory: number | null;
  /** Seasonal pre-migration baseline (100%). */
  baseline: number | null;
}

export interface OrganicRecoveryViewModel {
  latestWeek: string | null;
  actual: number | null;
  /** Relative change vs the previous measured week, %. */
  weekChangePercent: number | null;
  baseline: number | null;
  /** actual / baseline, 0..1+. */
  share: number | null;
  /** Share required this week on the linear path to 80% by the gate week. */
  targetShareNow: number | null;
  onTrack: boolean | null;
  gateWeek: string;
  gateDate: string;
  gateTargetClicks: number | null;
  targetSharePercent: number;
  weeksLeft: number | null;
  /** Compound week-over-week growth still required to hit the gate, 0..1. */
  requiredWeeklyGrowth: number | null;
  weeksMeasured: number;
  /** Fewer than three measured weeks — one week of GSC noise can swing the share. */
  highNoise: boolean;
  /** All Google clicks in the same week (events included), for context only. */
  totalClicksLatestWeek: number | null;
  series: OrganicWeekPoint[];
}

export function deriveOrganicRecovery(kpis: Record<string, unknown>): OrganicRecoveryViewModel {
  // Collected weeks win; the config's hand-entered weeks (W36) fill the gap
  // before the collector's first run.
  const actualByWeek: Record<string, number> = {
    ...readWeekMap(SEO_BASELINE.actualEvergreenByIsoWeek),
    ...readWeekMap(kpis["seo.evergreen_weekly"]),
  };
  const totalByWeek = readWeekMap(kpis["seo.total_weekly"]);

  const start = SEO_BASELINE.measurementStartIsoWeek;
  const gateWeek = SEO_BASELINE.targetIsoWeek;
  const measured = Object.keys(actualByWeek)
    .filter((w) => w >= start)
    .sort();
  const latestWeek = measured.at(-1) ?? null;
  const previousWeek = measured.at(-2) ?? null;

  const lastSeriesWeek = latestWeek && latestWeek > gateWeek ? latestWeek : gateWeek;
  const series: OrganicWeekPoint[] = [];
  for (let w: string | null = start; w && w <= lastSeriesWeek && series.length < 60; w = nextIsoWeek(w)) {
    const baseline = getBaselineForWeek(w);
    const share = getLinearGateTargetShare(w);
    series.push({
      isoWeek: w,
      actual: actualByWeek[w] ?? null,
      baseline,
      trajectory: baseline !== null && share !== null ? Math.round(baseline * share) : null,
    });
  }

  const actual = latestWeek ? actualByWeek[latestWeek] : null;
  const baseline = latestWeek ? getBaselineForWeek(latestWeek) : null;
  const share = actual !== null ? recoveryShareFromValues(actual, baseline) : null;
  const targetShareNow = latestWeek ? getLinearGateTargetShare(latestWeek) : null;
  const gateBaseline = getBaselineForWeek(gateWeek);
  const weeksLeftRaw = latestWeek ? weeksBetween(latestWeek, gateWeek) : null;

  return {
    latestWeek,
    actual,
    weekChangePercent:
      actual !== null && previousWeek ? comparisonPercent(actual, actualByWeek[previousWeek]) : null,
    baseline,
    share,
    targetShareNow,
    onTrack: share !== null && targetShareNow !== null ? share >= targetShareNow : null,
    gateWeek,
    gateDate: SEO_BASELINE.targetDate,
    gateTargetClicks: gateBaseline !== null ? Math.round(gateBaseline * SEO_BASELINE.targetShare) : null,
    targetSharePercent: Math.round(SEO_BASELINE.targetShare * 100),
    weeksLeft: weeksLeftRaw !== null ? Math.max(0, weeksLeftRaw) : null,
    requiredWeeklyGrowth:
      actual !== null && latestWeek && latestWeek < gateWeek ? getRequiredWeeklyGrowth(actual, latestWeek) : null,
    weeksMeasured: measured.length,
    highNoise: measured.length < 3,
    totalClicksLatestWeek: latestWeek ? (totalByWeek[latestWeek] ?? null) : null,
    series,
  };
}

// ---------------------------------------------------------------------------
// Growth overview
// ---------------------------------------------------------------------------

export interface GrowthOverviewViewModel {
  /** North Star: families that planned something this week. */
  wpf: number | null;
  wpfWoWPercent: number | null;
  wpfSeries: number[];
  planningPenetration: number | null;
  wau: number | null;
  wauWoWPercent: number | null;
  wauSeries: number[];
  mau: number | null;
  mauMoMPercent: number | null;
  dau: number | null;
  w1: number | null;
  w1DeltaPp: number | null;
  w4: number | null;
  w4DeltaPp: number | null;
  engagedUsers: number | null;
  saveRate: number | null;
  planRate: number | null;
  ctaRate: number | null;
  /** false when engagedUsers < MIN_RATE_SAMPLE — rates are too noisy to show. */
  ratesReliable: boolean;
  activeEvents: number | null;
  activePlaces: number | null;
  activeOffers: number | null;
  activeBusinesses: number | null;
  newBusinesses30d: number | null;
}

export function deriveGrowthOverview(kpis: Record<string, unknown>): GrowthOverviewViewModel {
  const pulse = deriveProductPulse(kpis);
  const northStar = deriveNorthStar(kpis);
  const growth = deriveGrowth(kpis);
  const habit = deriveHabit(kpis);
  const funnel = deriveEngagementFunnel(kpis);
  const supply = deriveSupplyHealth(kpis);
  const b2b = deriveB2BHealth(kpis);
  const ratesReliable = funnel.engagedUsers !== null && funnel.engagedUsers >= MIN_RATE_SAMPLE;

  return {
    wpf: northStar.wpf,
    wpfWoWPercent: northStar.wpfWoWPercent,
    wpfSeries: readSeries(kpis["planning.wpf_weekly"]),
    planningPenetration: northStar.planningPenetration,
    wau: pulse.wau,
    wauWoWPercent: growth.wauGrowthPercent,
    wauSeries: readSeries(kpis["audience.wau_weekly"]),
    mau: pulse.mau,
    mauMoMPercent: growth.mauGrowthPercent,
    dau: pulse.dau,
    w1: habit.w1,
    w1DeltaPp: habit.w1DeltaPp,
    w4: habit.w4,
    w4DeltaPp: habit.w4DeltaPp,
    engagedUsers: funnel.engagedUsers,
    saveRate: ratesReliable ? funnel.saveRate : null,
    planRate: ratesReliable ? funnel.planRate : null,
    ctaRate: ratesReliable ? funnel.ctaRate : null,
    ratesReliable,
    activeEvents: supply.activeEvents,
    activePlaces: supply.activePlaces,
    activeOffers: supply.activeOffers,
    activeBusinesses: b2b.activeBusinesses,
    newBusinesses30d: b2b.newBusinesses30d,
  };
}
