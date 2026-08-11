/** «Сценарий дня» — когда в дне больше двух событий (три и более). */
export function canOpenDayScenario(totalPlannedCount: number): boolean {
  return totalPlannedCount > 2;
}
