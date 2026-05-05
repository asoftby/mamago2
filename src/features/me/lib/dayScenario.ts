/**
 * Day Scenario Builder — slot-based model (MVP)
 *
 * Three day slots: Morning / Afternoon / Evening.
 * Each slot holds up to 3 alternatives; active index is managed in UI state.
 *
 * Real discovery scenario generation is not connected yet.
 */

export type DaySlotId = "morning" | "afternoon" | "evening";

export interface DaySlotMeta {
  id: DaySlotId;
  label: string;
  timeRange: string;   // display only
  startHour: number;   // inclusive
  endHour: number;     // exclusive
}

export const DAY_SLOTS: DaySlotMeta[] = [
  { id: "morning",   label: "Утро",   timeRange: "08:00–12:00", startHour: 8,  endHour: 12 },
  { id: "afternoon", label: "День",   timeRange: "12:00–17:00", startHour: 12, endHour: 17 },
  { id: "evening",   label: "Вечер",  timeRange: "17:00–21:00", startHour: 17, endHour: 21 },
];

export interface ScenarioStep {
  id: string;
  time: string;        // exact time for display, e.g. "10:30"
  startHour: number;   // for slot assignment
  title: string;
  type: string;
  location: string;
  image: string;
  price?: string;
  interestTags: string[];
}

export interface SlotResult {
  slot: DaySlotMeta;
  /** Primary pick — up to 3 alternatives */
  alternatives: ScenarioStep[];
  /** Secondary pick — different activities for "add second" */
  secondaryAlternatives: ScenarioStep[];
}

export interface DayScenario {
  childName: string;
  childAge: string;
  matchedInterests: string[];
  /** Only slots that have at least one alternative */
  slots: SlotResult[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function ageInYears(birthDate: Date): number {
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export function ageLabel(years: number): string {
  if (years < 1) return "до 1 года";
  if (years === 1) return "1 год";
  if (years < 5) return `${years} года`;
  return `${years} лет`;
}

export function buildDayScenario(
  child: {
    name: string;
    birthDate: Date;
    systemInterests?: { interestSlug: string }[];
    /** Override interests (used for multi-child merge) */
    mergedInterests?: string[];
  },
  globalSeed: number,
): DayScenario | null {
  void child;
  void globalSeed;
  return null;
}
