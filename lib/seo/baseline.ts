import {
  addWeeks,
  differenceInCalendarISOWeeks,
  format,
  isAfter,
  isValid,
  parse,
  parseISO,
  startOfISOWeek,
  subWeeks,
} from "date-fns";

import { SEO_BASELINE } from "../../config/seo-baseline";
import { classifyUrl } from "./urlClass";

const ISO_WEEK_FORMAT = "RRRR-'W'II";
const ISO_WEEK_REFERENCE = new Date(2000, 0, 3, 12, 0, 0);

export interface WeeklySeoPageRow {
  isoWeek: string;
  url: string;
  clicks: number | null | undefined;
}

export interface PairedRecoveryWeek {
  isoWeek: string;
  actualClicks: number;
  baselineClicks: number;
}

export interface OperationalRecoveryWindow {
  weeks: PairedRecoveryWeek[];
  mode: "rolling" | "single_week_high_noise" | "unavailable";
}

export interface GateStatus {
  actual: number;
  baseline: number;
  share: number;
  /** Required recovery share for this ISO week on the linear W36 -> W44 path. */
  target: number;
  onTrack: boolean;
}

function parseIsoWeekStart(isoWeek: string): Date | null {
  const parsed = parse(isoWeek, ISO_WEEK_FORMAT, ISO_WEEK_REFERENCE);
  if (!isValid(parsed)) return null;
  const weekStart = startOfISOWeek(parsed);
  return format(weekStart, ISO_WEEK_FORMAT) === isoWeek ? weekStart : null;
}

function formatIsoWeek(date: Date): string {
  return format(startOfISOWeek(date), ISO_WEEK_FORMAT);
}

function isFiniteNonNegative(value: number | undefined | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function getLastCompletedIsoWeekStart(dataThroughDate: string): Date | null {
  const dataThrough = parseISO(`${dataThroughDate}T12:00:00`);
  if (!isValid(dataThrough)) return null;
  const containingWeekStart = startOfISOWeek(dataThrough);
  return format(dataThrough, "i") === "7" ? containingWeekStart : subWeeks(containingWeekStart, 1);
}

export function recoveryShareFromValues(
  actualClicks: number,
  baselineClicks: number | null,
): number | null {
  if (!isFiniteNonNegative(actualClicks)) return null;
  if (baselineClicks === null || !Number.isFinite(baselineClicks) || baselineClicks <= 0) return null;
  return actualClicks / baselineClicks;
}

export function compoundWeeklyRate(
  currentValue: number,
  targetValue: number,
  transitions: number,
): number | null {
  if (!Number.isFinite(currentValue) || currentValue <= 0) return null;
  if (!Number.isFinite(targetValue) || targetValue <= 0) return null;
  if (!Number.isInteger(transitions) || transitions <= 0) return null;
  return Math.pow(targetValue / currentValue, 1 / transitions) - 1;
}

export function getBaselineForWeek(isoWeek: string): number | null {
  if (SEO_BASELINE.unavailableWeeks.includes(isoWeek as (typeof SEO_BASELINE.unavailableWeeks)[number])) {
    return null;
  }
  const value = SEO_BASELINE.baselineByIsoWeek[
    isoWeek as keyof typeof SEO_BASELINE.baselineByIsoWeek
  ];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getRecoveryShare(actualClicks: number, isoWeek: string): number | null {
  return recoveryShareFromValues(actualClicks, getBaselineForWeek(isoWeek));
}

/**
 * Sum evergreen clicks for one ISO week from page-level weekly rows.
 * Event and unclear rows are excluded. No rows for the requested week means
 * unavailable (null), not a synthetic zero. A real week containing rows but
 * no evergreen clicks may legitimately return 0.
 */
export function getEvergreenClicks(
  weeklyRows: readonly WeeklySeoPageRow[],
  isoWeek: string,
): number | null {
  let sawWeek = false;
  let total = 0;

  for (const row of weeklyRows) {
    if (row.isoWeek !== isoWeek) continue;
    sawWeek = true;
    if (classifyUrl(row.url).class !== "evergreen") continue;
    if (!isFiniteNonNegative(row.clicks)) return null;
    total += row.clicks;
  }

  return sawWeek ? total : null;
}

function getTargetClicks(): number | null {
  const targetBaseline = getBaselineForWeek(SEO_BASELINE.targetIsoWeek);
  if (targetBaseline === null || targetBaseline <= 0) return null;
  return targetBaseline * SEO_BASELINE.targetShare;
}

function getTransitionCount(fromWeek: string): number | null {
  const from = parseIsoWeekStart(fromWeek);
  const target = parseIsoWeekStart(SEO_BASELINE.targetIsoWeek);
  if (!from || !target) return null;
  const transitions = differenceInCalendarISOWeeks(target, from);
  return transitions > 0 ? transitions : null;
}

export function getRequiredWeeklyGrowth(actualClicks: number, fromWeek: string): number | null {
  const targetClicks = getTargetClicks();
  const transitions = getTransitionCount(fromWeek);
  if (targetClicks === null || transitions === null) return null;
  return compoundWeeklyRate(actualClicks, targetClicks, transitions);
}

/**
 * Single-paired-week share-growth helper retained for the original v3 API.
 * For a rolling operational window use getRequiredShareGainForWindow so the
 * actual and baseline denominators are averaged over the exact same weeks.
 */
export function getRequiredShareGain(actualClicks: number, fromWeek: string): number | null {
  const currentShare = getRecoveryShare(actualClicks, fromWeek);
  const transitions = getTransitionCount(fromWeek);
  if (currentShare === null || transitions === null) return null;
  return compoundWeeklyRate(currentShare, SEO_BASELINE.targetShare, transitions);
}

/**
 * Returns up to maxWeeks fully completed paired weeks, walking backwards from
 * throughWeek. dataThroughDate is the final calendar date actually present in
 * the source snapshot; if it falls inside throughWeek, that partial week is
 * excluded automatically. The ISO week containing migrationDate is excluded,
 * as are all earlier weeks. A week whose baseline is unavailable is removed
 * from both sides of the pair rather than turning into a zero or a substituted
 * week.
 */
export function getPairedRecoveryWindow(
  actualClicksByIsoWeek: Readonly<Record<string, number>>,
  throughWeek: string,
  dataThroughDate: string,
  maxWeeks = 4,
): PairedRecoveryWeek[] {
  if (!Number.isInteger(maxWeeks) || maxWeeks <= 0) return [];
  const through = parseIsoWeekStart(throughWeek);
  const lastCompletedWeek = getLastCompletedIsoWeekStart(dataThroughDate);
  if (!through || !lastCompletedWeek) return [];

  const migrationDate = parseISO(`${SEO_BASELINE.migrationDate}T12:00:00`);
  if (!isValid(migrationDate)) return [];

  const pairs: PairedRecoveryWeek[] = [];
  let cursor = isAfter(through, lastCompletedWeek) ? lastCompletedWeek : through;
  for (let checked = 0; checked < maxWeeks; checked += 1) {
    // Strictly after the cutover date means the week containing cutover is
    // never included, even when cutover happened on that week's Monday.
    if (!isAfter(cursor, migrationDate)) break;

    const isoWeek = formatIsoWeek(cursor);
    const actualClicks = actualClicksByIsoWeek[isoWeek];
    const baselineClicks = getBaselineForWeek(isoWeek);
    if (isFiniteNonNegative(actualClicks) && baselineClicks !== null && baselineClicks > 0) {
      pairs.push({ isoWeek, actualClicks, baselineClicks });
    }
    cursor = subWeeks(cursor, 1);
  }

  return pairs.reverse();
}

/**
 * Operational rule: when fewer than three post-migration paired weeks exist,
 * use only the latest one and mark the result as high-noise.
 */
export function getOperationalRecoveryWindow(
  actualClicksByIsoWeek: Readonly<Record<string, number>>,
  throughWeek: string,
  dataThroughDate: string,
  maxWeeks = 4,
): OperationalRecoveryWindow {
  const pairs = getPairedRecoveryWindow(
    actualClicksByIsoWeek,
    throughWeek,
    dataThroughDate,
    maxWeeks,
  );
  if (pairs.length === 0) return { weeks: [], mode: "unavailable" };
  if (pairs.length < 3) {
    return { weeks: [pairs[pairs.length - 1]], mode: "single_week_high_noise" };
  }
  return { weeks: pairs, mode: "rolling" };
}

export function getRequiredShareGainForWindow(
  window: readonly PairedRecoveryWeek[],
  fromWeek: string,
): number | null {
  if (window.length === 0) return null;
  const actualAverage = window.reduce((sum, week) => sum + week.actualClicks, 0) / window.length;
  const baselineAverage = window.reduce((sum, week) => sum + week.baselineClicks, 0) / window.length;
  const transitions = getTransitionCount(fromWeek);
  if (transitions === null) return null;
  const currentShare = recoveryShareFromValues(actualAverage, baselineAverage);
  if (currentShare === null) return null;
  return compoundWeeklyRate(currentShare, SEO_BASELINE.targetShare, transitions);
}

function getConfiguredActualEvergreen(isoWeek: string): number | null {
  const value = SEO_BASELINE.actualEvergreenByIsoWeek[
    isoWeek as keyof typeof SEO_BASELINE.actualEvergreenByIsoWeek
  ];
  return isFiniteNonNegative(value) ? value : null;
}

function getLinearGateTargetShare(isoWeek: string): number | null {
  const startWeek = parseIsoWeekStart(SEO_BASELINE.measurementStartIsoWeek);
  const targetWeek = parseIsoWeekStart(SEO_BASELINE.targetIsoWeek);
  const currentWeek = parseIsoWeekStart(isoWeek);
  if (!startWeek || !targetWeek || !currentWeek) return null;

  const totalTransitions = differenceInCalendarISOWeeks(targetWeek, startWeek);
  const elapsedTransitions = differenceInCalendarISOWeeks(currentWeek, startWeek);
  if (totalTransitions <= 0 || elapsedTransitions < 0) return null;

  const startActual = getConfiguredActualEvergreen(SEO_BASELINE.measurementStartIsoWeek);
  const startBaseline = getBaselineForWeek(SEO_BASELINE.measurementStartIsoWeek);
  if (startActual === null || startBaseline === null) return null;
  const startShare = recoveryShareFromValues(startActual, startBaseline);
  if (startShare === null) return null;

  const progress = Math.min(1, elapsedTransitions / totalTransitions);
  return startShare + (SEO_BASELINE.targetShare - startShare) * progress;
}

/**
 * Return a configured completed-week gate fact. `target` is the required
 * recovery share on the straight-line trajectory from the first measurement
 * week to 80% in 2026-W44. Weeks without either a configured actual or a
 * baseline are unavailable rather than treated as zero.
 */
export function getGateStatus(isoWeek: string): GateStatus | null {
  const actual = getConfiguredActualEvergreen(isoWeek);
  const baseline = getBaselineForWeek(isoWeek);
  const target = getLinearGateTargetShare(isoWeek);
  if (actual === null || baseline === null || target === null) return null;

  const share = recoveryShareFromValues(actual, baseline);
  if (share === null) return null;
  return { actual, baseline, share, target, onTrack: share >= target };
}

/** Exposed for deterministic ISO-boundary tests without week-number arithmetic. */
export function nextIsoWeek(isoWeek: string): string | null {
  const weekStart = parseIsoWeekStart(isoWeek);
  return weekStart ? formatIsoWeek(addWeeks(weekStart, 1)) : null;
}
