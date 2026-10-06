import { cookies } from "next/headers";
import {
  SEO_GEO_CONTEXT_COOKIE,
  SEO_GEO_CONTEXT_QUERY,
  type SeoGeoContext,
  type SeoGeoContextToken,
} from "./types";
import { isSeoGeoContextToken } from "./types";
import { loadSeoGeoCatalog, type SeoGeoCatalog } from "./loadSeoGeoCatalog";

export type ResolvedSeoGeoSession = {
  catalog: SeoGeoCatalog;
  context: SeoGeoContext;
  token: SeoGeoContextToken;
};

/**
 * Resolve active Geo SEO Context from ?geo= (preferred) or cookie.
 */
export async function resolveSeoGeoSession(
  searchParams?: Record<string, string | string[] | undefined> | null,
): Promise<ResolvedSeoGeoSession> {
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

  return { catalog, context, token };
}
