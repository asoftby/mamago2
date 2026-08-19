import packageJson from "../../../package.json";

export type AppBuildMode =
  | "production"
  | "staging"
  | "development"
  | "local"
  | "unknown";

export type BuildInfo = {
  appEnv: AppBuildMode;
  rawAppEnv: string | null;
  nodeEnv: string | null;
  vercelEnv: string | null;
  appVersion: string;
  /** Immutable deployment build/image tag (e.g. "dev-310", "prod-161"), baked in at image build time. Null outside a built image (e.g. local dev). */
  buildId: string | null;
  /** Version from the Release table (isCurrent = true). Populated by layouts; null if no published release. */
  currentReleaseVersion: string | null;
  branch: string | null;
  commitSha: string | null;
  commitShortSha: string | null;
  buildTime: string | null;
  publicUrl: string | null;
  label: string;
  tone: "production" | "staging" | "development" | "local" | "unknown";
};

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizeAppBuildMode(rawAppEnv: string | null): AppBuildMode {
  const normalized = rawAppEnv?.toLowerCase();
  if (!normalized) return "unknown";
  if (normalized === "production" || normalized === "prod") return "production";
  if (
    normalized === "staging" ||
    normalized === "stage" ||
    normalized === "preprod" ||
    normalized === "preview"
  ) {
    return "staging";
  }
  if (normalized === "development" || normalized === "dev") return "development";
  if (normalized === "local") return "local";
  return "unknown";
}

function resolveAppBuildMode(
  rawAppEnv: string | null,
  vercelEnv: string | null,
  nodeEnv: string | null,
): AppBuildMode {
  const normalizedAppEnv = normalizeAppBuildMode(rawAppEnv);
  if (normalizedAppEnv !== "unknown") return normalizedAppEnv;

  const normalizedVercelEnv = vercelEnv?.toLowerCase();
  if (normalizedVercelEnv === "production") return "production";
  if (normalizedVercelEnv === "preview") return "staging";

  const normalizedNodeEnv = nodeEnv?.toLowerCase();
  if (normalizedNodeEnv === "development") return "local";

  return "unknown";
}

function buildModeLabel(mode: AppBuildMode): string {
  switch (mode) {
    case "production":
      return "PROD";
    case "staging":
      return "STAGING";
    case "development":
      return "DEV";
    case "local":
      return "LOCAL";
    default:
      return "UNKNOWN";
  }
}

export function getBuildInfo(): BuildInfo {
  const rawAppEnv = readEnv("APP_ENV");
  const nodeEnv = readEnv("NODE_ENV");
  const vercelEnv = readEnv("VERCEL_ENV");
  const commitSha = readEnv("VERCEL_GIT_COMMIT_SHA") ?? readEnv("GIT_COMMIT_SHA");
  const appEnv = resolveAppBuildMode(rawAppEnv, vercelEnv, nodeEnv);

  return {
    appEnv,
    rawAppEnv,
    nodeEnv,
    vercelEnv,
    appVersion: String(packageJson.version ?? "0.0.0"),
    buildId: readEnv("BUILD_ID"),
    currentReleaseVersion: null,
    branch: readEnv("VERCEL_GIT_COMMIT_REF") ?? readEnv("GIT_BRANCH"),
    commitSha,
    commitShortSha: commitSha ? commitSha.slice(0, 7) : null,
    buildTime: readEnv("BUILD_TIME") ?? readEnv("NEXT_PUBLIC_BUILD_TIME"),
    publicUrl:
      readEnv("APP_PUBLIC_URL") ??
      readEnv("NEXT_PUBLIC_APP_URL") ??
      readEnv("NEXT_PUBLIC_SITE_URL"),
    label: buildModeLabel(appEnv),
    tone: appEnv,
  };
}
