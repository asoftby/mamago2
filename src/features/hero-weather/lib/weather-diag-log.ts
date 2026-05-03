export function weatherDiagEnabled(): boolean {
  return process.env.WEATHER_DEBUG === "true";
}

export function weatherDiagLog(...args: unknown[]): void {
  if (!weatherDiagEnabled()) return;
  console.log("[weather]", ...args);
}
