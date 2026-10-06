/**
 * Geo SEO Context — продуктовый географический контекст SEO-раздела.
 *
 * Переиспользует существующие Country / Region / City и Article.geoScope
 * (CITY | REGION | COUNTRY). UI-лейбл «Национальный» = GeoScope.COUNTRY.
 * Не дублирует географическую модель статьи.
 */

import type { GeoScope } from "@prisma/client";

/** Cookie / query token for the active SEO geo context. */
export const SEO_GEO_CONTEXT_COOKIE = "mamago_seo_geo_context";
export const SEO_GEO_CONTEXT_QUERY = "geo";

/**
 * Configurable weekly content mix for future Content Plan / Opportunity Engine.
 * Shares are percentages; must sum to 100.
 */
export type GeoContentMix = {
  cityShare: number;
  regionShare: number;
  /** Maps to Article GeoScope.COUNTRY (national). */
  nationalShare: number;
};

/** Default mix — mutable config surface for P5, not a hard-coded algorithm. */
export const DEFAULT_GEO_CONTENT_MIX: GeoContentMix = {
  cityShare: 70,
  regionShare: 30,
  nationalShare: 0,
};

export type SeoGeoScopeKind = "CITY" | "REGION" | "NATIONAL";

/** Map product SEO scope labels onto Prisma GeoScope. */
export function seoScopeKindToPrisma(kind: SeoGeoScopeKind): GeoScope {
  if (kind === "NATIONAL") return "COUNTRY";
  return kind;
}

export function prismaGeoScopeToSeoKind(
  scope: GeoScope | null | undefined,
): SeoGeoScopeKind | null {
  if (scope === "CITY") return "CITY";
  if (scope === "REGION") return "REGION";
  if (scope === "COUNTRY") return "NATIONAL";
  return null;
}

export type SeoGeoContextKind = "all" | "city" | "region" | "country";

export type SeoGeoContext =
  | { kind: "all" }
  | {
      kind: "city";
      cityId: string;
      citySlug: string;
      cityName: string;
      regionId: string | null;
      regionName: string | null;
      countryId: string;
      countryName: string;
    }
  | {
      kind: "region";
      regionId: string;
      regionSlug: string;
      regionName: string;
      countryId: string;
      countryName: string;
      /** Active city ids belonging to this region (for filtering city-scoped entities). */
      cityIds: string[];
      citySlugs: string[];
    }
  | {
      kind: "country";
      countryId: string;
      countrySlug: string;
      countryName: string;
    };

export type SeoGeoSelectorOption =
  | { value: "all"; label: string; group: "special" }
  | {
      value: `city:${string}`;
      label: string;
      group: "city";
      cityId: string;
      regionName: string | null;
      countryName: string;
    }
  | {
      value: `region:${string}`;
      label: string;
      group: "region";
      regionId: string;
      countryName: string;
    }
  | {
      value: `country:${string}`;
      label: string;
      group: "country";
      countryId: string;
    };

/** Serialized token stored in cookie / ?geo= */
export type SeoGeoContextToken =
  | "all"
  | `city:${string}`
  | `region:${string}`
  | `country:${string}`;

export function isSeoGeoContextToken(value: string): value is SeoGeoContextToken {
  if (value === "all") return true;
  return /^(city|region|country):[A-Za-z0-9_-]+$/.test(value);
}

export function seoGeoContextToToken(ctx: SeoGeoContext): SeoGeoContextToken {
  if (ctx.kind === "all") return "all";
  if (ctx.kind === "city") return `city:${ctx.cityId}`;
  if (ctx.kind === "region") return `region:${ctx.regionId}`;
  return `country:${ctx.countryId}`;
}

export function formatSeoGeoContextBreadcrumb(ctx: SeoGeoContext): string {
  if (ctx.kind === "all") return "Все регионы";
  if (ctx.kind === "city") {
    const parts = [ctx.countryName];
    if (ctx.regionName) parts.push(ctx.regionName);
    parts.push(ctx.cityName);
    return parts.join(" / ");
  }
  if (ctx.kind === "region") {
    return `${ctx.countryName} / ${ctx.regionName}`;
  }
  return ctx.countryName;
}

/**
 * Target vs actual mix for a weekly content plan.
 * Used by future Opportunity Engine; UI may render empty until plans exist.
 */
export type GeoContentMixProgress = {
  target: GeoContentMix;
  actual: {
    cityCount: number;
    regionCount: number;
    nationalCount: number;
  };
  plannedTotal: number;
  warnings: string[];
};

export function buildGeoMixProgress(input: {
  target?: GeoContentMix;
  plannedTotal: number;
  actualCity: number;
  actualRegion: number;
  actualNational: number;
}): GeoContentMixProgress {
  const target = input.target ?? DEFAULT_GEO_CONTENT_MIX;
  const plannedTotal = Math.max(0, input.plannedTotal);
  const targetCity = Math.round((plannedTotal * target.cityShare) / 100);
  const targetRegion = Math.round((plannedTotal * target.regionShare) / 100);
  const targetNational = Math.max(
    0,
    plannedTotal - targetCity - targetRegion,
  );

  const warnings: string[] = [];
  if (plannedTotal > 0 && input.actualRegion < targetRegion) {
    warnings.push(
      "Недостаточно качественных региональных тем для достижения целевой пропорции",
    );
  }
  if (plannedTotal > 0 && input.actualNational < targetNational && target.nationalShare > 0) {
    warnings.push(
      "Недостаточно качественных национальных тем для достижения целевой пропорции",
    );
  }

  return {
    target,
    actual: {
      cityCount: input.actualCity,
      regionCount: input.actualRegion,
      nationalCount: input.actualNational,
    },
    plannedTotal,
    warnings,
  };
}

export function allocateGeoMixTargets(
  plannedTotal: number,
  mix: GeoContentMix = DEFAULT_GEO_CONTENT_MIX,
): { city: number; region: number; national: number } {
  const city = Math.round((plannedTotal * mix.cityShare) / 100);
  const region = Math.round((plannedTotal * mix.regionShare) / 100);
  const national = Math.max(0, plannedTotal - city - region);
  return { city, region, national };
}

/** Snapshot fields attached to SeoPage.filtersSnapshot for geo filtering. */
export type SeoPageGeoSnapshot = {
  cityId?: string | null;
  citySlug?: string | null;
  regionId?: string | null;
  geoScope?: GeoScope | null;
  countryId?: string | null;
};
