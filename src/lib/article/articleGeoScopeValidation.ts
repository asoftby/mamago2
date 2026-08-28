import type { ContentStatus, GeoScope } from "@prisma/client";

export const ARTICLE_GEO_SCOPE_MESSAGES = {
  scopeRequired: "Перед публикацией выберите охват статьи",
  cityRequired: "Для городского охвата выберите город.",
  regionRequired: "Для регионального охвата выберите регион.",
  cityMustBeEmpty: "Для национальной статьи город не указывается",
  regionMustBeEmpty: "Для национальной статьи область не указывается",
  cityMustBeEmptyForRegion: "Для региональной статьи город не указывается",
  regionMustBeEmptyForCity: "Для городской статьи область не указывается",
} as const;

export function assertArticleGeoScope(args: {
  geoScope: GeoScope | null | undefined;
  cityId: string | null | undefined;
  regionId: string | null | undefined;
  strict: boolean;
}): void {
  const result = validateArticleGeoScope(args);
  if (!result.ok) throw new Error(result.message);
}

export function isPublishLikeStatus(status: ContentStatus): boolean {
  return status === "PUBLISHED" || status === "SCHEDULED" || status === "PENDING";
}

export function validateArticleGeoScope(args: {
  geoScope: GeoScope | null | undefined;
  cityId: string | null | undefined;
  regionId: string | null | undefined;
  strict: boolean;
}): { ok: true } | { ok: false; message: string } {
  const { geoScope, cityId, regionId, strict } = args;

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
    if (regionId) {
      return { ok: false, message: ARTICLE_GEO_SCOPE_MESSAGES.regionMustBeEmptyForCity };
    }
  }

  if (geoScope === "REGION") {
    if (!regionId?.trim()) {
      return { ok: false, message: ARTICLE_GEO_SCOPE_MESSAGES.regionRequired };
    }
    if (cityId) {
      return { ok: false, message: ARTICLE_GEO_SCOPE_MESSAGES.cityMustBeEmptyForRegion };
    }
  }

  if (geoScope === "COUNTRY") {
    if (cityId) {
      return { ok: false, message: ARTICLE_GEO_SCOPE_MESSAGES.cityMustBeEmpty };
    }
    if (regionId) {
      return { ok: false, message: ARTICLE_GEO_SCOPE_MESSAGES.regionMustBeEmpty };
    }
  }

  return { ok: true };
}
