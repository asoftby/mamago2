/**
 * UI Lab is intentionally unavailable on public production deployments.
 * Next.js sets NODE_ENV=production for compiled DEV too: rely on APP_ENV.
 * Fail closed for unknown APP_ENV values.
 */
export type UiLabEnvironment = { APP_ENV?: string; NODE_ENV?: string };

export function isUiLabEnabled(env: UiLabEnvironment): boolean {
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  if (appEnv) {
    return ["dev", "development", "local", "staging", "preview"].includes(appEnv);
  }
  return env.NODE_ENV === "development";
}

export function canViewUiLab(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}
