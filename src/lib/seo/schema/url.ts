import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";

export function trimTrailingSlash(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function absolutePublicUrl(pathOrUrl: string | null | undefined, publicBase = getCanonicalPublicAppUrl()): string | undefined {
  const value = pathOrUrl?.trim();
  if (!value) return undefined;

  if (/^https?:\/\//i.test(value)) return value;

  const base = trimTrailingSlash(publicBase);
  return `${base}${normalizePath(value)}`;
}

export function absolutePublicImageUrl(pathOrUrl: string | null | undefined, publicBase = getCanonicalPublicAppUrl()): string | undefined {
  return absolutePublicUrl(pathOrUrl, publicBase);
}
