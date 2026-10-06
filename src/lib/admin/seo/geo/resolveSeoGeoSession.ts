import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import {
  SEO_GEO_CONTEXT_COOKIE,
  SEO_GEO_CONTEXT_QUERY,
  type SeoGeoContext,
  type SeoGeoContextToken,
  isSeoGeoContextToken,
} from "./types";
import { loadSeoGeoCatalog, type SeoGeoCatalog } from "./loadSeoGeoCatalog";
import {
  SEO_MARKET_VIEW_COOKIE,
  SEO_MARKET_VIEW_QUERY,
  enrichMarketFilterWithRegionCities,
  parseSeoMarketViewScope,
  presentSeoMarket,
  resolveSeoMarketFilter,
  type SeoMarketFilter,
  type SeoMarketPresentation,
  type SeoMarketViewScope,
} from "./seoMarket";

export type ResolvedSeoMarketSession = {
  catalog: SeoGeoCatalog;
  context: SeoGeoContext;
  token: SeoGeoContextToken;
  viewScope: SeoMarketViewScope;
  filter: SeoMarketFilter;
  presentation: SeoMarketPresentation;
};

/**
 * Resolve Geo SEO Context + Market view scope for product SEO screens.
 */
export async function resolveSeoMarketSession(
  searchParams?: Record<string, string | string[] | undefined> | null,
): Promise<ResolvedSeoMarketSession> {
  const catalog = await loadSeoGeoCatalog();
  const cookieStore = await cookies();
  const cookieRaw = cookieStore.get(SEO_GEO_CONTEXT_COOKIE)?.value ?? null;

  const fromQuery = searchParams?.[SEO_GEO_CONTEXT_QUERY];
  const queryRaw = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;

  const candidate =
    (typeof queryRaw === "string" && isSeoGeoContextToken(queryRaw)
      ? queryRaw
      : null) ??
    (cookieRaw && isSeoGeoContextToken(cookieRaw) ? cookieRaw : null) ??
    catalog.defaultToken;

  const context = catalog.resolve(candidate);
  const token =
    context.kind === "all"
      ? ("all" as const)
      : context.kind === "city"
        ? (`city:${context.cityId}` as const)
        : context.kind === "region"
          ? (`region:${context.regionId}` as const)
          : (`country:${context.countryId}` as const);

  const viewRawQuery = searchParams?.[SEO_MARKET_VIEW_QUERY];
  const viewQuery = Array.isArray(viewRawQuery) ? viewRawQuery[0] : viewRawQuery;
  const viewCookie = cookieStore.get(SEO_MARKET_VIEW_COOKIE)?.value ?? null;
  let viewScope = parseSeoMarketViewScope(viewQuery ?? viewCookie);

  const presentation = presentSeoMarket(context);
  // If market scopes unsupported, clamp to sensible default.
  if (!presentation.supportsMarketScopes && viewScope === "region") {
    viewScope = context.kind === "city" ? "city" : "market";
  }

  let filter = resolveSeoMarketFilter(context, viewScope);

  // Enrich region/market with city membership from DB (avoid stale empty lists).
  const regionIdForCities =
    filter.kind === "market"
      ? filter.regionId
      : filter.kind === "region"
        ? filter.regionId
        : context.kind === "city"
          ? context.regionId
          : null;

  if (
    regionIdForCities &&
    (filter.kind === "market" || filter.kind === "region")
  ) {
    const regionCities = await prisma.city.findMany({
      where: {
        regionId: regionIdForCities,
        isLegacyNonCity: false,
        isActive: true,
      },
      select: { id: true, slug: true },
    });
    filter = enrichMarketFilterWithRegionCities(filter, regionCities);
  }

  return {
    catalog,
    context,
    token,
    viewScope,
    filter,
    presentation,
  };
}

/** Back-compat alias used by existing SEO layout. */
export async function resolveSeoGeoSession(
  searchParams?: Record<string, string | string[] | undefined> | null,
) {
  const session = await resolveSeoMarketSession(searchParams);
  return {
    catalog: session.catalog,
    context: session.context,
    token: session.token,
  };
}
