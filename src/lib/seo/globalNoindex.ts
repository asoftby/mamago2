import type { Metadata } from "next";

const DEFAULT_PUBLIC_SITE_URL = "https://mamago.by";

export const GLOBAL_NOINDEX_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
};

function readBooleanEnv(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

function resolveEnvironmentSummary(): string {
  const parts = [
    process.env.APP_ENV?.trim() ? `APP_ENV=${process.env.APP_ENV.trim()}` : null,
    process.env.VERCEL_ENV?.trim() ? `VERCEL_ENV=${process.env.VERCEL_ENV.trim()}` : null,
    process.env.NODE_ENV?.trim() ? `NODE_ENV=${process.env.NODE_ENV.trim()}` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : "environment unknown";
}

export function isGlobalNoindexEnabled(): boolean {
  if (readBooleanEnv("SITE_NOINDEX_FORCE")) return true;
  if (readBooleanEnv("SITE_NOINDEX_DEFAULT")) return true;
  return false;
}

export function getGlobalNoindexReason(): string {
  const envSummary = resolveEnvironmentSummary();

  if (readBooleanEnv("SITE_NOINDEX_FORCE")) {
    return `Глобальный noindex принудительно включён через SITE_NOINDEX_FORCE=true (${envSummary}).`;
  }

  if (readBooleanEnv("SITE_NOINDEX_DEFAULT")) {
    return `Глобальный noindex включён по умолчанию через SITE_NOINDEX_DEFAULT=true (${envSummary}).`;
  }

  return `Глобальный noindex выключен (${envSummary}).`;
}

export function applyGlobalRobotsOverride(metadata: Metadata): Metadata {
  if (!isGlobalNoindexEnabled()) {
    return metadata;
  }

  return {
    ...metadata,
    robots: GLOBAL_NOINDEX_ROBOTS,
  };
}

export function getGlobalNoindexPublicBaseUrl(): string {
  const raw =
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  return raw?.replace(/\/+$/u, "") || DEFAULT_PUBLIC_SITE_URL;
}
