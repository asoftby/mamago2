import type { SeoPageEntityDiagnostics } from "@/lib/admin/seo/domain/types";
import { publicActivityPath } from "@/lib/business/eventPublicLink";

function absoluteUrlForPath(publicPath: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  return base ? `${base}${publicPath}` : null;
}

function lastPathSegment(pathOrUrl: string): string {
  const s = pathOrUrl.trim();
  let pathOnly = s;
  try {
    if (s.startsWith("http://") || s.startsWith("https://")) {
      pathOnly = new URL(s).pathname;
    }
  } catch {
    /* keep pathOnly */
  }
  const parts = pathOnly.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/**
 * Диагностика для страницы события: `/{city}/events/{slug|id}`.
 */
export function buildEventEntityDiagnostics(input: {
  activityId: string;
  title: string;
  slug: string | null;
  citySlug: string;
  seoCanonicalUrl: string | null;
  seoCanonicalSource?: SeoPageEntityDiagnostics["seoCanonicalSource"];
  seoRobots: string | null;
  contentStatus: string;
}): SeoPageEntityDiagnostics {
  const slugTrim = input.slug?.trim() || null;
  const publicPath = publicActivityPath(
    input.activityId,
    input.citySlug,
    slugTrim,
  );
  const urlSegment = lastPathSegment(publicPath);
  const usesIdInUrl = urlSegment === input.activityId;

  const fallbackCanonical = publicPath;
  const effectiveCanonical = (input.seoCanonicalUrl?.trim() || fallbackCanonical).trim();
  const canonicalSeg = lastPathSegment(effectiveCanonical);

  const canonicalIsSlugBased =
    !!slugTrim && canonicalSeg === slugTrim && canonicalSeg !== input.activityId;

  const issues: string[] = [];
  if (!slugTrim) issues.push("Slug отсутствует");
  if (input.contentStatus === "PUBLISHED" && !slugTrim) {
    issues.push("Критично: опубликовано без slug — нарушение политики public URL");
  }
  if (usesIdInUrl) issues.push("Public URL использует id вместо slug");
  if (slugTrim && canonicalSeg === input.activityId) {
    issues.push("Canonical указывает на id в пути, а не на slug");
  }
  if (
    slugTrim &&
    canonicalSeg !== slugTrim &&
    canonicalSeg !== input.activityId
  ) {
    issues.push("Canonical не совпадает с ожидаемым путём по slug");
  }

  return {
    entityKind: "event",
    entityId: input.activityId,
    entityTitle: input.title,
    citySlug: input.citySlug,
    slug: slugTrim,
    urlSegment,
    publicPath,
    absolutePublicUrl: absoluteUrlForPath(publicPath),
    usesIdInUrl,
    canonicalIsSlugBased,
    seoCanonicalSource: input.seoCanonicalSource,
    contentStatus: input.contentStatus,
    seoRobots: input.seoRobots,
    issues,
  };
}

type SegmentKind = "place" | "offer" | "route" | "article";

const BASE: Record<
  SegmentKind,
  { entityKind: SeoPageEntityDiagnostics["entityKind"]; basePath: string }
> = {
  place: { entityKind: "place", basePath: "/places" },
  offer: { entityKind: "offer", basePath: "/offers" },
  route: { entityKind: "route", basePath: "/routes" },
  article: { entityKind: "article", basePath: "/blog" },
};

/**
 * Диагностика для сущностей с путём `/{prefix}/{slug|id}`.
 */
export function buildSegmentEntityDiagnostics(
  kind: SegmentKind,
  input: {
    entityId: string;
    title: string;
    slug: string | null;
    seoCanonicalUrl: string | null;
    seoCanonicalSource?: SeoPageEntityDiagnostics["seoCanonicalSource"];
    seoRobots: string | null;
    contentStatus: string;
  },
): SeoPageEntityDiagnostics {
  const { entityKind, basePath } = BASE[kind];
  const slugTrim = input.slug?.trim() || null;
  const segment = slugTrim && slugTrim.length > 0 ? slugTrim : input.entityId;
  const publicPath = `${basePath}/${segment}`;
  const usesIdInUrl = segment === input.entityId;

  const fallbackCanonical = publicPath;
  const effectiveCanonical = (input.seoCanonicalUrl?.trim() || fallbackCanonical).trim();
  const canonicalSeg = lastPathSegment(effectiveCanonical);

  const canonicalIsSlugBased =
    !!slugTrim && canonicalSeg === slugTrim && canonicalSeg !== input.entityId;

  const issues: string[] = [];
  if (!slugTrim) issues.push("Slug отсутствует");
  if (input.contentStatus === "PUBLISHED" && !slugTrim) {
    issues.push("Критично: опубликовано без slug — нарушение политики public URL");
  }
  if (usesIdInUrl) issues.push("Public URL использует id вместо slug");
  if (slugTrim && canonicalSeg === input.entityId) {
    issues.push("Canonical указывает на id в пути, а не на slug");
  }

  return {
    entityKind,
    entityId: input.entityId,
    entityTitle: input.title,
    citySlug: null,
    slug: slugTrim,
    urlSegment: segment,
    publicPath,
    absolutePublicUrl: absoluteUrlForPath(publicPath),
    usesIdInUrl,
    canonicalIsSlugBased,
    seoCanonicalSource: input.seoCanonicalSource,
    contentStatus: input.contentStatus,
    seoRobots: input.seoRobots,
    issues,
  };
}
