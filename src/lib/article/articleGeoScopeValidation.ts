import type { ContentStatus, GeoScope } from "@prisma/client";

export const ARTICLE_GEO_SCOPE_MESSAGES = {
  scopeRequired: "Перед публикацией выберите охват статьи",
  cityRequired: "Выберите город для городской статьи",
  cityMustBeEmpty: "Для национальной статьи город не указывается",
} as const;

export function isPublishLikeStatus(status: ContentStatus): boolean {
  return status === "PUBLISHED" || status === "SCHEDULED" || status === "PENDING";
}

export function validateArticleGeoScope(args: {
  geoScope: GeoScope | null | undefined;
  cityId: string | null | undefined;
  strict: boolean;
}): { ok: true } | { ok: false; message: string } {
  const { geoScope, cityId, strict } = args;

  if (!geoScope) {
    if (strict) {
      return { ok: false, message: ARTICLE_GEO_SCOPE_MESSAGES.scopeRequired };
    }
    return { ok: true };
  }

  if (geoScope === "CITY") {
    if (!cityId?.trim()) {
      return { ok: false, message: ARTICLE_GEO_SCOPE_MESSAGES.cityRequired };
    }
  }

  if (geoScope === "COUNTRY" && cityId) {
    return { ok: false, message: ARTICLE_GEO_SCOPE_MESSAGES.cityMustBeEmpty };
  }

  return { ok: true };
}
