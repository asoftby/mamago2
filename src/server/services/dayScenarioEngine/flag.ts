/**
 * Release gate for the day-scenario engine (BACKLOG-230). Off by default on every
 * environment; enabled per environment via DAY_SCENARIO_ENGINE_ENABLED=true after
 * the DEV smoke. When off, the API answers 404 before any database work.
 */
export function isDayScenarioEngineEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.DAY_SCENARIO_ENGINE_ENABLED === "true";
}
