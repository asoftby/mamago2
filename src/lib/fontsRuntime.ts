const GOOGLE_SANS_APP_ENVS = new Set(["dev", "prod", "production"]);

export function shouldUseGoogleSans(appEnv: string | undefined): boolean {
  return GOOGLE_SANS_APP_ENVS.has(appEnv?.trim().toLowerCase() ?? "");
}
