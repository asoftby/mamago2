/** «Сценарий дня» — когда в дне больше двух событий (три и более). */
export function canOpenDayScenario(totalPlannedCount: number): boolean {
  return totalPlannedCount > 2;
}

export type ScenarioCtaState = "create" | "open" | "changed" | "hidden";

/**
 * Canonical CTA state shared by every Scenario entry point (My Plan full
 * page, My Plan overlay). `scenarioStatus` is `undefined` when no Scenario
 * exists yet for the date.
 */
export function resolveScenarioCtaState(
  totalPlannedCount: number,
  scenarioStatus: "ready" | "changed" | undefined,
): ScenarioCtaState {
  if (scenarioStatus === "changed") return "changed";
  if (scenarioStatus === "ready") return "open";
  if (canOpenDayScenario(totalPlannedCount)) return "create";
  return "hidden";
}

export function resolveScenarioCtaLabel(state: ScenarioCtaState): string | null {
  switch (state) {
    case "create":
      return "Собрать сценарий дня";
    case "open":
      return "Открыть сценарий дня";
    case "changed":
      return "Сценарий дня · План изменился";
    case "hidden":
      return null;
  }
}
