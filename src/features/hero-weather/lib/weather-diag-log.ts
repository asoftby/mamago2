/**
 * Weather diagnostics: logs in development, or when `DEBUG_WEATHER=1` (including production builds).
 * Remove or no-op this module after debugging (STEP 10).
 */
export function weatherDiagEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.DEBUG_WEATHER === "1";
}

export function weatherDiagLog(...args: unknown[]): void {
  if (!weatherDiagEnabled()) return;
  console.log("[weather]", ...args);
}
